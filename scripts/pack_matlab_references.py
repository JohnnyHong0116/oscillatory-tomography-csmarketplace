"""Package MATLAB-generated truth inputs with traceable reference provenance.

Run after matlab/generate_web_references.m. Estimates remain in MATLAB .mat
fixtures for independent comparisons; only truth inputs ship inside the solver.
"""
from pathlib import Path
import hashlib
import json
import numpy as np
from scipy.io import loadmat

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"src/oscillatory_tomography/data"
PIN="7aa7146ec4d7dce63f0a4a6922ed458d6df56d5f"


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    manifest=dict(sourceCommit=PIN,rng="MATLAB randn('state',0)",fields={})
    for n,tag in [(20,"matlab3d_full"),(8,"matlab3d_quick")]:
        reference=loadmat(ROOT/"matlab/generated"/f"{tag}.mat",simplify_cells=True)
        np.savez_compressed(OUT/f"matlab_truth_{n}.npz",truth=reference["truth"])
        manifest["matlabVersion"]=reference["matlab_version"]
        manifest["fields"][str(n)]=dict(sha256=hashlib.sha256((OUT/f"matlab_truth_{n}.npz").read_bytes()).hexdigest(),count=len(reference["truth"]))
    (OUT/"matlab_reference.json").write_text(json.dumps(manifest,indent=2)+"\n")
    hashes={str(p.relative_to(ROOT/"matlab")):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((ROOT/"matlab/reference").glob("*.m"))}
    hashes.update({str(p.relative_to(ROOT/"matlab")):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((ROOT/"matlab/generated").glob("*.mat"))})
    (ROOT/"matlab/SOURCE.json").write_text(json.dumps(dict(upstream="https://github.com/wischydro-cardiff/oscillatory-tomography",commit=PIN,matlabVersion=manifest["matlabVersion"],sha256=hashes),indent=2)+"\n")
