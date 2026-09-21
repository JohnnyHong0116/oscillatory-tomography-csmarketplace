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
.\.venv\Scripts\python.exe -m pip install -e ".[test,benchmark]"
```

On macOS or Linux:

```bash
python3 -m venv .venv
./.venv/bin/python -m pip install --upgrade pip
./.venv/bin/python -m pip install -e '.[test,benchmark]'
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

### 4. Grid scaling and peak-memory benchmark

This benchmark increases the number of cells along both axes. An `N×N` grid
contains `2N²` inversion parameters because every cell has `ln(K)` and
`ln(Ss)`. Each size runs in a fresh Python process while total resident memory
is sampled.

Run a short check first:

```powershell
.\.venv\Scripts\python.exe benchmarks\run_python_scaling.py --sizes 25 50
```

Run the complete scaling series used during development:

```powershell
.\.venv\Scripts\python.exe benchmarks\run_python_scaling.py --sizes 25 50 75 100 150 200
```

The script displays a table directly in the terminal. It also creates:

- `python_outputs/scaling/python_scaling_results.md` — readable results table
- `python_outputs/scaling/python_scaling_results.json` — complete raw results
- one intermediate JSON file for each grid size

The recorded columns include parameter count, Jacobian size, Jacobian runtime,
linearized-inverse runtime, total scientific runtime, and peak process memory.
The generated files are ignored by Git and can be safely deleted and recreated.

#### Recorded Python result

The following result was measured on Johnny's laptop on September 21, 2026:

- Windows 11
- Intel Core Ultra 9 185H
- 31.42 GiB system memory
- Python 3.10.11, NumPy 2.2.6, and SciPy 1.15.3
- Peak process-tree resident memory sampled every 10 ms

| Grid | Parameters | Jacobian shape | Raw Jacobian (MiB) | Peak RSS (MiB) | Jacobian (s) | Linear inverse (s) | Scientific total (s) |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 25×25 | 1,250 | 72×1,250 | 0.687 | 97.8 | 0.0929 | 0.0321 | 0.1466 |
| 50×50 | 5,000 | 72×5,000 | 2.747 | 109.1 | 0.3939 | 0.0717 | 0.5230 |
| 75×75 | 11,250 | 72×11,250 | 6.180 | 125.0 | 0.9363 | 0.4220 | 1.5912 |
| 100×100 | 20,000 | 72×20,000 | 10.986 | 150.2 | 2.1862 | 0.5998 | 3.6452 |
| 150×150 | 45,000 | 72×45,000 | 24.719 | 217.0 | 5.3119 | 3.4229 | 11.1422 |
| 200×200 | 80,000 | 72×80,000 | 43.945 | 329.1 | 11.3330 | 6.1468 | 24.0224 |

The scientific total includes setup, two forward calculations, construction
of the complete analytic Jacobian, and one linearized geostatistical inverse
step. Runtime and peak memory will vary with hardware, operating system, and
installed numerical libraries, so another machine should regenerate the table
with the command above.

To run one complete nonlinear inversion at a selected resolution instead:

```powershell
.\.venv\Scripts\python.exe examples\testing_inversion_2d_geostat.py --grid-cells 100
```

The cross-language MATLAB/Python benchmark is kept on the `dev` branch because
this branch intentionally contains no MATLAB files. After cloning, it can be
accessed with `git switch --track origin/dev`; see
`docs/SCALING_BENCHMARK.md` there for the MATLAB comparison command.

## Repository layout

- `src/oscillatory_tomography/` — reusable forward, inversion, covariance,
  grid, model, and utility modules
- `examples/` — Python translations of the three top-level MATLAB workflows
- `benchmarks/` — isolated Python scaling and peak-memory runner
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
