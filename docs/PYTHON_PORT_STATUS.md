# MATLAB-to-Python port status

The original MATLAB files remain unchanged. Python uses zero-based internal
indices and explicit Fortran-order reshaping to preserve MATLAB cell ordering.
All 26 upstream MATLAB source files are represented below. The mapping is also
stored in `src/oscillatory_tomography/port_manifest.py`; an automated test fails
if an original `.m` file lacks a Python entry point or names a missing function.

| MATLAB source | Python counterpart | Status |
|---|---|---|
| `compute_Q_nD.m` | `utilities.compute_covariance_nd` | Complete |
| `covar_product_K_Ss.m` | `covariance.covariance_product_k_ss` | Complete |
| `dimdist.m` | `grid.dimdist` | Complete |
| `equigrid_setup.m` | `grid.equigrid_setup` | Complete |
| `eucdist.m` | `grid.euclidean_distance` | Complete |
| `geostat_resid_compute.m` | `inversion.geostatistical_residuals` | Complete |
| `grid_idw.m` | `grid.grid_idw` | Complete |
| `image2field.m` | `utilities.image_to_field` | Complete |
| `lin_geostat_inv.m` | `inversion.linear_geostatistical_inverse` | Complete |
| `NLAP_eval.m` | `inversion.negative_log_a_posteriori` | Complete |
| `OHT_create_inputs.m` | `grid.create_inputs` | Complete |
| `OHT_run_ampdistribK.m` | `forward.run_amplitude_distributed_k` | Complete; corrected observation-wise amplitude chain rule |
| `OHT_run_distrib_aperture.m` | `forward.run_distributed_aperture` | Complete |
| `OHT_run_distribKSs.m` | `forward.run_distributed_k_ss` | Complete |
| `phasor_model_form.m` | `phasor.phasor_model_form` | Complete for documented K/Ss model |
| `phasor_model_obssens.m` | `phasor.phasor_model_obssens` | Complete for documented K/Ss model |
| `plaid_cellcenter_coord.m` | `grid.plaid_cellcenter_coord` | Complete |
| `plaid_coord.m` | `grid.plaid_coord` | Complete |
| `process_extra_args.m` | `utilities.process_optional_args` | Complete compatibility helper; normal Python code uses keyword defaults |
| `ql_geostat_inv.m` | `inversion.quasi_linear_geostatistical_inverse` | Complete |
| `reflect_nd.m` | `utilities.reflect_nd` | Complete |
| `rotate_2d.m` | `utilities.rotate_2d` | Complete |
| `testing_inversion_2D_geostat.m` | `examples/testing_inversion_2d_geostat.py` | Complete; P=10 reference by default, `--all-periods` and both truth-field branches supported |
| `testing_multifreq_analyt_blackkipp_comparison.m` | `examples/testing_multifreq_analyt_blackkipp_comparison.py` | Complete numerical/analytical workflow |
| `testing_sensitivity_fd_comparison.m` | `examples/testing_sensitivity_fd_comparison.py` | Complete; representative columns by default, `--all-columns` for the original exhaustive run |
| `toepmat_vector_math.m` | `covariance.toeplitz_matrix_math` | Complete for product, inverse-product, eigenvalue, and realization modes in 1-D through 3-D |

## Intentional boundaries

- The experimental `Sy` branch in `phasor_model_obssens.m` is not exposed.
  The MATLAB comments describe it as beta, unverified, and unsupported.
- The `leaks` boundary field is not used by the original K/Ss phasor path and
  therefore is not part of the Python boundary model.
- MATLAB figure handles, `pause`, workspace clearing, and saved function
  handles are interface behavior rather than scientific calculations. Python
  examples create static Matplotlib outputs instead.
- The amplitude-only MATLAB wrapper appears to combine a full field with
  observation sensitivities in its mode-3 expression. The Python version uses
  the mathematically consistent derivative of each amplitude observation and
  verifies it against finite differences.

## Validation

- The saved P=10 inputs, observations, full fields, and Jacobian match at or
  near floating-point precision.
- The full 90,000-cell, 20-period Black-Kipp run reproduces the recorded MATLAB
  amplitude error, phase error, and observation norm.
- Both specialized amplitude and aperture Jacobians are checked against
  numerical finite differences on a compact model.
- The full MATLAB sensitivity experiment remains available with
  `--all-columns`; its original MATLAB runtime was about 39 minutes, so routine
  checks use representative K and Ss columns.
- The Black-Kipp script calculates observations by default. Pass
  `--include-fields` to additionally allocate and calculate the original full
  90,000-cell phasor fields.
