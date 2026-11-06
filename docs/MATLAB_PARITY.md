# MATLAB numerical agreement — v1.5.1

The supplied web examples are checked against **actual MATLAB runs**, using
MATLAB R2026a Update 5 and upstream scientific routines pinned to
`7aa7146ec4d7dce63f0a4a6922ed458d6df56d5f`. This is independent verification,
not comparison between two calls to the Python implementation.

## Verified scope

| Web case | MATLAB reference | What is compared |
| --- | --- | --- |
| Black–Kipp | Original 300×300, 20 periods, 80 responses | Complex drawdown responses, amplitude, circular phase, analytical amplitude |
| P=10 checkerboard | Professor-selected P=10 subset; original 50×50 grid and 36 pairs | Truth, generated responses, recovered ln(K)/ln(Ss), fitted responses, objective and sensitivity coverage |
| Original 3D configuration | Original 20³ grid, 27 ports, four periods, 104 tests / 1,404 responses | Exact MATLAB truth and all complex forward responses |
| Quick 3D recovery | Same explicitly reduced 8³ / W14 / 14-observer configuration run in MATLAB | Exact truth, generated responses, recovered fields, fitted responses, objective and sensitivity coverage |

**The quick case remains reduced. Full 8,000-cell / 1,404-response 3D inversion
is not implemented in the interactive web workflow, and is not claimed verified.**
The original 2D script's default seven-period acquisition is also not represented
as the professor-selected single-period P=10 case.

## Corrected mismatches

1. **Truth generation.** NumPy seed 0 is not MATLAB `randn('state',0)`. The two
   3D presets now load the exact MATLAB-generated truth input arrays for their
   matching meshes. Python still computes every response and inverse estimate;
   saved MATLAB estimates are used only as independent test references. Custom
   NumPy realizations remain available and are labeled separately. A reference
   field cannot silently be resized, reseeded, or applied to another domain.
2. **Prior-objective tolerance.** `NLAP_eval.m` uses MATLAB MINRES's relative
   residual contract, `||b-Qx|| / ||b|| <= 1e-4`. SciPy's `minres(rtol=1e-4)`
   instead uses a backward-error test and stopped early. The Python adapter now
   explicitly checks the requested relative residual, retaining the existing
   quasi-linear inversion and line search. This corrected the P=10 objective
   from approximately 16.291 to approximately **16.841**, matching MATLAB.
3. **Sign and phase comparison.** The original Black–Kipp script pumps at
   negative Q, then negates physical heads to form its displayed drawdown
   (`synth_data`). Web positive amplitudes are compared with this drawdown, not
   with the opposite-signed intermediate physical-head vector. Phase differences
   are circular and computed from complex values, not rounded plot labels.

## Acceptance criteria

Floating-point sparse factorization, FFTs, Krylov iteration and nonlinear line
searches are not bit-identical across MATLAB and SciPy. Tests use explicit
tolerances tied to the original inversion's 1e-3 stopping tolerances:

| Quantity | Forward runs | Inversion runs |
| --- | --- | --- |
| Complex-response relative L2 error | ≤1e-9 | ≤1e-4 |
| Worst circular phase error | ≤1e-6 degrees | ≤0.01 degrees |
| Worst relative amplitude error | ≤1e-8 | ≤1e-3 |
| Truth arrays | Identical values | Identical values |
| Recovered-field relative L2 error | N/A | ≤1e-5 |
| Worst recovered ln-property error | N/A | ≤1e-3 |
| Objective relative error | N/A | ≤1e-4 |
| Worst log sensitivity-coverage error | N/A | ≤1e-3 |

The compared 3D forward result had relative response error approximately
**1.2e-15**. Compared inversion runs had worst phase error below **0.004°**.
Their worst ln-property differences were approximately **1.5e-4** (P=10) and
**6.5e-4** (quick 3D), with whole-field relative L2 errors below **8e-6**.
These are numerical agreement statements, not claims of exact binary equality,
field validation or well-resolved recovery everywhere in the domain.

## Reproduction and regression

From the repository root, with licensed MATLAB available:

```powershell
matlab -batch "addpath('matlab'); generate_web_references"
.\.venv\Scripts\python.exe scripts/pack_matlab_references.py
.\.venv\Scripts\python.exe scripts/generate_web_3d_examples.py
.\.venv\Scripts\python.exe scripts/verify_matlab_examples.py
```

MATLAB is **not** required to run the app or regression tests: the compact
reference `.mat` outputs are committed under `matlab/generated`, and only truth
inputs are packaged under `src/oscillatory_tomography/data`. `matlab/SOURCE.json`
records source/artifact hashes, source revision and MATLAB version. Upstream
`.m` files are retained unmodified in `matlab/reference`, with author credits.

`tests/test_matlab_parity.py` recomputes all four cases through the same API
adapter used by React, checks every response, and also checks the shipped 3D
preview artifacts. The complete P=10 solve makes this suite slower than ordinary
unit tests. `scripts/verify_matlab_examples.py` writes a numerical error report
and exits with an assertion failure if a criterion is exceeded.

Results from the corrected solver carry `solverRevision: matlab-parity-1`.
Previews were regenerated. Older saved results are historical outputs: rerun
them before claiming agreement with the corrected solver. Changes to geometry,
periods, amplitudes, priors, boundaries, or generating fields define a different
experiment; matching an unchanged preset does not validate arbitrary user inputs.
