# Inversion scaling and peak-memory benchmark

Benchmark date: 2026-09-21

## Purpose

This benchmark implements the follow-up requested during the mentor meeting:
increase the grid refinement parameter near the beginning of the 2-D inversion
case, exercise a larger inversion/Jacobian, measure scaling behavior, and
compare peak memory usage between Python and MATLAB.

The grid has `N x N` cells. Each cell has an unknown `ln(K)` and `ln(Ss)`, so
the number of inversion parameters is `2*N^2`. The nine wells, 36 complex
`P = 10 s` tests, and therefore 72 real/imaginary observations remain fixed.
Each measurement includes:

1. case and covariance setup;
2. synthetic forward simulation;
3. forward simulation at the initial parameters;
4. the complete analytic Jacobian; and
5. one linearized geostatistical inverse step.

One linearized step was selected to isolate matrix scaling from the variable
number of nonlinear line-search iterations. Each language/grid pair runs in a
fresh process. Peak memory is the sum of resident memory for that process and
its children, sampled every 10 ms.

## Results

| Grid | Parameters | Jacobian shape | Raw Jacobian (MiB) | Python peak RSS (MiB) | MATLAB peak RSS (MiB) |
|---:|---:|---:|---:|---:|---:|
| 25×25 | 1,250 | 72×1,250 | 0.687 | 97.8 | 705.7 |
| 50×50 | 5,000 | 72×5,000 | 2.747 | 109.1 | 791.6 |
| 75×75 | 11,250 | 72×11,250 | 6.180 | 125.0 | 934.4 |
| 100×100 | 20,000 | 72×20,000 | 10.986 | 150.2 | 1,108.3 |
| 150×150 | 45,000 | 72×45,000 | 24.719 | 217.0 | 1,637.2 |
| 200×200 | 80,000 | 72×80,000 | 43.945 | 329.1 | 2,389.0 |

The original case is 50×50. Increasing each axis by four, to 200×200,
increases the number of cells and parameters by 16. Python's measured peak
rose from 109.1 MiB to 329.1 MiB; MATLAB's rose from 791.6 MiB to 2,389.0 MiB.
At the largest tested case MATLAB used about 7.26 times Python's total resident
memory. MATLAB's larger fixed runtime footprint is included because the goal
is the memory required to run each program on a laptop.

### Scientific phase timing

| Grid | Python Jacobian (s) | MATLAB Jacobian (s) | Python linear inverse (s) | MATLAB linear inverse (s) | Python measured phases (s) | MATLAB measured phases (s) |
|---:|---:|---:|---:|---:|---:|---:|
| 25×25 | 0.0929 | 0.1486 | 0.0321 | 0.1222 | 0.1466 | 0.5844 |
| 50×50 | 0.3939 | 0.1734 | 0.0717 | 0.1253 | 0.5230 | 0.5692 |
| 75×75 | 0.9363 | 0.3386 | 0.4220 | 0.2625 | 1.5912 | 0.9311 |
| 100×100 | 2.1862 | 0.4131 | 0.5998 | 0.2409 | 3.6452 | 1.0322 |
| 150×150 | 5.3119 | 1.3050 | 3.4229 | 1.0636 | 11.1422 | 3.3579 |
| 200×200 | 11.3330 | 1.6406 | 6.1468 | 1.6727 | 24.0224 | 4.0910 |

MATLAB's numerical kernels are faster for the larger Jacobian and linear
inverse in this test. Python has a much smaller memory footprint, but its
Jacobian time grows more quickly. The subprocess wall time also includes
interpreter/MATLAB startup and shutdown, so the table reports scientific
phase timings separately.

## Correctness during scaling

For every grid size, both implementations completed with finite outputs. The
cross-language checks agreed as follows:

- data-vector norm absolute difference: at most `8.61e-16`;
- Jacobian Frobenius-norm absolute difference: at most `2.60e-16`;
- estimated-parameter norm relative difference: at most `6.84e-14`; and
- drift coefficient maximum absolute difference: at most `1.27e-12`.

The parameterized checkerboard explicitly snaps mathematical sine zero
crossings to zero. Without this rule, a coordinate lying on a checkerboard
boundary can acquire opposite signs from tiny MATLAB/NumPy rounding errors.

## Memory interpretation

The Python and MATLAB implementations do **not** create a dense prior
covariance matrix. At 80,000 parameters, such a float64 matrix would require
about 47.7 GiB by itself. Instead, the covariance is applied as a matrix-free
FFT-backed function, and the geostatistical inverse works primarily in the
72-observation space. This is why the 200×200 case fits comfortably in memory.

With the observation count fixed, the main growing allocations are the sparse
forward-model factorization, the `72 x 2*N^2` Jacobian, and `QH'`. A separate
experiment would be needed to study simultaneous growth in both parameters
and observation count.

## Reproduction

```powershell
# Complete six-size MATLAB/Python comparison
.\.venv\Scripts\python.exe benchmarks\run_scaling_benchmarks.py `
  --sizes 25 50 75 100 150 200 `
  --languages python matlab `
  --matlab "C:\Program Files\MATLAB\R2026a\bin\matlab.exe"

# Python-only run on a different set of grid sizes
.\.venv\Scripts\python.exe benchmarks\run_scaling_benchmarks.py `
  --sizes 50 100 200 --languages python

# Run the normal inversion example at a selected resolution
.\.venv\Scripts\python.exe examples\testing_inversion_2d_geostat.py `
  --grid-cells 100
```

Raw JSON is written to the ignored `benchmark_outputs/` directory. The
committed scripts are `benchmarks/run_scaling_benchmarks.py` and
`benchmarks/matlab_scaling_benchmark.m`.
