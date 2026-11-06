"""Compare real web-adapter solves with frozen output from original MATLAB code.

Run after ``matlab -batch "addpath('matlab'); generate_web_references"`` to
regenerate the references, or use the committed small .mat outputs without a
MATLAB runtime. This script never substitutes stored estimates for Python solves.
"""
from pathlib import Path
import argparse
import json
from datetime import datetime, timezone

import numpy as np
from scipy.io import loadmat

from oscillatory_tomography.api import AnalyzeRequest, analyze

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "web/src/data"
GOLD = ROOT / "matlab/generated"


def configuration(case):
    if case in ("matlab3d_full", "matlab3d_quick"):
        return json.loads((DATA / ("matlab3dConfig.json" if case.endswith("full") else "matlab3dQuickConfig.json")).read_text(encoding="utf-8"))
    base = json.loads((DATA / "matlab3dQuickConfig.json").read_text())
    base.update(dimension=2,syntheticRealization="numpy",syntheticField="checkerboard",minX=-50,maxX=50,minY=-50,maxY=50,gridNx=50,gridNy=50)
    base["boundaries"].update(top="no_flow",bottom="no_flow")
    if case == "p10_checkerboard":
        base["wells"] = [dict(id=f"w-{i+1}",name=f"W{i+1}",x=x,y=y) for i,(x,y) in enumerate((x,y) for x in [-20,0,20] for y in [-20,0,20])]
        base["tests"] = [dict(id=f"t-{j+1}",name=f"Test {j+1}",pumpingWellId=f"w-{j+1}",observationWellIds=[f"w-{k+1}" for k in range(j+1,9)],pumpingPeriod=10,pumpingRate=.01*np.pi/10) for j in range(8)]
    else:
        base.update(testCase="black_kipp",minX=-300,maxX=300,minY=-300,maxY=300,gridNx=300,gridNy=300,initialLnK=np.log(3e-4),initialLnSs=np.log(1e-5),syntheticField=None)
        base["wells"] = [dict(id=f"w-{i+1}",name=f"W{i+1}",x=x,y=y) for i,(x,y) in enumerate([(0,0),(0,30),(60,0),(0,-90),(-120,0)])]
        base["tests"] = [dict(id=f"p-{i+1}",name=f"P {period:g}",pumpingWellId="w-1",observationWellIds=["w-2","w-3","w-4","w-5"],pumpingPeriod=period,pumpingRate=.001) for i,period in enumerate(np.logspace(1,4,20))]
    return base


def compute(case):
    c = configuration(case)
    payload = {k:v for k,v in c.items() if k in AnalyzeRequest.model_fields}
    payload["tests"] = [{k:v for k,v in t.items() if k != "status"} for t in c["tests"]]
    payload["analysisMode"] = "synthetic_demo" if case in ("p10_checkerboard","matlab3d_quick") else "forward"
    return analyze(AnalyzeRequest.model_validate(payload))


def vector(result, group):
    if result.get("dimension") == 3:
        fields = result["volumeFields"][group]
        return np.concatenate([np.array(fields[prop]).transpose(1,2,0).ravel(order="F") for prop in ["lnK","lnSs"]])
    return np.concatenate([np.array(result[group][prop]).ravel(order="F") for prop in ["lnK","lnSs"]])


def metrics(actual, expected):
    a, b = np.asarray(actual).reshape(-1), np.asarray(expected).reshape(-1)
    return dict(maxAbsolute=float(np.max(np.abs(a-b))),relativeL2=float(np.linalg.norm(a-b)/max(np.linalg.norm(b),np.finfo(float).tiny)))


def compare(case, result):
    reference = loadmat(GOLD / f"{case}.mat",simplify_cells=True)
    inverse = result["mode"] == "inversion"
    n=len(result["pairs"])
    actual=np.array([complex(p["predicted"]["real"],p["predicted"]["imag"]) for p in result["pairs"]])
    old=reference["predicted"][:n]+1j*reference["predicted"][n:]
    report=dict(case=case,matlabVersion=reference["matlab_version"],responses=n,predicted=metrics(actual,old))
    # Forward tolerance covers floating-point sparse factorization differences.
    # Inverse tolerances are below the original 1e-3 stopping tolerances: require
    # small whole-field error AND small worst-cell / phase / amplitude errors.
    assert report["predicted"]["relativeL2"] <= (1e-4 if inverse else 1e-9), report
    report["maxPhaseErrorDegrees"]=float(np.max(np.abs(np.angle(actual/old,deg=True))))
    report["maxRelativeAmplitudeError"]=float(np.max(np.abs(np.abs(actual)-np.abs(old))/np.abs(old)))
    assert report["maxPhaseErrorDegrees"] <= (.01 if inverse else 1e-6), report
    assert report["maxRelativeAmplitudeError"] <= (1e-3 if inverse else 1e-8), report
    if case != "black_kipp":
        report["truth"]=metrics(vector(result,"trueFields"),reference["truth"])
        assert report["truth"]["maxAbsolute"] == 0, report
    else:
        amp=np.array([p["analytical"]["amplitude"] for p in result["pairs"]])
        np.testing.assert_allclose(amp,np.abs(reference["analytical"]),rtol=1e-12,atol=1e-16)
    if inverse:
        measured=np.r_[[p["measured"]["real"] for p in result["pairs"]],[p["measured"]["imag"] for p in result["pairs"]]]
        report["observed"]=metrics(measured,reference["observed"])
        assert report["observed"]["relativeL2"] < 1e-9, report
        report["estimatedFields"]=metrics(vector(result,"fields"),reference["estimated"])
        assert report["estimatedFields"]["relativeL2"] <= 1e-5, report
        assert report["estimatedFields"]["maxAbsolute"] <= 1e-3, report
        report["objectiveRelativeError"]=abs(float(result["objective"])-reference["objective"])/abs(reference["objective"])
        assert report["objectiveRelativeError"] <= 1e-4, report
        report["coverage"]=metrics(vector(result,"sensitivityFields"),reference["coverage"])
        assert report["coverage"]["maxAbsolute"] <= 1e-3, report
    report["passed"]=True
    return report


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case",choices=["all","black_kipp","p10_checkerboard","matlab3d_full","matlab3d_quick"],default="all")
    parser.add_argument("--output",default="matlab/generated/parity_report.json")
    args=parser.parse_args()
    cases=["black_kipp","p10_checkerboard","matlab3d_full","matlab3d_quick"] if args.case=="all" else [args.case]
    reports=[]
    for case in cases:
        print(f"Computing and comparing {case}…",flush=True)
        reports.append(compare(case,compute(case)))
        print(json.dumps(reports[-1]),flush=True)
    Path(args.output).write_text(json.dumps(dict(generatedAt=datetime.now(timezone.utc).isoformat(),cases=reports),indent=2)+"\n")
