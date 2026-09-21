# oscillatory-tomography
Code for reading, importing, analysis of oscillatory hydraulic tomography field data, and for numerical tests

## Python transcription

The MATLAB source now has a Python counterpart in `src/oscillatory_tomography`
and `examples`. The professor-approved `P = 10` inversion is the primary
cross-language reference. The original MATLAB files are unchanged. NumPy and
SciPy natively support the complex-valued dense and sparse matrix operations
used by the phasor model.

From PowerShell:

```powershell
py -3.10 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[test,benchmark]"
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe examples\testing_inversion_2d_geostat.py
.\.venv\Scripts\python.exe examples\testing_multifreq_analyt_blackkipp_comparison.py
.\.venv\Scripts\python.exe examples\testing_sensitivity_fd_comparison.py
```

Use `--skip-inversion` for a quick forward-model-only run. Generated figures
are written under `python_outputs/`, which is intentionally ignored by Git.

The regression tests read `testing_inversion_currtest.mat` and compare Python
against the saved MATLAB inputs, observations, fields, and sensitivities.
See `docs/MATLAB_BASELINE.md` for validation results and known limitations.
See `docs/PYTHON_PORT_STATUS.md` for the file-by-file translation map.
See `docs/PERFORMANCE_BENCHMARK.md` for MATLAB/Python correctness, CPU-time,
wall-time, memory, and optimization measurements.
See `docs/SCALING_BENCHMARK.md` for the 1,250-to-80,000-parameter inversion
scaling and peak-memory comparison.
