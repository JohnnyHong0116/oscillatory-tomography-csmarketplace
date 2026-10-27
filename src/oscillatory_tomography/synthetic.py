"""Synthetic truth fields from the two branches of the translated MATLAB case.

These are generating models, not inverse starting values or measured site data.
The covariance/random-realization routine is the existing MATLAB transcription;
we only expose its already-supported branch to the web adapter.
"""

import numpy as np

from .covariance import toeplitz_matrix_math
from .grid import dimdist, plaid_cellcenter_coord
from .models import Domain


def synthetic_parameters(domain: Domain, kind: str = "checkerboard", seed: int = 0) -> np.ndarray:
    """Return ln(K), then ln(Ss), using the solver's Fortran cell ordering.

    Means, checker lengths/jumps, and geostatistical variances/correlation lengths
    match ``examples/testing_inversion_2d_geostat.py``. The explicit seed makes
    the Python realization reproducible; it does not promise MATLAB RNG parity.
    """
    coordinates, grids = plaid_cellcenter_coord(domain)
    if kind == "checkerboard":
        x_wave = np.sin(np.pi * coordinates[:, 0] / 10)
        y_wave = np.sin(np.pi * coordinates[:, 1] / 10)
        x_wave[np.abs(x_wave) < 1e-12] = 0
        y_wave[np.abs(y_wave) < 1e-12] = 0
        checker = np.sign(x_wave) * np.sign(y_wave)
        return np.r_[-9.2 + checker, -11.2 + 0.05 * checker]
    if kind != "geostatistical":
        raise ValueError("truth must be 'checkerboard' or 'geostatistical'")
    distances = dimdist(coordinates[0:1], coordinates)[0]
    correlation = np.exp(-np.sqrt((distances[:, 0] / 20.0) ** 2 + (distances[:, 1] / 20.0) ** 2))
    realizations = toeplitz_matrix_math(
        correlation, "r", grid_shape=grids[0].shape, rng=np.random.default_rng(seed)
    )
    return np.r_[-9.2 + np.sqrt(4.0) * realizations[:, 0],
                 -11.2 + np.sqrt(0.1) * realizations[:, 1]]
