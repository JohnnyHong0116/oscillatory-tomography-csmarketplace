# Key Result 3: correctness and performance benchmark

Benchmark date: 2026-09-15

## Conclusion

Key Result #3 is complete for the supported Python port. All three supplied
scientific test workflows run without MATLAB, produce results consistent with
the MATLAB baselines, and now have reproducible timing measurements. The first
optimization—reusing frequency-independent sparse matrices and parallelizing
independent frequency or finite-difference solves—has also been implemented and
measured.

## Benchmark system

- OS: Windows 11 Home, build 10.0.26200
- CPU: Intel Core Ultra 9 185H, 16 physical cores / 22 logical processors
- Memory: 31.42 GiB
- MATLAB: R2026a Update 5, Deep Learning Toolbox 26.1
- Python: 3.10.11
- NumPy: 2.2.6
- SciPy: 1.15.3
- Matplotlib: 3.10.9

Wall time is elapsed real time. CPU time is total process CPU time and can be
greater than wall time when native numerical libraries use several cores.
Python peak memory is resident set size sampled every 10 ms. Long scientific
runs use one deterministic measured repetition; these numbers are initial
engineering benchmarks, not hardware-independent performance requirements.

## Correctness comparison

### Professor-approved P=10 reference workspace

| Output | Shape | Maximum absolute difference | Relative L2/Frobenius difference |
|---|---:|---:|---:|
| Experiment source/observation weights | 2,500 × 8 | `0` | `0` |
| Real/imaginary observations | 72 | `5.2042e-17` | `1.0356e-15` |
| Full real/imaginary phasor fields | 5,000 × 8 | `4.4409e-15` | `5.2289e-16` |
| Initial sensitivity/Jacobian | 72 × 5,000 | `3.8116e-21` | `6.2996e-16` |
| Final inversion parameters | 5,000 | `1.8241e-4` | `7.3733e-6` |

The saved Jacobian was produced at homogeneous `ln(K) = -9`, `ln(Ss) = -9`;
that actual saved state is used for the comparison. Selected Jacobian columns
also agree with centered finite differences to relative error below `3.0e-10`.

### Current seven-period inversion

This comparison uses newly generated arrays from both programs for periods 10,
50, 100, 200, 400, 800, and 1,600 seconds.

| Output | Shape | Maximum absolute difference | Relative L2/Frobenius difference |
|---|---:|---:|---:|
| Real/imaginary observations | 504 | `7.3552e-16` | `4.7767e-15` |
| Final inversion parameters | 5,000 | `1.7818e-3` | `2.2417e-5` |
| Final local Jacobian | 504 × 5,000 | `2.6309e-6` | `2.9446e-4` |
| Drift coefficients (`beta`) | 2 | `2.3972e-1` | `2.1907e-2` |

- MATLAB `norm(sim_obs)`: `0.8608502430294999`
- Python `norm(sim_obs)`: `0.8608502430294980`
- MATLAB `norm(params_best)`: `728.3721823748339`
- Python `norm(params_best)`: `728.3725206232696`
- MATLAB final NLAP: `83.52981126239825`
- Python final NLAP: `76.95820164085976`

The forward data are equivalent to floating-point precision. The final
parameter field differs by about `0.00224%` in relative norm. MATLAB and SciPy
use different MINRES and Nelder-Mead implementations, so the nonlinear search
does not follow the same intermediate path; Python reaches a lower evaluated
objective while retaining a closely matching parameter field.

### Black-Kipp analytical comparison

| Metric | MATLAB | Python | Absolute difference |
|---|---:|---:|---:|
| Mean relative amplitude error | `0.01704868784026244` | `0.01704868784027780` | `1.54e-14` |
| Mean absolute phase error (rad) | `0.03543831910339505` | `0.03543831910339203` | `3.02e-15` |
| `norm(sim_obs)` | `3.667067762239188` | `3.667067762238992` | `1.95e-13` |

The full Python field output has shape 180,000 × 20, matching 90,000 cells,
real/imaginary stacking, and 20 stimulation periods.

### Adjoint versus finite-difference sensitivity

The Python representative check uses four K and four Ss columns distributed
across the 16,200-parameter grid and the original one-sided perturbation
`delta = 0.1`.

- Adjoint shape: 48 × 16,200
- Columns tested: `0, 2699, 5399, 8099, 8100, 10799, 13499, 16199`
- Maximum absolute difference: `9.7982e-9`
- Relative Frobenius difference: `0.0123820`
- Original exhaustive MATLAB result: maximum `6.8398e-6`, relative `0.0369656`

The Python script supports the exhaustive run with `--all-columns`. Routine
validation uses representative columns because the original MATLAB exhaustive
run took approximately 39 minutes.

## Performance comparison

### P=10 operations on the same laptop

| Operation | MATLAB wall (s) | MATLAB CPU (s) | Python wall (s) | Python CPU (s) | Python peak RSS (MiB) | MATLAB wall / Python wall |
|---|---:|---:|---:|---:|---:|---:|
| Build experiment inputs | `0.2127` | `0.1250` | `0.00249` | `<0.0156` | `80.6` | `85.3×` |
| Observations | `0.3096` | `0.3125` | `0.0645` | `0.0625` | `86.9` | `4.80×` |
| Full fields | `0.0182` | `0.0469` | `0.0595` | `0.0469` | `89.5` | `0.31×` |
| Initial Jacobian | `0.2196` | `0.4375` | `0.6654` | `0.5781` | `98.1` | `0.33×` |
| Complete inversion | `50.8797` | `431.1563` | `35.0371` | `31.0313` | `129.2` | `1.45×` |

The short MATLAB operations are order/JIT-cache sensitive and were measured
once, so differences below a few tenths of a second should not be overread.
The long inversion comparison is more meaningful: Python used about 31 CPU
seconds versus MATLAB's 431 CPU seconds and finished 1.45 times faster in wall
time.

### Other complete workflows

| Workflow | MATLAB wall (s) | Python wall (s) | Python CPU (s) | Python peak RSS (MiB) | Result |
|---|---:|---:|---:|---:|---|
| Seven-period inversion only | `121.9883` | `88.4213` | `83.8125` | `218.0` | Python `1.38×` faster |
| Black-Kipp observations + full fields + analysis | `52.080` | `51.1824` | `355.0625` | `1045.0` | Similar wall time; Python `1.02×` faster |
| Sensitivity adjoint | — | `1.7871` | `1.9531` | `139.3` | Full 48 × 16,200 Jacobian |

The MATLAB seven-period total script baseline was `220.582 s`; the table uses
the script-reported inversion time so it is comparable to the Python inversion
timer. The Black-Kipp rows include both observation and full-field solves.

## Optimization evidence

Two safe optimizations were introduced without changing results:

1. The frequency-independent sparse matrix and cell geometry are constructed
   once and reused across omega groups.
2. Independent frequency groups and finite-difference columns can run in a
   configurable thread pool.

| Optimized work | Before | After | Wall-time improvement | Tradeoff |
|---|---:|---:|---:|---|
| Black-Kipp observation/analysis, 1 vs 4 workers | `246.8653 s` | `22.0823 s` | `11.18×` | Peak RSS rises from `391.8` to `1059.6 MiB` |
| Eight representative FD columns, 1 vs 4 workers | `4.1328 s` | `1.296 s` | `3.19×` | More simultaneous sparse factorizations |

The four-worker finite-difference sample projects to approximately `2,624 s`
for all 16,200 columns, close to the measured MATLAB exhaustive time of
`2,350 s`. This is a projection, not a substitute for an exhaustive measured
run. The adjoint method computes the full Jacobian in `1.79 s`, demonstrating
why it is the production method.

## Reproduction commands

```powershell
# Automated correctness suite
.\.venv\Scripts\python.exe -m pytest -q

# All Python performance benchmarks (several minutes)
.\.venv\Scripts\python.exe benchmarks\run_python_benchmarks.py

# MATLAB P=10 component and inversion timings
matlab -batch "addpath('benchmarks'); matlab_p10_benchmark"

# Optimized Black-Kipp workflow
.\.venv\Scripts\python.exe examples\testing_multifreq_analyt_blackkipp_comparison.py --workers 4 --include-fields

# Representative or exhaustive finite-difference comparison
.\.venv\Scripts\python.exe examples\testing_sensitivity_fd_comparison.py --workers 4
.\.venv\Scripts\python.exe examples\testing_sensitivity_fd_comparison.py --workers 4 --all-columns
```

Generated raw benchmark arrays and JSON files are stored under the ignored
`benchmark_outputs/` directory. They can be regenerated from the committed
benchmark scripts; large binary outputs are not committed.
