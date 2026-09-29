"""Contract and solver integration checks for the React-facing API."""

import math

import numpy as np
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from oscillatory_tomography.api import AnalyzeRequest, _checkerboard_truth, analyze, app
from oscillatory_tomography.forward import run_distributed_k_ss
from oscillatory_tomography.grid import create_inputs
from oscillatory_tomography.models import Boundaries, Domain


def request_payload() -> dict:
    return {
        "minX": 0, "maxX": 10, "minY": 0, "maxY": 10,
        "gridNx": 5, "gridNy": 5,
        "wells": [
            {"id": "a", "name": "A", "x": 3, "y": 3},
            {"id": "b", "name": "B", "x": 7, "y": 7},
            {"id": "c", "name": "C", "x": 5, "y": 5},
        ],
        "tests": [
            {"id": "t1", "name": "Test 1", "pumpingWellId": "a", "observationWellIds": ["b", "c"], "pumpingPeriod": 10, "pumpingRate": 0.002},
            {"id": "t2", "name": "Test 2", "pumpingWellId": "b", "observationWellIds": ["a"], "pumpingPeriod": 20, "pumpingRate": 0.002},
        ],
        "boundaries": {"west": "constant_head", "east": "constant_head", "south": "no_flow", "north": "no_flow", "top": "no_flow", "bottom": "no_flow"},
        "initialLnK": -9.2, "initialLnSs": -11.2,
        "dataErrorVar": 1e-6, "corrLengthX": 3, "corrLengthY": 3,
        "maxIterations": 2,
    }


def test_forward_uses_per_test_roles_and_periods():
    result = analyze(AnalyzeRequest.model_validate(request_payload()))
    assert result["mode"] == "forward"
    assert result["fields"] is None
    assert {(pair["testId"], pair["pumpingWellId"], pair["observationWellId"]) for pair in result["pairs"]} == {
        ("t1", "a", "b"), ("t1", "a", "c"), ("t2", "b", "a")
    }
    assert [(pair["testId"], pair["observationWellId"]) for pair in result["pairs"]] == [
        ("t1", "b"), ("t1", "c"), ("t2", "a")
    ]
    assert all(math.isfinite(pair["predicted"]["amplitude"]) for pair in result["pairs"])


def test_http_contract_and_bad_input():
    client = TestClient(app)
    assert client.get("/api/v1/health").json() == {"status": "ok"}
    response = client.post("/api/v1/analyze", json=request_payload())
    assert response.status_code == 200
    assert len(response.json()["pairs"]) == 3
    invalid = request_payload()
    invalid["tests"][0]["observationWellIds"] = ["a"]
    assert client.post("/api/v1/analyze", json=invalid).status_code == 422


def test_incomplete_observations_are_rejected():
    payload = request_payload()
    payload["analysisMode"] = "measured_inversion"
    payload["observations"] = [{"testId": "t1", "wellId": "b", "real": 0, "imag": 0}]
    with pytest.raises(ValidationError, match="exactly one"):
        AnalyzeRequest.model_validate(payload)


def test_well_at_unreachable_edge_is_rejected():
    payload = request_payload()
    payload["wells"][0]["x"] = 0
    with pytest.raises(ValidationError, match="outer grid cell centers"):
        AnalyzeRequest.model_validate(payload)


def test_baseline_iteration_budget_is_allowed_and_bounded():
    payload = request_payload()
    payload["maxIterations"] = 30
    assert AnalyzeRequest.model_validate(payload).maxIterations == 30
    payload["maxIterations"] = 51
    with pytest.raises(ValidationError):
        AnalyzeRequest.model_validate(payload)


def test_synthetic_demo_uses_joint_baseline_observation_vector():
    payload = request_payload()
    payload["analysisMode"] = "synthetic_demo"
    payload["tests"][1]["pumpingPeriod"] = 10
    request = AnalyzeRequest.model_validate(payload)
    result = analyze(request)

    # The synthetic measurements are the original workflow's joint forward
    # response, rather than a concatenation of independently solved tests.
    measured = np.r_[
        [pair["measured"]["real"] for pair in result["pairs"]],
        [pair["measured"]["imag"] for pair in result["pairs"]],
    ]
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
    well_index = {well.id: index + 1 for index, well in enumerate(request.wells)}
    rows = np.asarray([
        (2 * np.pi / test.pumpingPeriod, well_index[test.pumpingWellId], test.pumpingRate, well_index[observation_id])
        for test in request.tests
        for observation_id in test.observationWellIds
    ])
    experiments = create_inputs(
        np.array([[well.x, well.y] for well in request.wells]), rows, domain,
    )
    truth = _checkerboard_truth(domain)
    expected = run_distributed_k_ss(truth, domain, boundaries, experiments, 1)
    np.testing.assert_allclose(measured, expected, rtol=0, atol=0)


def test_inversion_returns_fields_from_measured_phasors():
    payload = request_payload()
    forward = analyze(AnalyzeRequest.model_validate(payload))
    payload["observations"] = [
        {"testId": item["testId"], "wellId": item["observationWellId"],
         "real": item["predicted"]["real"], "imag": item["predicted"]["imag"]}
        for item in forward["pairs"]
    ]
    payload["analysisMode"] = "measured_inversion"
    inverse = analyze(AnalyzeRequest.model_validate(payload))
    assert inverse["mode"] == "inversion"
    assert inverse["iterations"] >= 1
    assert len(inverse["fields"]["lnK"]) == 5
    assert max(item["residualAmplitude"] for item in inverse["pairs"]) < 1e-3


def test_black_kipp_returns_analytical_comparison():
    payload = request_payload()
    payload["testCase"] = "black_kipp"
    result = analyze(AnalyzeRequest.model_validate(payload))
    assert result["mode"] == "forward"
    assert all(math.isfinite(item["analytical"]["amplitude"]) for item in result["pairs"])
    assert all(0 <= item["phaseErrorDegrees"] <= 180 for item in result["pairs"])
    assert all(math.isfinite(item["effectiveProperties"]["transmissivityM2PerSecond"]) for item in result["pairs"])
    payload["observations"] = []
    with pytest.raises(ValidationError, match="forward-model comparison"):
        AnalyzeRequest.model_validate(payload)


def test_black_kipp_p10_matches_300_by_300_baseline():
    """Guard the direct P=10/W2 values from the translated MATLAB example."""
    payload = request_payload()
    payload.update({
        "testCase": "black_kipp",
        "minX": -300,
        "maxX": 300,
        "minY": -300,
        "maxY": 300,
        "gridNx": 300,
        "gridNy": 300,
        "initialLnK": math.log(3e-4),
        "initialLnSs": math.log(1e-5),
        "wells": [
            {"id": "w-1", "name": "W1", "x": 0, "y": 0},
            {"id": "w-2", "name": "W2", "x": 0, "y": 30},
        ],
        "tests": [{
            "id": "period-1", "name": "P = 10 s", "pumpingWellId": "w-1",
            "observationWellIds": ["w-2"], "pumpingPeriod": 10, "pumpingRate": 0.001,
        }],
        "boundaries": {"west": "constant_head", "east": "constant_head", "south": "constant_head", "north": "constant_head", "top": "no_flow", "bottom": "no_flow"},
    })
    pair = analyze(AnalyzeRequest.model_validate(payload))["pairs"][0]
    assert pair["predicted"]["real"] == pytest.approx(-0.013843188100569937, rel=1e-10)
    assert pair["predicted"]["imag"] == pytest.approx(0.003921367395389121, rel=1e-10)
    assert pair["predicted"]["amplitude"] == pytest.approx(0.014387876112803514, rel=1e-10)
    assert pair["numericalPhaseDegrees"] == pytest.approx(195.81586356220473, rel=1e-10)
    assert pair["analytical"]["amplitude"] == pytest.approx(0.014520175444200966, rel=1e-10)
    assert pair["analytical"]["phaseDegrees"] == pytest.approx(197.39087099732427, rel=1e-10)


def test_large_grid_is_reserved_for_black_kipp_forward_baseline():
    payload = request_payload()
    payload["gridNx"] = payload["gridNy"] = 61
    with pytest.raises(ValidationError, match="inversion grids"):
        AnalyzeRequest.model_validate(payload)
    payload["testCase"] = "black_kipp"
    assert AnalyzeRequest.model_validate(payload).gridNx == 61


def test_job_reports_real_completion_events():
    import time

    client = TestClient(app)
    job_id = client.post("/api/v1/jobs", json=request_payload()).json()["jobId"]
    for _ in range(100):
        state = client.get(f"/api/v1/jobs/{job_id}").json()
        if state["status"] in ("complete", "failed"):
            break
        time.sleep(0.05)
    assert state["status"] == "complete", state["error"]
    assert state["completedTestIds"] == ["t1", "t2"]
    assert len(state["result"]["pairs"]) == 3


def test_inverse_progress_reports_solver_iterations():
    payload = request_payload()
    forward = analyze(AnalyzeRequest.model_validate(payload))
    payload["observations"] = [
        {"testId": item["testId"], "wellId": item["observationWellId"],
         "real": item["predicted"]["real"], "imag": item["predicted"]["imag"]}
        for item in forward["pairs"]
    ]
    payload["analysisMode"] = "measured_inversion"
    stages = []
    analyze(AnalyzeRequest.model_validate(payload), lambda stage, percent, test_id, message: stages.append((stage, percent, test_id)))
    assert [item[2] for item in stages if item[0] == "forward" and item[2] is not None] == ["t1", "t1", "t2", "t2"]
    assert any(item[0] == "inversion" for item in stages)
    assert stages[-1][:2] == ("complete", 100)


def test_inverse_job_serializes_estimated_field():
    import time

    payload = request_payload()
    forward = analyze(AnalyzeRequest.model_validate(payload))
    payload["observations"] = [
        {"testId": item["testId"], "wellId": item["observationWellId"],
         "real": item["predicted"]["real"], "imag": item["predicted"]["imag"]}
        for item in forward["pairs"]
    ]
    payload["analysisMode"] = "measured_inversion"
    client = TestClient(app)
    job_id = client.post("/api/v1/jobs", json=payload).json()["jobId"]
    for _ in range(100):
        state = client.get(f"/api/v1/jobs/{job_id}").json()
        if state["status"] in ("complete", "failed"):
            break
        time.sleep(0.05)
    assert state["status"] == "complete", state["error"]
    assert state["result"]["mode"] == "inversion"
    assert len(state["result"]["fields"]["lnK"]) == payload["gridNy"]


def test_synthetic_demo_returns_full_scientific_diagnostics():
    payload = request_payload()
    payload["analysisMode"] = "synthetic_demo"
    result = analyze(AnalyzeRequest.model_validate(payload))
    assert result["mode"] == "inversion"
    assert result["analysisMode"] == "synthetic_demo"
    assert len(result["trueFields"]["lnK"]) == payload["gridNy"]
    assert len(result["fields"]["lnSs"]) == payload["gridNy"]
    assert len(result["errorFields"]["lnK"]) == payload["gridNy"]
    assert len(result["sensitivityFields"]["lnSs"]) == payload["gridNy"]
    assert result["objectiveHistory"]
    assert math.isfinite(result["diagnostics"]["lnKFieldRmse"])
