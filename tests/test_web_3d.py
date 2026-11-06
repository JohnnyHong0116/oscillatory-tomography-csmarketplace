"""3D web adapter checks against the existing n-dimensional solver, not a mock.

Upstream scientific reference: wischydro-cardiff/oscillatory-tomography,
7aa7146, testing_inversion_3D_geostat.m. Full MATLAB experiment is larger than
the interactive API budget; these checks do not claim exact baseline parity.
"""
import numpy as np
import pytest
from pydantic import ValidationError

from oscillatory_tomography.api import AnalyzeRequest, analyze
from oscillatory_tomography.forward import run_distributed_k_ss
from oscillatory_tomography.grid import create_inputs, plaid_cellcenter_coord
from oscillatory_tomography.models import Domain, Boundaries
from oscillatory_tomography.synthetic import synthetic_parameters


def payload():
    return dict(dimension=3, minX=-40, maxX=40, minY=-40, maxY=40,
                minZ=-40, maxZ=40, gridNx=4, gridNy=5, gridNz=3,
                wells=[dict(id="a", name="A", x=0, y=0, z=-20),
                       dict(id="b", name="B", x=0, y=0, z=20),
                       dict(id="c", name="C", x=20, y=20, z=0)],
                tests=[dict(id="t1", name="P=10 first", pumpingWellId="a", observationWellIds=["b","c"], pumpingPeriod=10, pumpingRate=.001),
                       dict(id="t2", name="P=10 second", pumpingWellId="b", observationWellIds=["a"], pumpingPeriod=10, pumpingRate=.002)],
                boundaries={side:"constant_head" for side in ["west","east","south","north","top","bottom"]},
                initialLnK=-9, initialLnSs=-11, dataErrorVar=1e-8,
                corrLengthX=15, corrLengthY=15, corrLengthZ=5, maxIterations=2)


def test_3d_api_matches_existing_solver_and_respects_depth_and_linear_rate():
    p=payload()
    r=analyze(AnalyzeRequest.model_validate(p))
    domain=Domain(np.linspace(-40,40,5),np.linspace(-40,40,6),np.linspace(-40,40,4))
    wells=np.array([[0,0,-20],[0,0,20],[20,20,0]])
    rows=np.array([[2*np.pi/10,1,.001,2],[2*np.pi/10,1,.001,3],[2*np.pi/10,2,.002,1]])
    exps=create_inputs(wells,rows,domain)
    values=run_distributed_k_ss(np.r_[np.full(60,-9),np.full(60,-11)],domain,Boundaries(np.ones(6),np.zeros(6)),exps)
    np.testing.assert_allclose([x["predicted"]["real"] for x in r["pairs"]],values[:3],rtol=1e-12)
    np.testing.assert_allclose([x["predicted"]["imag"] for x in r["pairs"]],values[3:],rtol=1e-12)
    assert r["pairs"][0]["distanceMeters"] == 40
    assert r["grid"]==dict(nx=4,ny=5,nz=3)
    # Reciprocity + twice the source rate, even with vertically separated ports.
    np.testing.assert_allclose(values[2],2*values[0],rtol=1e-12)


@pytest.mark.parametrize("kind",["checkerboard","geostatistical"])
def test_3d_truth_volumes_and_joint_inversion_are_finite(kind):
    p=payload();p.update(syntheticField=kind,syntheticSeed=42)
    r=analyze(AnalyzeRequest.model_validate(p))
    volume=np.array(r["volumeFields"]["trueFields"]["lnK"])
    assert volume.shape==(3,5,4)
    np.testing.assert_array_equal(volume[1],r["trueFields"]["lnK"])
    assert r["pairs"][0]["measured"] is None
    p["analysisMode"]="synthetic_demo"
    inverted=analyze(AnalyzeRequest.model_validate(p))
    assert inverted["mode"]=="inversion"
    for group in ["fields","trueFields","errorFields","sensitivityFields"]:
        for prop in ["lnK","lnSs"]:
            v=np.array(inverted["volumeFields"][group][prop])
            assert v.shape==(3,5,4) and np.isfinite(v).all()
    assert np.isfinite(inverted["objective"])
    for prop,metric in [("lnK","lnKFieldRmse"),("lnSs","lnSsFieldRmse")]:
        error=np.array(inverted["volumeFields"]["errorFields"][prop])
        np.testing.assert_allclose(inverted["diagnostics"][metric],np.sqrt(np.mean(error**2)))


def test_upstream_3d_checkerboard_formula_and_vertical_correlation():
    d=Domain(np.linspace(-40,40,9),np.linspace(-40,40,9),np.linspace(-40,40,9))
    coords,_=plaid_cellcenter_coord(d)
    checker=np.prod(np.sign(np.sin(np.pi*coords/15)),axis=1)
    expected=np.r_[-9.2+checker,-11.2+.05*checker]
    np.testing.assert_allclose(synthetic_parameters(d,"checkerboard"),expected)
    np.testing.assert_array_equal(synthetic_parameters(d,"geostatistical",8),synthetic_parameters(d,"geostatistical",8))
    assert not np.array_equal(synthetic_parameters(d,"geostatistical",8),synthetic_parameters(d,"geostatistical",9))


def test_3d_boundaries_z_limits_and_capacity_are_validated():
    p=payload();p["testCase"]="black_kipp"
    with pytest.raises(ValidationError,match="2D"):
        AnalyzeRequest.model_validate(p)
    p=payload();p["wells"][0]["z"]=-40
    with pytest.raises(ValidationError,match="Z coordinates"):
        AnalyzeRequest.model_validate(p)
    p=payload();p.update(gridNx=30,gridNy=30,gridNz=20)
    with pytest.raises(ValidationError,match="8000-cell"):
        AnalyzeRequest.model_validate(p)
    p=payload();p.update(gridNx=20,gridNy=20,gridNz=10,analysisMode="synthetic_demo")
    with pytest.raises(ValidationError,match="3600-cell"):
        AnalyzeRequest.model_validate(p)
    p=payload();p["boundaries"]={k:"no_flow" for k in p["boundaries"]};p["boundaries"]["top"]="constant_head"
    assert analyze(AnalyzeRequest.model_validate(p))["dimension"]==3
