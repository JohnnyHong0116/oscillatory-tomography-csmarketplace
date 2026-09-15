"""FFT-based geostatistical covariance products.

Ports ``toepmat_vector_math.m`` and ``covar_product_K_Ss.m`` without forming
the dense 2500-by-2500 spatial covariance matrices.
"""

from __future__ import annotations

import numpy as np


def _circulant_embedding(first_row: np.ndarray, grid_shape: tuple[int, ...]) -> np.ndarray:
    embedded = np.asarray(first_row).reshape(grid_shape, order="F")
    for axis, size in enumerate(grid_shape):
        if size > 1:
            indices = np.arange(size - 2, 0, -1)
            embedded = np.concatenate((embedded, np.take(embedded, indices, axis=axis)), axis=axis)
    return embedded


def toeplitz_matrix_math(
    first_row: np.ndarray,
    operation: str,
    vectors: np.ndarray | None = None,
    grid_shape: tuple[int, ...] | None = None,
    inverse_regularization: float = 0.0,
    rng: np.random.Generator | None = None,
) -> np.ndarray:
    """Perform all operations supported by ``toepmat_vector_math.m``.

    Operations are ``*`` (product), ``\\`` (inverse product), ``e``
    (embedded-circulant eigenvalues), and ``r`` (two realizations).
    """

    row = np.asarray(first_row).reshape(-1)
    if grid_shape is None:
        grid_shape = (row.size,)
    if int(np.prod(grid_shape)) != row.size or len(grid_shape) not in (1, 2, 3):
        raise ValueError("grid_shape must describe the 1-D, 2-D, or 3-D first row")
    embedded = _circulant_embedding(row, grid_shape)
    eigenvalues = np.fft.fftn(embedded)
    if operation == "e":
        return eigenvalues.reshape(-1, order="F")
    if operation == "r":
        generator = np.random.default_rng() if rng is None else rng
        noise = generator.normal(size=embedded.shape) + 1j * generator.normal(size=embedded.shape)
        realization = np.fft.ifftn(np.sqrt(np.fft.fftn(embedded * embedded.size)) * noise)
        cropped = realization[tuple(slice(0, size) for size in grid_shape)].reshape(-1, order="F")
        return np.column_stack((cropped.real, cropped.imag))
    if operation not in ("*", "\\") or vectors is None:
        raise ValueError("operation must be '*', '\\', 'e', or 'r'; vector operations need vectors")

    rhs = np.asarray(vectors)
    was_vector = rhs.ndim == 1
    if was_vector:
        rhs = rhs[:, None]
    if rhs.shape[0] != row.size:
        raise ValueError("vectors are incompatible with grid_shape")
    result = np.empty_like(rhs, dtype=np.result_type(row, rhs, float))
    crop = tuple(slice(0, size) for size in grid_shape)
    for column in range(rhs.shape[1]):
        padded = np.zeros(embedded.shape, dtype=np.result_type(row, rhs))
        padded[crop] = rhs[:, column].reshape(grid_shape, order="F")
        transformed = np.fft.fftn(padded)
        if operation == "*":
            calculated = np.fft.ifftn(eigenvalues * transformed)
        else:
            calculated = np.fft.ifftn(transformed / (eigenvalues + inverse_regularization))
        cropped = calculated[crop]
        if np.isrealobj(row) and np.isrealobj(rhs):
            cropped = cropped.real
        result[:, column] = cropped.reshape(-1, order="F")
    return result[:, 0] if was_vector else result


def toeplitz_matrix_vector_product(
    first_row: np.ndarray,
    vectors: np.ndarray,
    grid_shape: tuple[int, int],
) -> np.ndarray:
    """Multiply a 2-D block-Toeplitz covariance matrix by one or more vectors."""

    return toeplitz_matrix_math(first_row, "*", vectors, grid_shape)


def covariance_product_k_ss(
    covariance_rows: tuple[np.ndarray, np.ndarray],
    vectors: np.ndarray,
    grid_shape: tuple[int, int],
) -> np.ndarray:
    """Apply independent K and Ss spatial covariance matrices blockwise."""

    rhs = np.asarray(vectors)
    was_vector = rhs.ndim == 1
    if was_vector:
        rhs = rhs[:, None]
    n_cells = int(np.prod(grid_shape))
    if rhs.shape[0] != 2 * n_cells:
        raise ValueError("vectors must have one K and one Ss block")
    result = np.vstack(
        (
            toeplitz_matrix_vector_product(covariance_rows[0], rhs[:n_cells, :], grid_shape),
            toeplitz_matrix_vector_product(covariance_rows[1], rhs[n_cells:, :], grid_shape),
        )
    )
    return result[:, 0] if was_vector else result
