"""v1.4 field selection must match the two original Python/MATLAB branches."""

import numpy as np
import pytest
from pydantic import ValidationError

from examples.testing_inversion_2d_geostat import build_case
from oscillatory_tomography.api import AnalyzeRequest, analyze
from oscillatory_tomography.synthetic import synthetic_parameters
from test_api import request_payload


@pytest.mark.parametrize("kind", ["checkerboard", "geostatistical"])
@pytest.mark.parametrize("cells", [7, 50])
def test_field_matches_transcribed_example_exactly(kind, cells):
    case = build_case(truth=kind, grid_cells=cells)
    actual = synthetic_parameters(case["domain"], kind, seed=0)
    np.testing.assert_array_equal(actual, case["true_parameters"])
    assert actual.size == 2 * cells * cells


def test_geostatistical_seed_is_deterministic_and_changes_realization():
    domain = build_case(grid_cells=6)["domain"]
    a = synthetic_parameters(domain, "geostatistical", 42)
    np.testing.assert_array_equal(a, synthetic_parameters(domain, "geostatistical", 42))
    assert not np.array_equal(a, synthetic_parameters(domain, "geostatistical", 43))
    assert np.all(np.isfinite(a))


@pytest.mark.parametrize("kind", ["checkerboard", "geostatistical"])
def test_synthetic_forward_can_be_transferred_without_fabricated_measurements(kind):
    payload = request_payload()
    payload.update(syntheticField=kind, syntheticSeed=0)
    source = analyze(AnalyzeRequest.model_validate(payload))
    assert source["mode"] == "forward"
    assert source["syntheticTruth"]["kind"] == kind
    assert source["syntheticTruth"]["seed"] == (0 if kind == "geostatistical" else None)
    assert source["trueFields"] is not None
    assert source["fields"] is None
    assert source["diagnostics"] is None
    assert all(p["measured"] is None and p["residualAmplitude"] is None for p in source["pairs"])
    # Imported inversion is a different data contract: transfer raw heads, not
    # an instruction to regenerate or secretly substitute a new random field.
    payload.update(analysisMode="measured_inversion", syntheticField=None,
                   observations=[dict(testId=p["testId"], wellId=p["observationWellId"],
                                      real=p["predicted"]["real"], imag=p["predicted"]["imag"])
                                 for p in source["pairs"]])
    inverse = analyze(AnalyzeRequest.model_validate(payload))
    assert inverse["syntheticTruth"] is None
    assert inverse["trueFields"] is None
    for a, b in zip(source["pairs"], inverse["pairs"]):
        assert b["measured"] == {k: a["predicted"][k] for k in ("real", "imag")}


def test_geostatistical_demo_returns_truth_errors_and_metadata():
    payload = request_payload()
    payload.update(analysisMode="synthetic_demo", syntheticField="geostatistical", syntheticSeed=12)
    result = analyze(AnalyzeRequest.model_validate(payload))
    assert result["mode"] == "inversion"
    assert result["syntheticTruth"]["seed"] == 12
    assert result["fields"] and result["trueFields"] and result["errorFields"]
    assert all(np.isfinite(result["diagnostics"][key]) for key in ("lnKFieldRmse", "lnSsFieldRmse"))


@pytest.mark.parametrize("seed", [-1, 0.5, 4294967296])
def test_invalid_random_seeds_rejected(seed):
    with pytest.raises(ValidationError):
        AnalyzeRequest.model_validate({**request_payload(), "syntheticSeed": seed})


def test_black_kipp_cannot_compare_heterogeneous_truth_with_homogeneous_analytic():
    with pytest.raises(ValidationError, match="Synthetic truth fields"):
        AnalyzeRequest.model_validate({**request_payload(), "testCase": "black_kipp", "syntheticField": "geostatistical"})
