"""Small data containers corresponding to MATLAB structures."""

from dataclasses import dataclass

import numpy as np
from scipy import sparse


@dataclass(frozen=True)
class Domain:
    """Cell-boundary coordinates in x, y, and z."""

    x: np.ndarray
    y: np.ndarray
    z: np.ndarray


@dataclass(frozen=True)
class Boundaries:
    """Boundary types and values for [low-x, high-x, low-y, high-y, low-z, high-z]."""

    types: np.ndarray
    values: np.ndarray


@dataclass(frozen=True)
class Experiment:
    """One frequency group's tests, stimulation vectors, and observation weights."""

    omega: float
    tests: np.ndarray
    stims: sparse.csc_matrix
    obs: sparse.csc_matrix

