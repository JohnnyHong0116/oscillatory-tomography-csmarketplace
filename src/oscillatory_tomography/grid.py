"""Grid and experiment setup translated from the MATLAB helper functions."""

from __future__ import annotations

from itertools import product

import numpy as np
from scipy import sparse

from .models import Domain, Experiment


def plaid_coord(
    x: np.ndarray,
    y: np.ndarray,
    z: np.ndarray | None = None,
) -> tuple[np.ndarray, tuple[np.ndarray, ...]]:
    """Create the coordinate list and mesh grids from ``plaid_coord.m``."""

    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    if z is None:
        x_grid, y_grid = np.meshgrid(x, y, indexing="xy")
        grids = (x_grid, y_grid)
    else:
        x_grid, y_grid, z_grid = np.meshgrid(x, y, np.asarray(z, dtype=float), indexing="xy")
        grids = (x_grid, y_grid, z_grid)
    # MATLAB linear indexing advances down the first array dimension.  Fortran
    # order reproduces that layout when mesh arrays become coordinate columns.
    coordinates = np.column_stack([grid.reshape(-1, order="F") for grid in grids])
    return coordinates, grids


def equigrid_setup(
    x_disc: np.ndarray,
    y_disc: np.ndarray,
    z_disc: np.ndarray | None = None,
) -> Domain:
    """Create the ``domain`` structure needed by the steady-periodic model.

    Original MATLAB behavior:
    ``x_disc``, ``y_disc``, and optional ``z_disc`` contain the minimum,
    maximum, and number of cells. If z is omitted, assume unit thickness and
    one cell.
    """

    if z_disc is None:
        z_disc = np.array([0.0, 1.0, 1.0])
    # Domain coordinates describe cell faces, so n cells require n+1 values.
    return Domain(
        x=np.linspace(x_disc[0], x_disc[1], int(x_disc[2]) + 1),
        y=np.linspace(y_disc[0], y_disc[1], int(y_disc[2]) + 1),
        z=np.linspace(z_disc[0], z_disc[1], int(z_disc[2]) + 1),
    )


def plaid_cellcenter_coord(domain: Domain) -> tuple[np.ndarray, tuple[np.ndarray, ...]]:
    """Return cell-center coordinates in MATLAB/Fortran vector order.

    The model starts at the lower south-west cell and increments through y
    first, then x, then z. NumPy defaults to C order, so every flatten and
    reshape that represents a MATLAB grid explicitly uses ``order="F"``.
    """

    xc = (domain.x[1:] + domain.x[:-1]) / 2.0
    yc = (domain.y[1:] + domain.y[:-1]) / 2.0
    zc = (domain.z[1:] + domain.z[:-1]) / 2.0
    return plaid_coord(xc, yc, zc if zc.size > 1 else None)


def _neighbor_indices(value: float, grid: np.ndarray) -> np.ndarray:
    """Find the one or two neighboring indices used by MATLAB ``grid_idw``."""

    upper = int(np.searchsorted(grid, value, side="left"))
    if upper >= grid.size or value < grid[0]:
        raise ValueError("Interpolation location lies outside the grid centers")
    if grid[upper] == value:
        return np.array([upper], dtype=int)
    return np.array([upper - 1, upper], dtype=int)


def grid_idw(
    interp_locs: np.ndarray,
    grid_x: np.ndarray,
    grid_y: np.ndarray | None = None,
    grid_z: np.ndarray | None = None,
) -> sparse.csr_matrix:
    """Produce inverse-distance interpolation weights on a rectangular grid.

    This preserves the original restriction to at most ``2**dimension``
    neighboring points. Column numbering follows MATLAB ``meshgrid`` order:
    y first, then x, then z.
    """

    interp_locs = np.atleast_2d(np.asarray(interp_locs, dtype=float))
    grid_x = np.asarray(grid_x, dtype=float)
    if grid_y is None:
        grids = (grid_x,)
    elif grid_z is None:
        grids = (grid_x, np.asarray(grid_y, dtype=float))
    else:
        grids = (
            grid_x,
            np.asarray(grid_y, dtype=float),
            np.asarray(grid_z, dtype=float),
        )

    dimension = len(grids)
    if interp_locs.shape[1] != dimension:
        raise ValueError("Interpolation locations must match the grid dimension")

    rows: list[int] = []
    cols: list[int] = []
    data: list[float] = []
    num_y = grids[1].size if dimension >= 2 else 1
    num_x = grids[0].size

    for row, location in enumerate(interp_locs):
        neighbor_vectors = [
            _neighbor_indices(location[axis], grids[axis])
            for axis in range(dimension)
        ]

        # MATLAB combvec makes the first input vary fastest. itertools.product
        # varies the last input fastest, hence the reversed argument order.
        neighbors = [
            tuple(reversed(item))
            for item in product(*reversed(neighbor_vectors))
        ]
        squared_distance = np.array(
            [
                sum(
                    (grids[axis][neighbor[axis]] - location[axis]) ** 2
                    for axis in range(dimension)
                )
                for neighbor in neighbors
            ]
        )
        inverse_distance = np.empty_like(squared_distance)
        # MATLAB substitutes 1/eps for an infinite exact-location weight.  Once
        # normalized, that grid point receives effectively all of the weight.
        exact = squared_distance == 0.0
        inverse_distance[exact] = 1.0 / np.finfo(float).eps
        inverse_distance[~exact] = 1.0 / np.sqrt(squared_distance[~exact])
        weights = inverse_distance / inverse_distance.sum()

        for neighbor, weight in zip(neighbors, weights):
            x_index = neighbor[0]
            y_index = neighbor[1] if dimension >= 2 else 0
            z_index = neighbor[2] if dimension == 3 else 0
            column = z_index * num_y * num_x + x_index * num_y + y_index
            rows.append(row)
            cols.append(column)
            data.append(float(weight))

    grid_size = int(np.prod([grid.size for grid in grids]))
    return sparse.csr_matrix((data, (rows, cols)), shape=(interp_locs.shape[0], grid_size))


def create_inputs(
    well_locs: np.ndarray,
    test_list: np.ndarray,
    domain: Domain,
) -> list[Experiment]:
    """Create frequency-grouped inputs required by ``run_distributed_k_ss``.

    ``test_list`` retains the MATLAB public format and therefore uses one-based
    well numbers. ``Experiment.tests`` uses zero-based indices internally.
    Four-column monopole and six-column dipole tests are supported.
    """

    well_locs = np.asarray(well_locs, dtype=float)
    test_list = np.asarray(test_list)
    xc = (domain.x[1:] + domain.x[:-1]) / 2.0
    yc = (domain.y[1:] + domain.y[:-1]) / 2.0
    zc = (domain.z[1:] + domain.z[:-1]) / 2.0

    if zc.size > 1:
        if well_locs.shape[1] < 3:
            raise ValueError("well_locs must be 3-D when z is discretized")
        well_weights = grid_idw(well_locs, xc, yc, zc).T.tocsc()
    else:
        if well_locs.shape[1] != 2:
            raise ValueError("well_locs must be 2-D for a single z layer")
        well_weights = grid_idw(well_locs, xc, yc).T.tocsc()

    if test_list.shape[1] not in (4, 6):
        raise ValueError("test_list must have four (monopole) or six (dipole) columns")

    # The MATLAB code assumes equal frequencies are contiguous. Preserve that
    # behavior by splitting only where the value changes.
    split_points = np.flatnonzero(np.diff(test_list[:, 0]) != 0) + 1
    groups = np.split(test_list, split_points)
    experiments: list[Experiment] = []

    for group in groups:
        omega = float(np.real(group[0, 0]))
        if group.shape[1] == 4:
            # Collapse repeated observation and pumping configurations so one
            # PDE solution can serve every test that shares the same frequency.
            observation_wells, observation_map = np.unique(
                group[:, 3].astype(int) - 1, return_inverse=True
            )
            pump_rows, pump_map = np.unique(group[:, [1, 2]], axis=0, return_inverse=True)
            observation_weights = well_weights[:, observation_wells]
            inflows = well_weights[:, pump_rows[:, 0].astype(int) - 1].astype(complex)
            inflows = inflows.multiply(pump_rows[:, 1])
        else:
            observation_wells, observation_map = np.unique(
                group[:, 5].astype(int) - 1, return_inverse=True
            )
            pump_rows, pump_map = np.unique(group[:, [1, 2, 3, 4]], axis=0, return_inverse=True)
            observation_weights = well_weights[:, observation_wells]
            inflows_1 = well_weights[:, pump_rows[:, 0].astype(int) - 1].astype(complex)
            inflows_2 = well_weights[:, pump_rows[:, 2].astype(int) - 1].astype(complex)
            inflows = inflows_1.multiply(pump_rows[:, 1]) + inflows_2.multiply(pump_rows[:, 3])

        # Each test stores indices into the compact stimulus and observation
        # matrices.  These indices are zero-based only inside the Python model.
        tests = np.column_stack((pump_map, observation_map)).astype(int)
        experiments.append(
            Experiment(
                omega=omega,
                tests=tests,
                stims=inflows.tocsc(),
                obs=observation_weights.tocsc(),
            )
        )

    return experiments


def dimdist(x: np.ndarray, y: np.ndarray | None = None, *, signed: bool = False) -> np.ndarray:
    """Create one point-to-point distance matrix per spatial dimension."""

    x = np.atleast_2d(np.asarray(x, dtype=float))
    y = x if y is None else np.atleast_2d(np.asarray(y, dtype=float))
    if x.shape[1] != y.shape[1]:
        raise ValueError("Both arrays must have the same coordinate dimension")
    difference = y[None, :, :] - x[:, None, :]
    return difference if signed else np.abs(difference)


def euclidean_distance(x: np.ndarray, y: np.ndarray | None = None) -> np.ndarray:
    """Calculate the point-to-point distance matrix from ``eucdist.m``."""

    differences = dimdist(x, y, signed=True)
    return np.sqrt(np.sum(differences**2, axis=2))
