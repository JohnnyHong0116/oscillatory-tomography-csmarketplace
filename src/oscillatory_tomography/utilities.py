"""General utilities translated from the standalone MATLAB helpers."""

from __future__ import annotations

from collections.abc import Callable, Sequence
from pathlib import Path

import numpy as np
from PIL import Image

from .grid import euclidean_distance


def process_optional_args(supplied: Sequence[object], *defaults: object) -> tuple[object, ...]:
    """Apply non-None optional values over defaults, like ``process_extra_args.m``.

    Python functions normally express this behavior directly in their
    signatures. This compatibility helper is retained for a complete mapping.
    """

    result = list(defaults)
    for index, value in enumerate(supplied[: len(result)]):
        if value is not None:
            result[index] = value
    return tuple(result)


def compute_covariance_nd(
    unknown_coordinates: np.ndarray,
    covariance_function: Callable[[np.ndarray, object], np.ndarray],
    covariance_parameters: object,
) -> np.ndarray:
    """Compute an isotropic covariance matrix, porting ``compute_Q_nD.m``."""

    distances = euclidean_distance(unknown_coordinates)
    return np.asarray(covariance_function(distances, covariance_parameters))


def image_to_field(
    image: str | Path | np.ndarray,
    black_value: float,
    white_value: float,
) -> np.ndarray:
    """Map RGB brightness linearly to field values as in ``image2field.m``."""

    if isinstance(image, (str, Path)):
        pixels = np.asarray(Image.open(image).convert("RGB"), dtype=float)
    else:
        pixels = np.asarray(image, dtype=float)
        if pixels.ndim == 2:
            pixels = np.repeat(pixels[:, :, None], 3, axis=2)
    brightness = pixels[:, :, :3].sum(axis=2) / 3.0
    field = brightness / 255.0 * (white_value - black_value) + black_value
    return np.flipud(field)


def reflect_nd(point: np.ndarray, plane: np.ndarray) -> np.ndarray:
    """Reflect a point over an N-dimensional plane from ``reflect_nd.m``."""

    point = np.asarray(point, dtype=float).reshape(-1)
    plane = np.asarray(plane, dtype=float).reshape(-1)
    normal = plane[:-1]
    if point.size != normal.size:
        raise ValueError("Dimensions do not match")
    if not np.any(normal):
        raise ValueError("plane must have at least one non-zero coefficient")
    # For n.x + c = 0, subtract twice the signed normal displacement.
    return point - 2.0 * (point @ normal + plane[-1]) / (normal @ normal) * normal


def rotate_2d(points: np.ndarray, clockwise_angle_degrees: float) -> np.ndarray:
    """Rotate rows of 2-D points clockwise, porting ``rotate_2d.m``."""

    values = np.asarray(points, dtype=float)
    if values.ndim != 2 or values.shape[1] != 2:
        raise ValueError("points must have shape (n, 2)")
    angle = np.deg2rad(-clockwise_angle_degrees)
    rotation = np.array([[np.cos(angle), -np.sin(angle)], [np.sin(angle), np.cos(angle)]])
    return values @ rotation.T
