"""HTTP adapter for the existing scientific solver.

The API accepts physical well coordinates and per-test roles. It never invents
measurements: without supplied complex observations it returns forward-model
predictions, and only runs an inversion when every selected pair has data.
"""

from __future__ import annotations

from pathlib import Path
from time import perf_counter
from typing import Literal

import numpy as np
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
    minX: float
    maxX: float
    minY: float
    maxY: float
    gridNx: int = Field(ge=3, le=60)
    gridNy: int = Field(ge=3, le=60)
    wells: list[WellInput] = Field(min_length=2, max_length=30)
    tests: list[TestInput] = Field(min_length=1, max_length=30)
    boundaries: dict[Literal["west", "east", "south", "north", "top", "bottom"], Literal["constant_head", "no_flow"]]
    initialLnK: float = Field(ge=-30, le=0)
    initialLnSs: float = Field(ge=-30, le=0)
    dataErrorVar: float = Field(gt=0)
    corrLengthX: float = Field(gt=0)
    corrLengthY: float = Field(gt=0)
    maxIterations: int = Field(ge=1, le=10)
    observations: list[ObservationInput] | None = None

    @model_validator(mode="after")
    def validate_experiment(self) -> "AnalyzeRequest":
        if self.minX >= self.maxX or self.minY >= self.maxY:
            raise ValueError("Domain maxima must exceed minima")
        if set(self.boundaries) != {"west", "east", "south", "north", "top", "bottom"}:
            raise ValueError("All six boundary conditions are required")
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
        if len(pairs) > 100:
            raise ValueError("At most 100 test-observation pairs are supported")
        if self.observations is not None:
            observed_pairs = [(item.testId, item.wellId) for item in self.observations]
            if len(observed_pairs) != len(pairs) or set(observed_pairs) != pairs:
                raise ValueError("Supply exactly one real/imag observation for every test-observation pair")
        return self


def analyze(request: AnalyzeRequest) -> dict:
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
    forward = lambda params: run_distributed_k_ss(params, domain, boundaries, experiments, 1)
    predicted = forward(initial)
    mode = "forward"
    iterations = 0
    objective = None
    fields = None
    if request.observations is not None:
        by_pair = {(item.testId, item.wellId): item for item in request.observations}
        actual = [by_pair[(test.id, well.id)] for test, well in ordered_mapping]
        measured = np.r_[[item.real for item in actual], [item.imag for item in actual]]
        coordinates, _ = plaid_cellcenter_coord(domain)
        distances = dimdist(coordinates[0:1], coordinates)[0]
        correlation = np.exp(-np.sqrt((distances[:, 0] / request.corrLengthX) ** 2 + (distances[:, 1] / request.corrLengthY) ** 2))
        covariance_rows = (4.0 * correlation, 0.1 * correlation)
        covariance = lambda values: covariance_product_k_ss(covariance_rows, values, (request.gridNy, request.gridNx))
        drift = np.block([[np.ones((n_cells, 1)), np.zeros((n_cells, 1))], [np.zeros((n_cells, 1)), np.ones((n_cells, 1))]])
        inverted = quasi_linear_geostatistical_inverse(
            measured, initial, np.array([request.initialLnK, request.initialLnSs]),
            drift, request.dataErrorVar * np.eye(measured.size), covariance,
            forward, lambda params: run_distributed_k_ss(params, domain, boundaries, experiments, 3),
            max_gradient_evaluations=request.maxIterations,
        )
        predicted = forward(inverted.parameters)
        fields = {
            "lnK": inverted.parameters[:n_cells].reshape((request.gridNy, request.gridNx), order="F").tolist(),
            "lnSs": inverted.parameters[n_cells:].reshape((request.gridNy, request.gridNx), order="F").tolist(),
        }
        mode = "inversion"
        iterations = inverted.iterations
        objective = inverted.nlap
    else:
        measured = None

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
    test_order = {test.id: position for position, test in enumerate(request.tests)}
    observation_order = {(test.id, well_id): position for test in request.tests for position, well_id in enumerate(test.observationWellIds)}
    pairs.sort(key=lambda pair: (test_order[pair["testId"]], observation_order[(pair["testId"], pair["observationWellId"])]))
    return {"mode": mode, "pairs": pairs, "fields": fields, "iterations": iterations,
            "objective": objective, "runtimeSeconds": perf_counter() - started,
            "grid": {"nx": request.gridNx, "ny": request.gridNy}}


app = FastAPI(title="Oscillatory Tomography API", version="1.0.0")
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


# A production frontend build can be served by the same process. The local
# Parcel development server continues to use CORS on port 1234.
WEB_DIST = Path(__file__).resolve().parents[2] / "web" / "dist"
if WEB_DIST.exists():
    app.mount("/", StaticFiles(directory=WEB_DIST, html=True), name="web")
