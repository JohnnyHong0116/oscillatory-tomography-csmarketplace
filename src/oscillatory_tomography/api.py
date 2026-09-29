"""HTTP adapter for the existing scientific solver.

The API supports three explicit workflows: a forward prediction, an inversion
of uploaded measurements, and the original P=10 synthetic checkerboard demo.
The synthetic workflow is deliberately labelled and returns both truth and
estimated fields so the web application can reproduce the diagnostic figures
from the MATLAB/Python examples without presenting generated data as field data.
"""

from __future__ import annotations

from pathlib import Path
from time import perf_counter
from typing import Callable, Literal
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from uuid import uuid4

import numpy as np
from scipy.special import kv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field, model_validator

from .covariance import covariance_product_k_ss
from .forward import run_distributed_k_ss
from .grid import create_inputs, dimdist, plaid_cellcenter_coord
from .inversion import quasi_linear_geostatistical_inverse
from .models import Boundaries, Domain


class ApiModel(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False, extra="forbid")


class WellInput(ApiModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    x: float
    y: float


class TestInput(ApiModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    pumpingWellId: str
    observationWellIds: list[str] = Field(min_length=1)
    pumpingPeriod: float = Field(gt=0)
    pumpingRate: float = Field(gt=0)


class ObservationInput(ApiModel):
    testId: str
    wellId: str
    real: float
    imag: float


class AnalyzeRequest(ApiModel):
    testCase: Literal["inversion_10s", "black_kipp"] = "inversion_10s"
    minX: float
    maxX: float
    minY: float
    maxY: float
    # The inversion workflow remains intentionally bounded to 60x60 because
    # its dense covariance/Jacobian work grows much faster than a forward
    # solve. Black-Kipp baseline parity needs the original 300x300 grid.
    gridNx: int = Field(ge=3, le=300)
    gridNy: int = Field(ge=3, le=300)
    wells: list[WellInput] = Field(min_length=2, max_length=30)
    tests: list[TestInput] = Field(min_length=1, max_length=30)
    boundaries: dict[Literal["west", "east", "south", "north", "top", "bottom"], Literal["constant_head", "no_flow"]]
    initialLnK: float = Field(ge=-30, le=0)
    initialLnSs: float = Field(ge=-30, le=0)
    dataErrorVar: float = Field(gt=0)
    corrLengthX: float = Field(gt=0)
    corrLengthY: float = Field(gt=0)
    # The translated MATLAB baseline allows 30 gradient evaluations and often
    # converges earlier through its objective/parameter tolerances.
    maxIterations: int = Field(ge=1, le=50)
    analysisMode: Literal["forward", "synthetic_demo", "measured_inversion"] = "forward"
    observations: list[ObservationInput] | None = None

    @model_validator(mode="after")
    def validate_experiment(self) -> "AnalyzeRequest":
        if self.minX >= self.maxX or self.minY >= self.maxY:
            raise ValueError("Domain maxima must exceed minima")
        if set(self.boundaries) != {"west", "east", "south", "north", "top", "bottom"}:
            raise ValueError("All six boundary conditions are required")
        if self.testCase != "black_kipp" and (self.gridNx > 60 or self.gridNy > 60):
            raise ValueError("Tomography inversion grids are limited to 60 x 60 cells")
        if not any(self.boundaries[side] == "constant_head" for side in ("west", "east", "south", "north")):
            raise ValueError("At least one horizontal constant-head boundary is required")
        if self.boundaries["top"] != "no_flow" or self.boundaries["bottom"] != "no_flow":
            raise ValueError("The 2D solver requires no-flow top and bottom boundaries")
        well_ids = [well.id for well in self.wells]
        test_ids = [test.id for test in self.tests]
        if len(set(well_ids)) != len(well_ids) or len(set(test_ids)) != len(test_ids):
            raise ValueError("Well and test IDs must be unique")
        # The original inverse-distance interpolation uses cell centers; a
        # location exactly on a domain edge lies outside those centers.
        half_dx = (self.maxX - self.minX) / (2 * self.gridNx)
        half_dy = (self.maxY - self.minY) / (2 * self.gridNy)
        for well in self.wells:
            if not (self.minX + half_dx <= well.x <= self.maxX - half_dx and self.minY + half_dy <= well.y <= self.maxY - half_dy):
                raise ValueError(f"{well.name} must lie within the outer grid cell centers")
        pairs: set[tuple[str, str]] = set()
        for test in self.tests:
            if test.pumpingWellId not in well_ids or test.pumpingWellId in test.observationWellIds:
                raise ValueError(f"{test.name} has an invalid pumping well")
            if len(set(test.observationWellIds)) != len(test.observationWellIds) or not set(test.observationWellIds) <= set(well_ids):
                raise ValueError(f"{test.name} has invalid observation wells")
            pairs.update((test.id, well_id) for well_id in test.observationWellIds)
            if self.testCase == "black_kipp":
                pump = self.wells[well_ids.index(test.pumpingWellId)]
                if any((self.wells[well_ids.index(obs_id)].x, self.wells[well_ids.index(obs_id)].y) == (pump.x, pump.y)
                       for obs_id in test.observationWellIds if obs_id in well_ids):
                    raise ValueError("Black-Kipp analytical comparison requires a nonzero pump-observer distance")
        if len(pairs) > 100:
            raise ValueError("At most 100 test-observation pairs are supported")
        if self.observations is not None:
            if self.testCase == "black_kipp":
                raise ValueError("Black-Kipp is a forward-model comparison; measurements belong to tomography inversion")
            observed_pairs = [(item.testId, item.wellId) for item in self.observations]
            if len(observed_pairs) != len(pairs) or set(observed_pairs) != pairs:
                raise ValueError("Supply exactly one real/imag observation for every test-observation pair")
        if self.analysisMode == "measured_inversion" and self.observations is None:
            raise ValueError("Measured inversion requires a complete observation CSV")
        if self.analysisMode != "measured_inversion" and self.observations is not None:
            raise ValueError("Uploaded observations may only be used in measured inversion mode")
        if self.analysisMode == "synthetic_demo" and self.testCase != "inversion_10s":
            raise ValueError("The synthetic checkerboard demo is only available for the P=10 inversion case")
        return self


Progress = Callable[[str, int, str | None, str], None]


def _field(values: np.ndarray, ny: int, nx: int) -> list[list[float]]:
    """Serialize a Fortran-ordered parameter vector using the solver grid."""
    return values.reshape((ny, nx), order="F").tolist()


def _checkerboard_truth(domain: Domain) -> np.ndarray:
    """Recreate the heterogeneous truth used by testing_inversion_2d_geostat.py."""
    coordinates, _ = plaid_cellcenter_coord(domain)
    x_wave = np.sin(np.pi * coordinates[:, 0] / 10)
    y_wave = np.sin(np.pi * coordinates[:, 1] / 10)
    x_wave[np.abs(x_wave) < 1e-12] = 0
    y_wave[np.abs(y_wave) < 1e-12] = 0
    checker = np.sign(x_wave) * np.sign(y_wave)
    return np.r_[-9.2 + checker, -11.2 + 0.05 * checker]


def _response_diagnostics(measured: np.ndarray | None, predicted: np.ndarray) -> dict | None:
    if measured is None:
        return None
    count = predicted.size // 2
    measured_complex = measured[:count] + 1j * measured[count:]
    predicted_complex = predicted[:count] + 1j * predicted[count:]
    residual = predicted_complex - measured_complex
    measured_amplitude = np.abs(measured_complex)
    amplitude_relative = np.abs(np.abs(predicted_complex) - measured_amplitude) / np.maximum(measured_amplitude, 1e-30)
    phase_error = np.angle(predicted_complex / np.where(np.abs(measured_complex) > 0, measured_complex, 1), deg=True)
    return {
        "responseRmse": float(np.sqrt(np.mean(np.abs(residual) ** 2))),
        "meanAmplitudeRelativeError": float(np.mean(amplitude_relative)),
        "phaseRmseDegrees": float(np.sqrt(np.mean(phase_error ** 2))),
    }


def analyze(request: AnalyzeRequest, progress: Progress | None = None) -> dict:
    """Translate UI IDs to MATLAB-style well numbers and solve the model."""
    started = perf_counter()
    wells = request.wells
    index = {well.id: position + 1 for position, well in enumerate(wells)}
    rows: list[tuple[float, int, float, int]] = []
    mapping: list[tuple[TestInput, WellInput]] = []
    for test in request.tests:
        for obs_id in test.observationWellIds:
            rows.append((2 * np.pi / test.pumpingPeriod, index[test.pumpingWellId], test.pumpingRate, index[obs_id]))
            mapping.append((test, wells[index[obs_id] - 1]))
    # create_inputs groups contiguous frequencies. Stable ordering preserves
    # pair identity in the returned phasor vector and the measurement vector.
    order = sorted(range(len(rows)), key=lambda item: (rows[item][0], rows[item][1]))
    ordered_rows = np.asarray([rows[item] for item in order], dtype=float)
    ordered_mapping = [mapping[item] for item in order]
    domain = Domain(
        x=np.linspace(request.minX, request.maxX, request.gridNx + 1),
        y=np.linspace(request.minY, request.maxY, request.gridNy + 1),
        z=np.array([0.0, 1.0]),
    )
    sides = ("west", "east", "south", "north", "bottom", "top")
    boundaries = Boundaries(
        types=np.array([int(request.boundaries[side] == "constant_head") for side in sides]),
        values=np.zeros(6),
    )
    experiments = create_inputs(np.array([[well.x, well.y] for well in wells]), ordered_rows, domain)
    n_cells = request.gridNx * request.gridNy
    initial = np.r_[np.full(n_cells, request.initialLnK), np.full(n_cells, request.initialLnSs)]
    truth = _checkerboard_truth(domain) if request.analysisMode == "synthetic_demo" else None
    simulation_parameters = truth if truth is not None else initial
    forward = lambda params: run_distributed_k_ss(params, domain, boundaries, experiments, 1)
    # Solve each configured pumping test separately. This produces truthful
    # per-test completion events for the run screen while retaining the joint
    # experiment for the subsequent inversion and final prediction.
    predicted = np.empty(2 * len(ordered_rows), dtype=float)
    inversion_requested = request.analysisMode in ("synthetic_demo", "measured_inversion")
    forward_span = 40 if inversion_requested else 88
    for test_number, test in enumerate(request.tests):
        positions = [i for i, (mapped_test, _) in enumerate(ordered_mapping) if mapped_test.id == test.id]
        if progress:
            progress("forward", 5 + int(forward_span * test_number / len(request.tests)), test.id, f"Solving {test.name}")
        subset = create_inputs(np.array([[well.x, well.y] for well in wells]), ordered_rows[positions], domain)
        values = run_distributed_k_ss(simulation_parameters, domain, boundaries, subset, 1)
        predicted[positions] = values[:len(positions)]
        predicted[np.asarray(positions) + len(ordered_rows)] = values[len(positions):]
        if progress:
            progress("forward", 5 + int(forward_span * (test_number + 1) / len(request.tests)), test.id, f"Completed {test.name}")
    mode = "forward"
    iterations = 0
    objective = None
    fields = None
    true_fields = None
    error_fields = None
    sensitivity_fields = None
    objective_history: list[dict] = []
    if truth is not None:
        # Preserve exact parity with the original P=10 script, which creates
        # the complete 36-pair synthetic data vector in one joint forward
        # call. The per-test solves above remain useful for truthful progress
        # reporting, but tiny floating-point ordering differences from
        # concatenating those solves should not become inversion input.
        measured = forward(truth)
        true_fields = {
            "lnK": _field(truth[:n_cells], request.gridNy, request.gridNx),
            "lnSs": _field(truth[n_cells:], request.gridNy, request.gridNx),
        }
    elif request.observations is not None:
        by_pair = {(item.testId, item.wellId): item for item in request.observations}
        actual = [by_pair[(test.id, well.id)] for test, well in ordered_mapping]
        measured = np.r_[[item.real for item in actual], [item.imag for item in actual]]
    else:
        measured = None

    if inversion_requested:
        if progress:
            progress("inversion", 48, None, "Starting joint geostatistical inversion")
        coordinates, _ = plaid_cellcenter_coord(domain)
        distances = dimdist(coordinates[0:1], coordinates)[0]
        correlation = np.exp(-np.sqrt((distances[:, 0] / request.corrLengthX) ** 2 + (distances[:, 1] / request.corrLengthY) ** 2))
        covariance_rows = (4.0 * correlation, 0.1 * correlation)
        covariance = lambda values: covariance_product_k_ss(covariance_rows, values, (request.gridNy, request.gridNx))
        drift = np.block([[np.ones((n_cells, 1)), np.zeros((n_cells, 1))], [np.zeros((n_cells, 1)), np.ones((n_cells, 1))]])
        def report_iteration(iteration: int, nlap: float) -> None:
            objective_history.append({"iteration": iteration, "objective": float(nlap)})
            if progress:
                progress("inversion", min(96, 48 + int(48 * iteration / request.maxIterations)), None,
                         f"Iteration {iteration}: objective {nlap:.5g}")

        inverted = quasi_linear_geostatistical_inverse(
            measured, initial, np.array([request.initialLnK, request.initialLnSs]),
            drift, request.dataErrorVar * np.eye(measured.size), covariance,
            forward, lambda params: run_distributed_k_ss(params, domain, boundaries, experiments, 3),
            max_gradient_evaluations=request.maxIterations,
            progress=report_iteration,
        )
        predicted = forward(inverted.parameters)
        fields = {
            "lnK": _field(inverted.parameters[:n_cells], request.gridNy, request.gridNx),
            "lnSs": _field(inverted.parameters[n_cells:], request.gridNy, request.gridNx),
        }
        if truth is not None:
            error_fields = {
                "lnK": _field(inverted.parameters[:n_cells] - truth[:n_cells], request.gridNy, request.gridNx),
                "lnSs": _field(inverted.parameters[n_cells:] - truth[n_cells:], request.gridNy, request.gridNx),
            }
        sensitivity = np.asarray(inverted.sensitivity)
        sensitivity_fields = {
            "lnK": _field(np.log10(np.sqrt(np.sum(sensitivity[:, :n_cells] ** 2, axis=0)) + 1e-30), request.gridNy, request.gridNx),
            "lnSs": _field(np.log10(np.sqrt(np.sum(sensitivity[:, n_cells:] ** 2, axis=0)) + 1e-30), request.gridNy, request.gridNx),
        }
        mode = "inversion"
        iterations = inverted.iterations
        objective = inverted.nlap

    count = len(ordered_mapping)
    pairs = []
    for position, (test, observation_well) in enumerate(ordered_mapping):
        pump = wells[index[test.pumpingWellId] - 1]
        phasor = complex(predicted[position], predicted[position + count])
        measured_pair = None if measured is None else {"real": float(measured[position]), "imag": float(measured[position + count])}
        pairs.append({
            "testId": test.id, "testName": test.name,
            "pumpingWellId": pump.id, "pumpingWellName": pump.name,
            "observationWellId": observation_well.id, "observationWellName": observation_well.name,
            "periodSeconds": test.pumpingPeriod, "pumpingRateM3PerSecond": test.pumpingRate,
            "distanceMeters": float(np.hypot(pump.x - observation_well.x, pump.y - observation_well.y)),
            "predicted": {"real": float(phasor.real), "imag": float(phasor.imag),
                          "amplitude": float(abs(phasor)), "phaseDegrees": float(np.angle(phasor, deg=True))},
            "measured": measured_pair,
            "residualAmplitude": None if measured_pair is None else float(abs(complex(measured_pair["real"], measured_pair["imag"]) - phasor)),
        })
        if request.testCase == "black_kipp":
            # Cardiff-corrected Black-Kipp solution used by the Python example.
            # Unit aquifer thickness makes exp(lnK) transmissivity and exp(lnSs)
            # storativity for this 2-D model.
            radius = pairs[-1]["distanceMeters"]
            transmissivity = np.exp(request.initialLnK)
            storativity = np.exp(request.initialLnSs)
            u = np.sqrt((2 * np.pi / test.pumpingPeriod) * storativity * radius**2 / (2 * transmissivity))
            analytical = test.pumpingRate / (2 * np.pi * transmissivity) * kv(0, u + 1j * u)
            analytical_phase = float(np.mod(-np.angle(analytical, deg=True), 360))
            # The comparison script defines phase delay as -arg(response),
            # whereas the generic API phasor field keeps the raw argument.
            numerical_phase = float(np.mod(-np.angle(phasor, deg=True), 360))
            phase_error = abs(analytical_phase - numerical_phase)
            pairs[-1]["analytical"] = {"amplitude": float(abs(analytical)), "phaseDegrees": analytical_phase}
            pairs[-1]["numericalPhaseDegrees"] = numerical_phase
            pairs[-1]["amplitudeRelativeError"] = float(abs(abs(phasor) - abs(analytical)) / abs(analytical))
            pairs[-1]["phaseErrorDegrees"] = min(phase_error, 360 - phase_error)
            phase_radians = max(np.deg2rad(numerical_phase), 1e-12)
            coefficients = (-0.12665, 2.8642, -0.47779, 0.16586, -0.076402, 0.03089)
            log_phase = np.log(phase_radians)
            rasmussen_sum = sum(coefficient * log_phase**power for power, coefficient in enumerate(coefficients))
            omega = 2 * np.pi / test.pumpingPeriod
            diffusivity = omega * radius**2 / np.exp(rasmussen_sum)
            u_estimate = np.sqrt(omega * radius**2 / (2 * diffusivity))
            estimated_transmissivity = test.pumpingRate / (2 * np.pi * abs(phasor)) * abs(kv(0, u_estimate * (1 + 1j)))
            pairs[-1]["effectiveProperties"] = {
                "diffusivityM2PerSecond": float(diffusivity),
                "transmissivityM2PerSecond": float(estimated_transmissivity),
                "storativity": float(estimated_transmissivity / diffusivity),
            }
    test_order = {test.id: position for position, test in enumerate(request.tests)}
    observation_order = {(test.id, well_id): position for test in request.tests for position, well_id in enumerate(test.observationWellIds)}
    pairs.sort(key=lambda pair: (test_order[pair["testId"]], observation_order[(pair["testId"], pair["observationWellId"])]))
    if progress:
        progress("complete", 100, None, "Solver results ready")
    diagnostics = _response_diagnostics(measured, predicted)
    if diagnostics is not None and truth is not None and fields is not None:
        diagnostics.update(
            lnKFieldRmse=float(np.sqrt(np.mean((np.asarray(fields["lnK"]) - np.asarray(true_fields["lnK"])) ** 2))),
            lnSsFieldRmse=float(np.sqrt(np.mean((np.asarray(fields["lnSs"]) - np.asarray(true_fields["lnSs"])) ** 2))),
        )
    return {"mode": mode, "analysisMode": request.analysisMode, "pairs": pairs, "fields": fields,
            "trueFields": true_fields, "errorFields": error_fields, "sensitivityFields": sensitivity_fields,
            "objectiveHistory": objective_history, "diagnostics": diagnostics, "iterations": iterations,
            "objective": objective, "runtimeSeconds": perf_counter() - started,
            "grid": {"nx": request.gridNx, "ny": request.gridNy}}


app = FastAPI(title="Oscillatory Tomography API", version="1.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:1234", "http://127.0.0.1:1234"], allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/analyze")
def analyze_endpoint(request: AnalyzeRequest) -> dict:
    try:
        return analyze(request)
    except (ValueError, np.linalg.LinAlgError, RuntimeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


# Local, in-process jobs let the UI poll real solver progress. This intentionally
# does not promise durable storage or cancellation; deployment with multiple
# workers needs a persistent queue instead of this single-process adapter.
_executor = ThreadPoolExecutor(max_workers=1)
_jobs: dict[str, dict] = {}
_jobs_lock = Lock()


@app.post("/api/v1/jobs", status_code=202)
def start_job(request: AnalyzeRequest) -> dict[str, str]:
    job_id = uuid4().hex
    with _jobs_lock:
        # Retain a bounded history, never evict a queued/running job.
        finished = [key for key, job in _jobs.items() if job["status"] in ("complete", "failed")]
        for key in finished[:-20]:
            del _jobs[key]
        _jobs[job_id] = {"status": "queued", "stage": "queued", "percent": 0,
                         "testId": None, "message": "Waiting for solver", "result": None, "error": None,
                         "completedTestIds": [], "events": []}

    def update(stage: str, percent: int, test_id: str | None, message: str) -> None:
        with _jobs_lock:
            job = _jobs[job_id]
            job.update(status="running", stage=stage, percent=percent,
                       testId=test_id, message=message)
            job["events"].append(message)
            if stage == "forward" and message.startswith("Completed ") and test_id:
                job["completedTestIds"].append(test_id)

    def work() -> None:
        try:
            update("setup", 2, None, "Preparing solver inputs")
            result = analyze(request, update)
            with _jobs_lock:
                _jobs[job_id].update(status="complete", stage="complete", percent=100, result=result)
        except Exception as exc:
            with _jobs_lock:
                _jobs[job_id].update(status="failed", stage="failed", error=str(exc), message="Solver failed")

    _executor.submit(work)
    return {"jobId": job_id}


@app.get("/api/v1/jobs/{job_id}")
def get_job(job_id: str) -> dict:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Unknown job")
        return dict(job)


# A production frontend build can be served by the same process. The local
# Parcel development server continues to use CORS on port 1234.
WEB_DIST = Path(__file__).resolve().parents[2] / "web" / "dist"
if WEB_DIST.exists():
    app.mount("/", StaticFiles(directory=WEB_DIST, html=True), name="web")
