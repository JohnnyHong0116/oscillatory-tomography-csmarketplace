# Oscillatory Tomography — Python Port

This branch contains the open-source Python transcription of the oscillatory
hydraulic tomography MATLAB project. It includes the forward phasor model,
analytic sensitivities, geostatistical inversion routines, covariance tools,
and Python versions of the three original testing workflows.

NumPy and SciPy handle the complex-valued dense and sparse matrix operations
directly. MATLAB/Fortran array ordering is preserved explicitly where model
grids are reshaped or flattened.

## Requirements

- Python 3.10 or newer
- Approximately 1 GB of free disk space for Python and scientific packages
- Additional memory is required when generating the optional full
  90,000-cell Black–Kipp fields

MATLAB is not required on this branch.

## Installation

Clone this branch and enter the repository:

```powershell
git clone --branch python-port https://github.com/JohnnyHong0116/oscillatory-tomography-csmarketplace.git
cd oscillatory-tomography-csmarketplace
```

On Windows PowerShell:

```powershell
py -3.10 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e ".[test]"
```

On macOS or Linux:

```bash
python3 -m venv .venv
./.venv/bin/python -m pip install --upgrade pip
./.venv/bin/python -m pip install -e '.[test]'
```

## Verify the installation

Windows:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

macOS or Linux:

```bash
./.venv/bin/python -m pytest -q
```

The test suite checks grid ordering, interpolation, covariance operations,
complex forward modeling, analytic sensitivities, specialized wrappers, and
the complete 26-file MATLAB-to-Python function manifest.

## Run the translated workflows

The following commands use Windows PowerShell. Replace
`.\.venv\Scripts\python.exe` with `./.venv/bin/python` on macOS or Linux.

### 1. Two-dimensional geostatistical inversion

Run the professor-selected `P = 10 s` case:

```powershell
.\.venv\Scripts\python.exe examples\testing_inversion_2d_geostat.py
```

For a quick forward-model check without inversion:

```powershell
.\.venv\Scripts\python.exe examples\testing_inversion_2d_geostat.py --skip-inversion
```

Run all seven pumping periods from the current workflow:

```powershell
.\.venv\Scripts\python.exe examples\testing_inversion_2d_geostat.py --all-periods
```

The comparison image is saved under `python_outputs/`.

### 2. Black–Kipp analytical comparison

```powershell
.\.venv\Scripts\python.exe examples\testing_multifreq_analyt_blackkipp_comparison.py
```

The command reports runtime, amplitude error, phase error, and the observation
norm, and writes comparison plots under `python_outputs/`. The optional
`--include-fields` flag also calculates the original full phasor fields. Use
`--workers N` to process independent frequency groups concurrently.

### 3. Adjoint versus finite-difference sensitivities

Run a representative check of both `ln(K)` and `ln(Ss)` columns:

```powershell
.\.venv\Scripts\python.exe examples\testing_sensitivity_fd_comparison.py
```

The exhaustive original experiment perturbs all 16,200 parameters and can take
a long time. Run it only when needed:

```powershell
.\.venv\Scripts\python.exe examples\testing_sensitivity_fd_comparison.py --all-columns --workers 4
```

## Repository layout

- `src/oscillatory_tomography/` — reusable forward, inversion, covariance,
  grid, model, and utility modules
- `examples/` — Python translations of the three top-level MATLAB workflows
- `tests/` — portable unit and numerical finite-difference tests
- `src/oscillatory_tomography/port_manifest.py` — mapping of all 26 original
  MATLAB filenames to their Python entry points
- `pyproject.toml` — package metadata and dependencies

## Scope notes

The scientific K/Ss workflow is transcribed. The original experimental `Sy`
branch was labelled beta, unverified, and unsupported, so it is not exposed.
The unused `leaks` field and MATLAB interface operations such as workspace
clearing, pauses, and figure handles are also outside the Python API. Plotting
is implemented with Matplotlib and generated files are ignored by Git.
