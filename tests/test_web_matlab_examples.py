"""Check actual saved preview inputs/results and the enlarged forward budget."""
from copy import deepcopy
import json
from pathlib import Path

import numpy as np
import pytest
from pydantic import ValidationError

from oscillatory_tomography.api import AnalyzeRequest, analyze

DATA = Path(__file__).resolve().parents[1] / "web/src/data"


def preview(quick=False):
    return json.loads((DATA / ("matlab3dQuickPreview.json" if quick else "matlab3dPreview.json")).read_text(encoding="utf-8"))


def request(config, mode="forward"):
    payload = {k: v for k, v in config.items() if k in AnalyzeRequest.model_fields}
    payload["tests"] = [{k: v for k, v in test.items() if k != "status"} for test in config["tests"]]
    return AnalyzeRequest.model_validate({**payload, "analysisMode": mode})


def test_original_matlab_configuration_and_saved_forward_are_complete():
    saved = preview()
    c, r = saved["config"], saved["result"]
    assert c == json.loads((DATA / "matlab3dConfig.json").read_text())
    req = request(c)
    assert (req.gridNx, req.gridNy, req.gridNz) == (20, 20, 20)
    assert len(c["wells"]) == 27 and len(c["tests"]) == 104
    assert {tuple(w[k] for k in ["x", "y", "z"]) for w in c["wells"]} == {
        (x,y,z) for x in [-20,0,20] for y in [-20,0,20] for z in [-20,0,20]}
    assert all(v == "constant_head" for v in c["boundaries"].values())
    for p in [5,10,50,100]:
        tests = [t for t in c["tests"] if t["pumpingPeriod"] == p]
        assert len(tests) == 26 and sum(len(t["observationWellIds"]) for t in tests) == 351
        assert all(t["pumpingRate"] == .01*np.pi/p for t in tests)
    assert r["mode"] == "forward" and r["fields"] is None
    assert len(r["pairs"]) == 1404
    assert np.array(r["volumeFields"]["trueFields"]["lnK"]).shape == (20,20,20)
    # Compare representative cached responses against fresh independent per-test
    # calls. This exercises the full-grid shared-period batching implementation.
    small = deepcopy(c)
    small["tests"] = [dict(c["tests"][0], observationWellIds=["w-2", "w-14", "w-27"]), c["tests"][-1]]
    fresh = analyze(request(small))
    lookup = {(p["testId"],p["observationWellId"]):p for p in r["pairs"]}
    for p in fresh["pairs"]:
        old = lookup[p["testId"],p["observationWellId"]]
        np.testing.assert_allclose([p["predicted"][k] for k in ["real","imag"]], [old["predicted"][k] for k in ["real","imag"]], rtol=1e-11, atol=1e-14)


def test_full_case_cannot_bypass_inverse_budget_or_enlarge_2d_budget():
    c = preview()["config"]
    with pytest.raises(ValidationError):
        request(c, "synthetic_demo")
    small = deepcopy(c)
    small.update(gridNx=8,gridNy=8,gridNz=8)
    with pytest.raises(ValidationError, match="30 pumping tests"):
        request(small, "synthetic_demo")
    small.update(dimension=2, syntheticRealization="numpy")
    with pytest.raises(ValidationError, match="30 pumping tests"):
        request(small)


def test_reduced_recovery_is_explicit_and_contains_real_inversion_outputs():
    saved = preview(True)
    c, r = saved["config"], saved["result"]
    assert c == json.loads((DATA / "matlab3dQuickConfig.json").read_text())
    request(c, "synthetic_demo")
    assert c["examplePreset"] == "matlab_3d_quick"
    assert (c["gridNx"],c["gridNy"],c["gridNz"]) == (8,8,8)
    assert len(c["wells"]) == 27 and len(c["tests"]) == 4
    assert {t["pumpingPeriod"] for t in c["tests"]} == {5,10,50,100}
    assert all(t["pumpingWellId"]=="w-14" and len(t["observationWellIds"])==14 for t in c["tests"])
    assert len(r["pairs"]) == 56 and r["mode"] == "inversion"
    assert r["iterations"] > 0 and r["objectiveHistory"]
    assert all(p["measured"] is not None for p in r["pairs"])
    for group in ["fields","trueFields","errorFields","sensitivityFields"]:
        assert np.isfinite(np.array(r["volumeFields"][group]["lnK"])).all()
        assert np.array(r["volumeFields"][group]["lnK"]).shape == (8,8,8)
    assert "not the full MATLAB baseline" in saved["provenance"]["note"]
