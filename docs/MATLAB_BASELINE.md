# MATLAB starter-script baseline

This document records the initial behavior of the two starter scripts selected
by Professor Michael Cardiff and the repository's additional sensitivity test.
The baseline was established on 2026-09-07 before porting the workflow to
Python.

## Environment

- Windows
- MATLAB R2026a Update 5 (`26.1.0.3346908`)
- Deep Learning Toolbox 26.1
- Repository branch: `dev`
- Repository starting commit: `78cc2cb`
- Figures were hidden and interactive `pause` calls were disabled by the test
  command. The scientific calculations and the original starter scripts were
  not changed.

The original code calls `combvec`, a legacy Deep Learning Toolbox function,
from `grid_idw.m`. The R2026a validation used MathWorks' installed implementation
at `toolbox/nnet/nshallow/ncore/nndatafun/combvec.m`. No local compatibility
function was placed on the MATLAB path during these authoritative runs.

The persistent Windows `PATH` lists R2026a before R2024a, so newly opened
terminals resolve the plain `matlab` command to R2026a. The authoritative runs
also invoked `C:\Program Files\MATLAB\R2026a\bin\matlab.exe` explicitly.

## Case 1: Black-Kipp forward-model comparison

Script: `testing_multifreq_analyt_blackkipp_comparison.m`

### Purpose

This case compares the numerical oscillatory-flow forward model against the
semi-infinite, homogeneous analytical solution based on Black and Kipp (1981).
It is the simplest numerical-accuracy baseline for a future Python port.

### Inputs and configuration

- Two-dimensional domain: -300 m to 300 m in both x and y
- Grid: 300 by 300 cells (90,000 cells total)
- Wells: one pumping well and four observation wells at radial distances of
  30, 60, 90, and 120 m
- Periods: 20 logarithmically spaced values from 10 s to 10,000 s
- Observations: 80 (four distances for every period)
- Maximum pumping rate: -0.001 cubic metres per second
- Homogeneous transmissivity: 0.0003 square metres per second
- Homogeneous storativity: 0.00001
- x and y boundaries: specified head; z boundaries: no flow

### Processing flow

1. Build the regular grid and experiment structures.
2. Build homogeneous log-transmissivity and log-storativity fields.
3. Solve the numerical forward model for observations and full phasor fields.
4. Convert real and imaginary phasor components to amplitude and phase.
5. Calculate the analytical Bessel-function solution.
6. Compare numerical and analytical amplitude and phase.
7. Infer effective transmissivity, storativity, and diffusivity from the
   numerical response using the analytical approximation.

### Important outputs

- `sim_obs`: real components followed by imaginary components for all 80
  observations
- `sim_Phi`: real and imaginary phasor fields for 20 stimulation cases
- `synth_data`: numerical amplitude, phase, and phasor results
- `analyt_soln`: corresponding analytical results
- `results`: inferred transmissivity, storativity, and diffusivity
- Six figures showing parameter fields, phasor fields, analytical comparisons,
  and inferred properties

### Dependency path

```text
testing_multifreq_analyt_blackkipp_comparison.m
|- equigrid_setup.m
|- OHT_create_inputs.m
|  `- grid_idw.m
|     `- combvec (Deep Learning Toolbox)
|- plaid_cellcenter_coord.m
|- dimdist.m
|- toepmat_vector_math.m
`- OHT_run_distribKSs.m
   `- phasor_model_obssens.m
      |- phasor_model_form.m
      `- process_extra_args.m
```

### Baseline result

- Status: passed
- MATLAB exit code: 0
- Wall time: 52.080 s
- Mean relative amplitude error: `0.017048687840262439` (about 1.70%)
- Mean absolute phase error: `0.035438319103395045` rad (about 2.03 degrees)
- `norm(sim_obs)`: `3.6670677622391876`
- `results` size: 80 by 5
- Figures created: 6

## Case 2: two-dimensional geostatistical inversion

Script: `testing_inversion_2D_geostat.m`

Despite its filename, the current default `relz_case = 1` uses a checkerboard
truth field. Setting `relz_case = 2` selects the geostatistical realization.

### Purpose

This case constructs a synthetic tomographic experiment, generates forward
observations and sensitivities, performs a quasi-linear geostatistical
inversion, and compares the estimated fields with known true fields.

### Inputs and configuration

- Two-dimensional domain: -50 m to 50 m in both x and y
- Grid spacing: 2 m (50 by 50 cells; 2,500 cells total)
- Wells: nine wells in a 3 by 3 arrangement
- Current periods: 10, 50, 100, 200, 400, 800, and 1,600 s
- Source-observation pairs: 36 per period and 252 total
- Stimulation fields: eight per period and 56 total
- Pumped volume parameter: 0.01 cubic metres
- True log-conductivity field: mean -9.2 with checkerboard jump 1
- True log-specific-storage field: mean -11.2 with checkerboard jump 0.05
- Initial homogeneous estimates: log-conductivity -9 and
  log-specific-storage -11
- Assumed data-error covariance scale: `1e-8`

### Processing flow

1. Build experiment-specific source and observation interpolation weights.
2. Generate the true checkerboard conductivity and storage fields.
3. Run the forward model to generate synthetic phasor observations.
4. Calculate full phasor fields and the sensitivity matrix with respect to
   log-conductivity and log-specific-storage.
5. Build exponential spatial covariance models for both parameters.
6. Run the quasi-linear geostatistical inversion.
7. Plot the true fields, phasor fields, sensitivities, and estimated fields.
8. Save the MATLAB workspace as `testing_inversion_currtest.mat`.

### Important outputs

- `sim_obs`: synthetic real and imaginary phasor observations
- `Phi_true`: full real and imaginary phasor fields
- `H_adj`: initial sensitivity matrix
- `params_true`: concatenated true log-conductivity and log-storage fields
- `params_best`: estimated fields after inversion
- `H_local`: sensitivity matrix at the final local linearization
- `negloglike`: final objective value
- Six figures and a saved MATLAB workspace

### Dependency path

```text
testing_inversion_2D_geostat.m
|- OHT_create_inputs.m
|  `- grid_idw.m
|     `- combvec (Deep Learning Toolbox)
|- plaid_cellcenter_coord.m
|- dimdist.m
|- toepmat_vector_math.m
|- OHT_run_distribKSs.m
|  `- phasor_model_obssens.m
|     |- phasor_model_form.m
|     `- process_extra_args.m
|- covar_product_K_Ss.m
`- ql_geostat_inv.m
   |- lin_geostat_inv.m
   `- NLAP_eval.m
```

### Current seven-period baseline

- Status: passed
- MATLAB exit code: 0
- Wall time: 220.582 s
- Inversion time reported by the script: 123.884 s
- Periods: 7
- Observations: 252 (`sim_obs` contains 504 real/imaginary values)
- Cells: 2,500 (`params_best` contains 5,000 parameter values)
- Stimulation fields: 56
- `norm(sim_obs)`: `0.86085024302949986`
- `norm(params_best)`: `728.37218237483387`
- Final negative log-likelihood: `83.529811262398255`
- Figures created: 6
- Output file created successfully in an isolated run directory

### MATLAB/toolbox cross-check

The R2026a run using MathWorks' Deep Learning Toolbox was compared with the
earlier R2024a diagnostic run that used a temporary local implementation of
`combvec`. The temporary implementation has since been removed from the
repository working tree.

- True parameters: exact match
- Synthetic observations: maximum absolute difference `4.86e-16`
- Full phasor fields: maximum absolute difference `9.99e-16`
- Initial sensitivity matrix: maximum absolute difference `2.60e-18`
- Final parameter estimate: relative Frobenius difference `1.66e-6`

This confirms that neighbor-combination behavior was equivalent. The small
final-inversion difference is downstream of otherwise matching forward and
sensitivity calculations and is consistent with numerical solver differences
between MATLAB releases.

## Case 3: adjoint versus finite-difference sensitivity

Script: `testing_sensitivity_fd_comparison.m`

This is the repository's third and final `testing_*.m` script. It validates the
adjoint sensitivity calculation by perturbing every log-conductivity and
log-specific-storage parameter and rerunning the forward model.

### Inputs and configuration

- Grid: 90 by 90 cells (8,100 cells total)
- Parameters: 16,200 (one conductivity and one storage value per cell)
- Wells: one central pumping well and eight observation wells
- Periods: 10, 100, and 1,000 s
- Observations: 24
- Homogeneous true log-conductivity and log-specific-storage: -9.2
- Finite-difference perturbation: 0.1

### Baseline result

- Status: passed
- MATLAB exit code: 0
- Wall time: 2,350.070 s (39 min 10.070 s)
- Adjoint and finite-difference matrix size: 48 by 16,200
- Maximum absolute finite-difference/adjoint difference: `6.8397615805474256e-6`
- Relative Frobenius difference: `0.036965631535969774`
- `norm(sim_obs)`: `0.019398819723860927`
- Figures created: 4

The finite-difference derivative is approximate and uses a relatively large
0.1 perturbation, so a nonzero difference is expected. This full script is too
slow for routine regression testing and should eventually be complemented by a
smaller representative derivative test.

## Test coverage boundary

The three `testing_*.m` scripts execute 17 of the 26 tracked MATLAB files. The
following helpers are not called by those scripts:

- `OHT_run_ampdistribK.m`
- `OHT_run_distrib_aperture.m`
- `compute_Q_nD.m`
- `eucdist.m`
- `geostat_resid_compute.m`
- `image2field.m`
- `plaid_coord.m`
- `reflect_nd.m`
- `rotate_2d.m`

All nine unexercised helpers parse successfully in MATLAB R2026a, but they have
not been numerically validated because the repository supplies no direct test
cases or expected outputs for them. `compute_Q_nD.m` calls `pdist` and
`squareform`; those functions are not installed on this machine and are not
used by the three repository test scripts.

## Reference-workspace validation

The committed `testing_inversion_currtest.mat` is not a reference for the
current seven-period script. It contains only `P = 10`, 36 observations, and
eight stimulation fields. It also contains `Phi_init`, a variable removed from
the script in commit `99d546b`, the same commit that added the MAT file. This
shows that the saved workspace came from a different script state.

Comparing the shared 10-second-period portion gives:

- True parameter fields: exact match
- Synthetic observations: maximum absolute difference `2.08e-17`
- Full phasor field: maximum absolute difference `2.66e-15`
- Initial sensitivity matrix: the saved matrix was evaluated at homogeneous
  `ln(K) = -9`, `ln(Ss) = -9`, even though the later saved `params_init`
  contains `ln(Ss) = -11`. Re-evaluating at the actual sensitivity state
  reproduces the saved matrix.

An earlier R2024a diagnostic run of the current code in a separate
single-period configuration gave:

- Status: passed
- Wall time: 57.341 s
- Inversion time: 34.403 s
- Maximum `params_best` difference from the committed workspace: `7.75e-5`
- Relative `params_best` difference: `1.64e-6`
- Current negative log-likelihood: `16.840711634263954`
- Reference negative log-likelihood: `16.840585550630379`

The forward-model baseline is therefore strongly reproduced. Professor Cardiff
subsequently confirmed that the 10-second-period workspace is sufficient for
the first Python transcription.

## Python P=10 transcription baseline

The initial Python port uses NumPy/SciPy complex sparse matrices and preserves
MATLAB/Fortran array ordering. Its regression suite gives:

- Input structures: exact match
- Synthetic observations: maximum absolute difference `5.20e-17`
- Full phasor field: maximum absolute difference `4.44e-15`
- Initial 72 by 5,000 sensitivity matrix: maximum absolute difference
  `3.81e-21` at its actual saved state (`ln(K) = ln(Ss) = -9`)
- Selected adjoint columns also agree with independent centered finite
  differences to relative error below `3.0e-10`
- Full Python P=10 inversion: eight iterations and about 18 seconds on this
  machine
- Final Python parameter image versus the historical MAT workspace: maximum
  absolute difference `1.83e-4`, relative norm difference `7.38e-6`
- Current seven-period Python workflow: completed 11 quasi-linear iterations
  in `139.564 s`, produced 504 observation components, and generated both
  estimated-property images successfully

The small final-inversion difference is expected because MATLAB and SciPy use
different MINRES and Nelder-Mead implementations. Forward fields and analytic
Jacobians—the scientific inputs to the inversion—match essentially to floating-
point precision.

## Known portability and maintenance issues

- `testing_inversion_2D_geostat.m` creates `negloglike_func` using a function
  named `negloglike_eval`, but that function is not present in the repository.
  The available objective function is `NLAP_eval`. The undefined handle is not
  invoked by the current script, so it does not prevent this baseline run.
- Function handles stored in the committed MAT file retain absolute paths from
  the machine that created it, such as `/Users/cardiff/Documents/GitHub/...`.
  MATLAB warns that these handles cannot be restored when the file is loaded on
  this Windows machine. Numeric arrays in the file remain readable.
- The inversion script saves directly to a tracked filename in its current
  directory. Validation runs should use an isolated directory or a future test
  harness should save to a dedicated output directory.
- Runtime values are machine-specific and should be treated as initial
  measurements, not performance acceptance thresholds.

## Questions for the mentor

1. Should the primary truth field be the current checkerboard case or the
   geostatistical realization implied by the script name?
2. Is there a newer expected-results workspace for the current seven-period sensitivity
   calculation?
3. What numerical tolerances should define agreement for observations,
   sensitivities, and final estimated parameter fields?
4. Should generated figures and compact numerical baselines be committed for
   automated cross-language regression tests?
