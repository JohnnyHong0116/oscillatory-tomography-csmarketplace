"""Checks for the block-Toeplitz FFT covariance product."""

import numpy as np

from oscillatory_tomography.covariance import toeplitz_matrix_math, toeplitz_matrix_vector_product


def test_fft_product_matches_explicit_stationary_covariance():
    ny, nx = 4, 5
    y, x = np.meshgrid(np.arange(ny), np.arange(nx), indexing="ij")
    coordinates = np.column_stack((x.reshape(-1, order="F"), y.reshape(-1, order="F")))
    distances = np.linalg.norm(coordinates[:, None, :] - coordinates[None, :, :], axis=2)
    covariance = np.exp(-distances / 2.5)
    rng = np.random.default_rng(42)
    vectors = rng.normal(size=(ny * nx, 3))
    actual = toeplitz_matrix_vector_product(covariance[0], vectors, (ny, nx))
    np.testing.assert_allclose(actual, covariance @ vectors, atol=1e-12, rtol=1e-12)


def test_three_dimensional_fft_product_matches_explicit_covariance():
    shape = (3, 4, 2)
    indices = np.indices(shape)
    coordinates = np.column_stack([axis.reshape(-1, order="F") for axis in indices])
    covariance = np.exp(-np.linalg.norm(coordinates[:, None] - coordinates[None, :], axis=2))
    vector = np.arange(np.prod(shape), dtype=float)
    actual = toeplitz_matrix_math(covariance[0], "*", vector, shape)
    np.testing.assert_allclose(actual, covariance @ vector, atol=1e-12, rtol=1e-12)
    assert toeplitz_matrix_math(covariance[0], "e", grid_shape=shape).size == np.prod(
        tuple(2 * size - 2 for size in shape)
    )
    realizations = toeplitz_matrix_math(
        covariance[0], "r", grid_shape=shape, rng=np.random.default_rng(4)
    )
    assert realizations.shape == (np.prod(shape), 2)
