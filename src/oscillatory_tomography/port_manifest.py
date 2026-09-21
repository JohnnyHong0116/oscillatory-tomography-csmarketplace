"""Machine-readable map from every original MATLAB file to its Python port.

The manifest is intentionally explicit.  It lets the test suite detect a new
or renamed MATLAB source file that has not yet been reviewed for translation,
and confirms that the named Python function actually exists in its target
module.  Benchmark-only MATLAB files under ``benchmarks/`` are not originals
and therefore are not included here.
"""

from __future__ import annotations


# Values contain the repository-relative Python file followed by the primary
# function that replaces the MATLAB entry point.  Several MATLAB helpers share
# a Python module because Python modules naturally group related operations.
MATLAB_PORTS: dict[str, tuple[str, str]] = {
    "compute_Q_nD.m": ("src/oscillatory_tomography/utilities.py", "compute_covariance_nd"),
    "covar_product_K_Ss.m": ("src/oscillatory_tomography/covariance.py", "covariance_product_k_ss"),
    "dimdist.m": ("src/oscillatory_tomography/grid.py", "dimdist"),
    "equigrid_setup.m": ("src/oscillatory_tomography/grid.py", "equigrid_setup"),
    "eucdist.m": ("src/oscillatory_tomography/grid.py", "euclidean_distance"),
    "geostat_resid_compute.m": ("src/oscillatory_tomography/inversion.py", "geostatistical_residuals"),
    "grid_idw.m": ("src/oscillatory_tomography/grid.py", "grid_idw"),
    "image2field.m": ("src/oscillatory_tomography/utilities.py", "image_to_field"),
    "lin_geostat_inv.m": ("src/oscillatory_tomography/inversion.py", "linear_geostatistical_inverse"),
    "NLAP_eval.m": ("src/oscillatory_tomography/inversion.py", "negative_log_a_posteriori"),
    "OHT_create_inputs.m": ("src/oscillatory_tomography/grid.py", "create_inputs"),
    "OHT_run_ampdistribK.m": ("src/oscillatory_tomography/forward.py", "run_amplitude_distributed_k"),
    "OHT_run_distrib_aperture.m": ("src/oscillatory_tomography/forward.py", "run_distributed_aperture"),
    "OHT_run_distribKSs.m": ("src/oscillatory_tomography/forward.py", "run_distributed_k_ss"),
    "phasor_model_form.m": ("src/oscillatory_tomography/phasor.py", "phasor_model_form"),
    "phasor_model_obssens.m": ("src/oscillatory_tomography/phasor.py", "phasor_model_obssens"),
    "plaid_cellcenter_coord.m": ("src/oscillatory_tomography/grid.py", "plaid_cellcenter_coord"),
    "plaid_coord.m": ("src/oscillatory_tomography/grid.py", "plaid_coord"),
    "process_extra_args.m": ("src/oscillatory_tomography/utilities.py", "process_optional_args"),
    "ql_geostat_inv.m": ("src/oscillatory_tomography/inversion.py", "quasi_linear_geostatistical_inverse"),
    "reflect_nd.m": ("src/oscillatory_tomography/utilities.py", "reflect_nd"),
    "rotate_2d.m": ("src/oscillatory_tomography/utilities.py", "rotate_2d"),
    "testing_inversion_2D_geostat.m": ("examples/testing_inversion_2d_geostat.py", "main"),
    "testing_multifreq_analyt_blackkipp_comparison.m": (
        "examples/testing_multifreq_analyt_blackkipp_comparison.py",
        "main",
    ),
    "testing_sensitivity_fd_comparison.m": (
        "examples/testing_sensitivity_fd_comparison.py",
        "main",
    ),
    "toepmat_vector_math.m": ("src/oscillatory_tomography/covariance.py", "toeplitz_matrix_math"),
}


# These are boundaries inside otherwise translated files, not missing files.
# They remain visible here so a future contributor can revisit them deliberately.
INTENTIONAL_LIMITATIONS = {
    "Sy": "The original phasor code labels this branch beta, unverified, and unsupported.",
    "leaks": "The MATLAB K/Ss phasor path reads no values from bdrys.leaks.",
    "MATLAB_UI": "pause, clear, figure handles, and saved function handles are replaced by Python interfaces.",
}
