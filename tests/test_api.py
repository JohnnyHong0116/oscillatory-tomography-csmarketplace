"""Contract and solver integration checks for the React-facing API."""

import math

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from oscillatory_tomography.api import AnalyzeRequest, analyze, app


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
    payload["observations"] = [{"testId": "t1", "wellId": "b", "real": 0, "imag": 0}]
    with pytest.raises(ValidationError, match="exactly one"):
        AnalyzeRequest.model_validate(payload)


def test_well_at_unreachable_edge_is_rejected():
    payload = request_payload()
    payload["wells"][0]["x"] = 0
    with pytest.raises(ValidationError, match="outer grid cell centers"):
        AnalyzeRequest.model_validate(payload)


def test_inversion_returns_fields_from_measured_phasors():
    payload = request_payload()
    forward = analyze(AnalyzeRequest.model_validate(payload))
    payload["observations"] = [
        {"testId": item["testId"], "wellId": item["observationWellId"],
         "real": item["predicted"]["real"], "imag": item["predicted"]["imag"]}
        for item in forward["pairs"]
    ]
    inverse = analyze(AnalyzeRequest.model_validate(payload))
    assert inverse["mode"] == "inversion"
    assert inverse["iterations"] >= 1
    assert len(inverse["fields"]["lnK"]) == 5
    assert max(item["residualAmplitude"] for item in inverse["pairs"]) < 1e-3
