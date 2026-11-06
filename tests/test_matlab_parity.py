"""Independent MATLAB references, not Python-vs-Python self-consistency tests."""
import json
from pathlib import Path
import importlib.util
import hashlib

import numpy as np
import pytest
from scipy.sparse.linalg import LinearOperator, minres
from oscillatory_tomography.inversion import _relative_residual_minres
from oscillatory_tomography.synthetic import synthetic_parameters
from oscillatory_tomography.models import Domain

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("verify_matlab", ROOT/"scripts/verify_matlab_examples.py")
verify=importlib.util.module_from_spec(spec);spec.loader.exec_module(verify)


def test_reference_artifacts_and_upstream_sources_keep_recorded_hashes():
    source=json.loads((ROOT/"matlab/SOURCE.json").read_text())
    assert source["commit"]=="7aa7146ec4d7dce63f0a4a6922ed458d6df56d5f"
    for name,expected in source["sha256"].items():
        assert hashlib.sha256((ROOT/"matlab"/name).read_bytes()).hexdigest()==expected
    data=ROOT/"src/oscillatory_tomography/data"
    manifest=json.loads((data/"matlab_reference.json").read_text())
    for n in [8,20]:
        assert hashlib.sha256((data/f"matlab_truth_{n}.npz").read_bytes()).hexdigest()==manifest["fields"][str(n)]["sha256"]


def test_frozen_matlab_truth_rejects_silent_reseeding_or_mesh_changes():
    domain=Domain(*[np.linspace(-40,40,9)]*3)
    a=synthetic_parameters(domain,"geostatistical",0,"matlab_reference")
    a[0]+=100  # A caller cannot mutate the packaged realization through a view.
    assert not np.array_equal(a,synthetic_parameters(domain,"geostatistical",0,"matlab_reference"))
    with pytest.raises(ValueError):
        synthetic_parameters(domain,"geostatistical",1,"matlab_reference")
    with pytest.raises(ValueError):
        synthetic_parameters(Domain(*[np.linspace(-40,40,11)]*3),"geostatistical",0,"matlab_reference")


def test_matlab_minres_contract_uses_actual_relative_residual():
    diagonal=np.geomspace(.0001,1,80)
    rhs=np.random.default_rng(31).normal(size=80)
    operator=LinearOperator((80,80),matvec=lambda x:diagonal*x)
    default,_=minres(operator,rhs,rtol=1e-4,maxiter=10000)
    corrected=_relative_residual_minres(operator,rhs)
    assert np.linalg.norm(rhs-operator@default)/np.linalg.norm(rhs)>1e-4
    assert np.linalg.norm(rhs-operator@corrected)/np.linalg.norm(rhs)<=1e-4
    np.testing.assert_array_equal(_relative_residual_minres(operator,np.zeros(80)),np.zeros(80))
    with pytest.raises(RuntimeError):
        _relative_residual_minres(operator,rhs,maxiter=1)


@pytest.mark.parametrize("case",["black_kipp","p10_checkerboard","matlab3d_full","matlab3d_quick"])
def test_live_web_solver_matches_original_matlab_numerically(case):
    # Full P=10 inversion intentionally exercises the expensive nonlinear path.
    assert verify.compare(case,verify.compute(case))["passed"]


@pytest.mark.parametrize("case,file",[("matlab3d_full","matlab3dPreview.json"),("matlab3d_quick","matlab3dQuickPreview.json")])
def test_shipped_computed_preview_matches_matlab_reference(case,file):
    saved=json.loads((ROOT/"web/src/data"/file).read_text(encoding="utf-8"))
    assert verify.compare(case,saved["result"])["passed"]
