# MATLAB reference verification

`reference/*.m` are unmodified upstream sources from
`wischydro-cardiff/oscillatory-tomography` commit
`7aa7146ec4d7dce63f0a4a6922ed458d6df56d5f`. Original author comments and credit
are retained. `SOURCE.json` records source and generated-artifact SHA-256 values.
No proprietary MATLAB implementation source is distributed.

`generate_web_references.m` executes those routines headlessly with the web
example inputs. It omits plotting and huge whole-workspace saves. It exports:

- The original 3D acquisition's full 1,404-response forward run and MATLAB truth.
- The explicitly reduced 3D recovery, including estimated fields and sensitivities.
- The professor-selected P=10 subset of the 2D checkerboard example.
- The original Black–Kipp 300×300 / 20-period run and analytical response.

The Black–Kipp comparison uses drawdown: the original script negates physical
heads from a negative pumping rate before building `synth_data`. Web positive
amplitudes reproduce that displayed convention, not the opposite-signed
intermediate physical-head vector.

Regenerate using a licensed MATLAB installation, then package only the truth
inputs (PowerShell, repository root):

```powershell
matlab -batch "addpath('matlab'); generate_web_references"
.\.venv\Scripts\python.exe scripts/pack_matlab_references.py
.\.venv\Scripts\python.exe scripts/generate_web_3d_examples.py
.\.venv\Scripts\python.exe scripts/verify_matlab_examples.py
```

Python never uses saved MATLAB estimates as solver outputs. Its forward and
inverse calculations are compared against the independent `.mat` fixtures.
Numerical agreement is tolerance-based; floating-point sparse solves and
iterative optimization are not bit-identical across runtimes. See
`docs/MATLAB_PARITY.md` for scope and acceptance criteria.
