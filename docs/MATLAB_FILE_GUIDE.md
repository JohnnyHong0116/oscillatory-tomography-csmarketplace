# MATLAB file guide

This guide explains the role of MATLAB-related file in the repository in
plain language.

## Scientific vocabulary used by the code

- **K** is hydraulic conductivity. Some two-dimensional scripts use variable
  names such as `lnT` because a one-layer model can be interpreted in terms of
  transmissivity.
- **Ss** is specific storage. Some analytical sections use `S` for storativity.
- **ln(K)** and **ln(Ss)** are the natural logarithms of those properties. The
  inversion estimates log-properties so the physical values remain positive.
- A **phasor** represents a periodic pressure signal with a complex number. Its
  real and imaginary parts encode signal amplitude and phase delay.
- The **forward model** predicts pressure responses from known aquifer
  properties and pumping conditions.
- The **inverse model** works in the opposite direction: it estimates aquifer
  properties from pressure responses.
- A **sensitivity** or **Jacobian** describes how much each predicted
  observation changes when a model parameter changes.
- **Q** is the prior spatial covariance of the aquifer parameters, and **R** is
  the measurement-error covariance.

## Overall program flow

```text
testing_*.m
  |
  |- grid/domain setup
  |    equigrid_setup.m
  |    plaid_cellcenter_coord.m / plaid_coord.m
  |
  |- experiment setup
  |    OHT_create_inputs.m
  |      `- grid_idw.m
  |
  |- forward simulation
  |    OHT_run_distribKSs.m
  |      `- phasor_model_obssens.m
  |           `- phasor_model_form.m
  |
  `- inversion (tomographic test only)
       ql_geostat_inv.m
         |- lin_geostat_inv.m
         |- NLAP_eval.m
         `- covariance utilities
```

## Top-level test and demonstration scripts

### `testing_multifreq_analyt_blackkipp_comparison.m`

This is the best first script to study. It runs a homogeneous numerical forward
model over 20 pumping periods and compares amplitude and phase against the
Black-Kipp semi-infinite analytical solution at four observation distances.

It demonstrates:

1. Defining a grid, wells, boundaries, pumping frequencies, and observations.
2. Generating numerical phasor observations and full spatial fields.
3. Comparing numerical amplitude and phase with an analytical solution.
4. Showing where short-period discretization and long-period boundary effects
   begin to matter.
5. Using amplitude and phase to estimate effective transmissivity, storativity,
   and diffusivity.

Important workspace outputs include `sim_obs`, `sim_Phi`, `synth_data`,
`analyt_soln`, and `results`. It creates six figures. This script passed the
MATLAB R2026a baseline test.

### `testing_inversion_2D_geostat.m`

This is the complete synthetic tomography example. It places nine wells in a
three-by-three pattern, generates synthetic observations from a known aquifer,
calculates sensitivities, and runs a quasi-linear geostatistical inversion to
estimate spatial K and Ss fields.

The current default uses a checkerboard truth field (`relz_case = 1`) even
though the filename says `geostat`. Setting `relz_case = 2` selects a random
geostatistical truth field.

Important outputs include `sim_obs`, `Phi_true`, `H_adj`, `params_true`,
`params_best`, `H_local`, and `negloglike`. It creates six figures and saves the
workspace to `testing_inversion_currtest.mat`. This script passed the MATLAB
R2026a baseline test.

### `testing_sensitivity_fd_comparison.m`

This validates the efficient adjoint sensitivities against direct finite
differences. It first calculates the complete Jacobian with the adjoint method.
It then perturbs each of 16,200 parameters separately, reruns the forward model,
and estimates each derivative from the change in observations.

The script creates visual comparisons of sensitivity to ln(K) and ln(Ss). It is
scientifically useful but extremely slow: the full R2026a baseline took about
39 minutes. It passed and produced the expected 48-by-16,200 matrices and four
figures.

## Experiment and grid setup

### `equigrid_setup.m`

Converts compact grid descriptions such as `[minimum, maximum, cell_count]`
into a `domain` structure containing the x, y, and z cell-boundary vectors. If
z is omitted, it creates one unit-thickness layer. This is the easiest way for
the test scripts to define regular grids.

### `plaid_cellcenter_coord.m`

Takes a `domain` structure of cell boundaries, calculates every cell center,
and returns both a flattened coordinate list and optional meshgrid-shaped
coordinate arrays. The flattened order matches the model's parameter-vector
ordering.

### `plaid_coord.m`

The more general coordinate-grid helper. Instead of accepting cell boundaries,
it accepts x, y, and optional z point-coordinate vectors directly. It returns a
flattened list of all Cartesian grid points and optional meshgrid arrays.

### `grid_idw.m`

Builds inverse-distance interpolation weights between arbitrary well or sensor
locations and nearby regular-grid points. `OHT_create_inputs.m` uses these
weights to distribute pumping flow into model cells and extract simulated head
at observation wells. It supports one-, two-, and three-dimensional grids and
uses `combvec` from Deep Learning Toolbox to enumerate neighboring cells.

### `OHT_create_inputs.m`

Transforms user-facing experiment definitions into the structures required by
the numerical solver. Its inputs are well locations, a `test_list`, and the
domain. It groups tests by angular frequency and creates an `experiment`
structure with:

- `omega`: angular pumping frequency;
- `tests`: which stimulation and observation weighting belong to each result;
- `stims`: spatial pumping/source vectors;
- `obs`: spatial observation-weight vectors.

It supports ordinary single-well pumping and a dipole form with two pumping
wells.

## Core forward model

### `phasor_model_form.m`

This is the lowest-level physical matrix builder. It discretizes the
steady-periodic groundwater-flow equation on a rectangular 2-D or 3-D grid.
Given K, Ss, grid boundaries, and boundary-condition types, it constructs:

- the sparse flow or stiffness matrix;
- the frequency-dependent storage matrix;
- coefficients that add constant-head boundary contributions to the right-hand
  side.

The resulting system is conceptually
`(A_steady + omega*A_frequency)*Phi = sources + boundary_terms`.

### `phasor_model_obssens.m`

Solves the matrix system for one angular frequency and one or more pumping
patterns. It converts the full phasor field into requested observations through
the observation weights. When requested, it also returns the complete field and
adjoint sensitivities to K and Ss. The adjoint approach obtains a full Jacobian
far more efficiently than perturbing every cell separately.

### `OHT_run_distribKSs.m`

This is the main high-level forward-model wrapper used by all three test
scripts. Its parameter vector contains all ln(K) values followed by all ln(Ss)
values. It loops over frequency groups and provides three modes:

- `run_type = 1`: simulated observations, with all real components followed by
  all imaginary components;
- `run_type = 2`: full phasor fields for every stimulation;
- `run_type = 3`: sensitivities of real and imaginary observations to every
  ln(K) and ln(Ss) cell value.

### `OHT_run_ampdistribK.m`

A reduced wrapper for workflows that use only signal amplitude and estimate
only distributed ln(K). It can return amplitude observations, amplitude fields,
or the amplitude sensitivity matrix with respect to ln(K). None of the three
supplied test scripts currently calls it.

### `OHT_run_distrib_aperture.m`

A specialized wrapper for two-dimensional fracture tests where the unknown is
fracture aperture rather than separate K and Ss fields. It converts aperture
and water properties into the hydraulic quantities required by the phasor
solver and can return observations, fields, or sensitivities to ln(aperture).
It assumes a single unitless z layer. It is not exercised by the supplied test
scripts.

## Geostatistical inversion

### `lin_geostat_inv.m`

Solves one linear geostatistical inverse problem. It combines observed data,
the forward/sensitivity matrix, parameter covariance Q, measurement covariance
R, and drift matrix X to calculate the estimated parameter field and drift
coefficients. Q may be a full matrix or a function that computes `Q*v` without
storing the entire matrix.

### `ql_geostat_inv.m`

Extends the linear solver to a nonlinear problem using the quasi-linear
geostatistical method. It repeatedly:

1. evaluates the forward model and local Jacobian;
2. solves a linearized geostatistical inverse problem;
3. optionally performs a line search;
4. checks objective-function and parameter-change tolerances.

It returns the best parameter vector, drift coefficients, final local
Jacobian, and negative log-a-posteriori objective value.

### `NLAP_eval.m`

Calculates the negative log-a-posteriori objective used to judge an inversion
candidate. One term measures mismatch between observed and simulated data using
R; the other penalizes departure from the geostatistical prior using Q.

### `geostat_resid_compute.m`

Calculates transformed residuals, standardized errors, and summary statistics
for diagnosing a linear or linearized geostatistical inversion. It is a
post-analysis helper and is not called by the current tomography script.

## Covariance and spatial mathematics

### `dimdist.m`

Calculates distance along each coordinate dimension separately. For 2-D
points, the result contains x-distance and y-distance matrices. The scripts use
these separate distances to build anisotropic covariance models with different
x and y correlation lengths.

### `eucdist.m`

Calculates ordinary Euclidean distances between every pair of points, or
between two supplied point sets. It is a simpler isotropic alternative to
`dimdist.m` and is not used by the supplied tests.

### `compute_Q_nD.m`

Builds a complete isotropic generalized covariance matrix from unknown-point
coordinates and a user-provided covariance function. It first calculates all
pairwise Euclidean distances with `pdist` and `squareform`, then evaluates the
covariance function on that matrix. Those two distance functions are not
currently installed on this laptop, and this helper is not used by the supplied
tests.

### `covar_product_K_Ss.m`

Efficiently computes `Q*v` for a block covariance model containing separate K
and Ss covariance blocks and no K-Ss cross-correlation. It avoids constructing
the full covariance matrix by delegating Toeplitz products to
`toepmat_vector_math.m`. The inversion script uses it through a function handle.

### `toepmat_vector_math.m`

Uses FFT-based circulant embedding to work efficiently with Toeplitz and
block-Toeplitz covariance matrices on regular grids. Depending on its operation
argument, it can multiply by the covariance, approximately divide by it,
inspect embedded eigenvalues, or generate random spatial realizations. This is
important for handling large covariance models without storing dense matrices.

## General-purpose helpers

### `process_extra_args.m`

Small utility that applies supplied optional arguments over a list of default
values. `grid_idw.m` and `toepmat_vector_math.m` use it to manage MATLAB
`varargin` inputs.

### `image2field.m`

Reads a 24-bit BMP image, converts pixel brightness to numeric values between
user-specified black and white endpoints, and flips the image vertically to
match the spatial-grid orientation. It provides a way to create a synthetic
property field from an image.

### `reflect_nd.m`

Reflects a point across a line or hyperplane in any number of dimensions. The
plane is represented by coefficients in the equation
`plane_vec' * [point; 1] = 0`.

### `rotate_2d.m`

Rotates a set of two-dimensional points clockwise by a specified angle in
degrees.

## Data and repository files

### `testing_inversion_currtest.mat`

A saved MATLAB workspace associated with the inversion example. It contains
model configuration, simulated observations, fields, sensitivities, inversion
outputs, and figure/function handles. It was generated from a single 10-second
period configuration, not the current seven-period default script. Some saved
function handles retain paths from Professor Cardiff's computer and cannot be
restored on this Windows machine, although the numeric arrays remain readable.
It should be treated as a historical reference rather than an exact baseline
for every current script output.

Its main configuration and results were:
- Pumping period: 10 seconds
- Pumped-volume parameter: 0.01 m³
- Grid: 50 × 50 = 2,500 cells
- Wells: 9
- Source–observation pairs: 36
- Inversion runtime: 94.46 seconds
- Final objective value: 16.8406

My Baseline run results difference:
- True aquifer fields: exact match
- Synthetic observations: maximum difference 2.08×10⁻¹⁷
- Full phasor fields: maximum difference 2.66×10⁻¹⁵
- Final estimated parameters: relative difference 1.64×10⁻⁶
- Historical objective: 16.8405856
- Recomputed objective: 16.8407116