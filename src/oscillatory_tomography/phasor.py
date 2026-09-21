"""Complex-valued finite-volume model for oscillatory hydraulic tests.

This module ports ``phasor_model_form.m`` and ``phasor_model_obssens.m``.
Array flattening deliberately uses MATLAB/Fortran order.  All transposes used
in the adjoint calculation are ordinary transposes, not complex-conjugate
transposes, matching MATLAB's ``.'`` operator in the original source.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy import sparse
from scipy.sparse.linalg import splu

from .models import Boundaries, Domain, Experiment


@dataclass(frozen=True)
class _Edge:
    """One connection between two neighboring finite-volume cells."""

    p: int
    q: int
    conductance: float
    derivative_p: float
    derivative_q: float


@dataclass(frozen=True)
class _BoundaryFace:
    """One fixed-head boundary contribution and its K derivative."""

    p: int
    conductance: float
    derivative: float
    value: float


@dataclass(frozen=True)
class PreparedPhasorModel:
    """Frequency-independent matrices and geometry shared by experiments.

    Keeping the derivative geometry here avoids repeating the most expensive
    assembly work when a test case contains several pumping periods.
    """

    steady: sparse.csc_matrix
    omega_part: sparse.csc_matrix
    boundary_rhs: sparse.csc_matrix
    edges: list[_Edge]
    boundary_faces: list[_BoundaryFace]
    cell_volume: np.ndarray


def _as_3d(values: np.ndarray, shape: tuple[int, int, int], name: str) -> np.ndarray:
    array = np.asarray(values, dtype=float)
    if array.size != int(np.prod(shape)):
        raise ValueError(f"{name} has {array.size} entries; expected {np.prod(shape)}")
    return array.reshape(shape, order="F")


def _cell_index(i: int, j: int, k: int, ny: int, nx: int) -> int:
    """Return the zero-based equivalent of MATLAB's sub2ind([ny,nx,nz],...)."""

    return i + ny * j + ny * nx * k


def _geometry(
    domain: Domain,
    boundaries: Boundaries,
    conductivity: np.ndarray,
) -> tuple[list[_Edge], list[_BoundaryFace], np.ndarray]:
    """Build face conductances and analytic derivatives with respect to K."""

    x = np.asarray(domain.x, dtype=float)
    y = np.asarray(domain.y, dtype=float)
    z = np.asarray(domain.z, dtype=float)
    dx, dy, dz = np.diff(x), np.diff(y), np.diff(z)
    ny, nx, nz = len(dy), len(dx), len(dz)
    shape = (ny, nx, nz)
    K = _as_3d(conductivity, shape, "conductivity")

    edges: list[_Edge] = []

    def add_edge(p: int, q: int, kp: float, kq: float, ap: float, aq: float, area: float) -> None:
        # Harmonic averaging across a face, exactly as in phasor_model_form.m.
        denominator = kp * aq + kq * ap
        conductance = 2.0 * kp * kq * area / denominator
        derivative_p = 2.0 * area * kq**2 * ap / denominator**2
        derivative_q = 2.0 * area * kp**2 * aq / denominator**2
        edges.append(_Edge(p, q, conductance, derivative_p, derivative_q))

    # X-directed connections.
    for k in range(nz):
        for j in range(nx - 1):
            for i in range(ny):
                p = _cell_index(i, j, k, ny, nx)
                q = _cell_index(i, j + 1, k, ny, nx)
                add_edge(p, q, K[i, j, k], K[i, j + 1, k], dx[j], dx[j + 1], dy[i] * dz[k])

    # Y-directed connections.
    for k in range(nz):
        for j in range(nx):
            for i in range(ny - 1):
                p = _cell_index(i, j, k, ny, nx)
                q = _cell_index(i + 1, j, k, ny, nx)
                add_edge(p, q, K[i, j, k], K[i + 1, j, k], dy[i], dy[i + 1], dx[j] * dz[k])

    # Z-directed connections.
    for k in range(nz - 1):
        for j in range(nx):
            for i in range(ny):
                p = _cell_index(i, j, k, ny, nx)
                q = _cell_index(i, j, k + 1, ny, nx)
                add_edge(p, q, K[i, j, k], K[i, j, k + 1], dz[k], dz[k + 1], dy[i] * dx[j])

    types = np.asarray(boundaries.types).reshape(-1)
    values = np.asarray(boundaries.values, dtype=float).reshape(-1)
    if types.size != 6 or values.size != 6:
        raise ValueError("boundaries.types and boundaries.values must contain six faces")

    boundary_faces: list[_BoundaryFace] = []

    def add_boundary(p: int, k_value: float, area: float, width: float, face: int) -> None:
        if int(types[face]) != 1:
            return
        conductance = 2.0 * k_value * area / width
        boundary_faces.append(_BoundaryFace(p, conductance, 2.0 * area / width, values[face]))

    # Face order retained from MATLAB: west, east, south, north, bottom, top.
    if nx > 1:
        for k in range(nz):
            for i in range(ny):
                add_boundary(_cell_index(i, 0, k, ny, nx), K[i, 0, k], dy[i] * dz[k], dx[0], 0)
                add_boundary(
                    _cell_index(i, nx - 1, k, ny, nx), K[i, nx - 1, k], dy[i] * dz[k], dx[-1], 1
                )
    elif np.any(types[:2] == 1):
        raise ValueError("Cannot apply fixed-head X boundary conditions to a one-cell X dimension")

    if ny > 1:
        for k in range(nz):
            for j in range(nx):
                add_boundary(_cell_index(0, j, k, ny, nx), K[0, j, k], dx[j] * dz[k], dy[0], 2)
                add_boundary(
                    _cell_index(ny - 1, j, k, ny, nx), K[ny - 1, j, k], dx[j] * dz[k], dy[-1], 3
                )
    elif np.any(types[2:4] == 1):
        raise ValueError("Cannot apply fixed-head Y boundary conditions to a one-cell Y dimension")

    if nz > 1:
        for j in range(nx):
            for i in range(ny):
                add_boundary(_cell_index(i, j, 0, ny, nx), K[i, j, 0], dy[i] * dx[j], dz[0], 4)
                add_boundary(
                    _cell_index(i, j, nz - 1, ny, nx), K[i, j, nz - 1], dy[i] * dx[j], dz[-1], 5
                )
    elif np.any(types[4:] == 1):
        raise ValueError("Cannot apply fixed-head Z boundary conditions to a one-cell Z dimension")

    volume = np.meshgrid(dx, dy, dz, indexing="xy")
    cell_volume = (volume[0] * volume[1] * volume[2]).reshape(-1, order="F")
    return edges, boundary_faces, cell_volume


def phasor_model_form(
    domain: Domain,
    boundaries: Boundaries,
    conductivity: np.ndarray,
    specific_storage: np.ndarray,
) -> tuple[sparse.csc_matrix, sparse.csc_matrix, sparse.csc_matrix]:
    """Form the steady, frequency-dependent, and boundary RHS matrices.

    This is the Python equivalent of ``phasor_model_form.m``.  The frequency
    term is returned without omega, so callers form ``A + omega * Aomega``.
    """

    edges, boundary_faces, cell_volume = _geometry(domain, boundaries, conductivity)
    return _form_from_geometry(domain, specific_storage, edges, boundary_faces, cell_volume)


def _form_from_geometry(
    domain: Domain,
    specific_storage: np.ndarray,
    edges: list[_Edge],
    boundary_faces: list[_BoundaryFace],
    cell_volume: np.ndarray,
) -> tuple[sparse.csc_matrix, sparse.csc_matrix, sparse.csc_matrix]:
    """Assemble sparse matrices from already-computed geometry."""

    dx, dy, dz = np.diff(domain.x), np.diff(domain.y), np.diff(domain.z)
    shape = (len(dy), len(dx), len(dz))
    n_cells = int(np.prod(shape))
    Ss = _as_3d(specific_storage, shape, "specific_storage").reshape(-1, order="F")

    rows: list[int] = []
    cols: list[int] = []
    data: list[float] = []
    diagonal = np.zeros(n_cells)

    for edge in edges:
        # Flux leaving either cell enters the other, producing equal positive
        # diagonal terms and equal negative off-diagonal conductances.
        diagonal[edge.p] += edge.conductance
        diagonal[edge.q] += edge.conductance
        rows.extend((edge.p, edge.q))
        cols.extend((edge.q, edge.p))
        data.extend((-edge.conductance, -edge.conductance))

    bbc = np.zeros(n_cells)
    for face in boundary_faces:
        # A prescribed head adds conductance to A and conductance*head to b.
        diagonal[face.p] += face.conductance
        bbc[face.p] += face.conductance * face.value

    rows.extend(range(n_cells))
    cols.extend(range(n_cells))
    data.extend(diagonal)
    steady = sparse.csc_matrix((data, (rows, cols)), shape=(n_cells, n_cells))
    # Oscillatory storage contributes i*omega*Ss*volume.  NumPy/SciPy natively
    # preserve this complex matrix arithmetic; no real/imaginary workaround is
    # required compared with MATLAB.
    omega_part = sparse.diags(1j * Ss * cell_volume, format="csc")
    boundary_rhs = sparse.csc_matrix(bbc[:, None])
    return steady, omega_part, boundary_rhs


def prepare_phasor_model(
    domain: Domain,
    boundaries: Boundaries,
    conductivity: np.ndarray,
    specific_storage: np.ndarray,
) -> PreparedPhasorModel:
    """Precompute matrices shared by every frequency in one model run.

    The MATLAB wrappers rebuild these frequency-independent quantities for
    each omega group. Reusing them is the first targeted Python optimization.
    """

    edges, boundary_faces, cell_volume = _geometry(domain, boundaries, conductivity)
    steady, omega_part, boundary_rhs = _form_from_geometry(
        domain, specific_storage, edges, boundary_faces, cell_volume
    )
    return PreparedPhasorModel(
        steady, omega_part, boundary_rhs, edges, boundary_faces, cell_volume
    )


def phasor_model_obssens(
    domain: Domain,
    boundaries: Boundaries,
    experiment: Experiment,
    conductivity: np.ndarray,
    specific_storage: np.ndarray,
    *,
    compute_field: bool = False,
    compute_sensitivities: bool = False,
    prepared: PreparedPhasorModel | None = None,
) -> tuple[np.ndarray, np.ndarray | None, tuple[np.ndarray, np.ndarray] | None]:
    """Simulate complex observations and optionally calculate sensitivities.

    Sensitivities returned here are with respect to physical K and Ss.  The
    higher-level forward wrapper applies the chain rule for log parameters.
    """

    if prepared is None:
        prepared = prepare_phasor_model(domain, boundaries, conductivity, specific_storage)
    steady = prepared.steady
    omega_part = prepared.omega_part
    boundary_rhs = prepared.boundary_rhs
    system = (steady + float(experiment.omega) * omega_part).tocsc()
    # Factor A(omega) once, then solve every distinct stimulus at this frequency
    # as multiple right-hand sides in a single call.
    solver = splu(system)
    stims = experiment.stims.tocsc()
    obs = experiment.obs.tocsc()
    rhs = stims.toarray() + boundary_rhs.toarray()
    phi = solver.solve(rhs)

    tests = np.asarray(experiment.tests, dtype=int)
    simulated = np.empty(tests.shape[0], dtype=complex)
    for test_number, (stim_type, obs_type) in enumerate(tests):
        # Sparse interpolation weights turn cell-centered complex heads into the
        # requested well observation for each pump/observation test pairing.
        simulated[test_number] = complex((obs[:, obs_type].T @ phi[:, stim_type]).item())

    sensitivities: tuple[np.ndarray, np.ndarray] | None = None
    if compute_sensitivities:
        dx, dy, dz = np.diff(domain.x), np.diff(domain.y), np.diff(domain.z)
        shape = (len(dy), len(dx), len(dz))
        n_cells = int(np.prod(shape))
        edges = prepared.edges
        boundary_faces = prepared.boundary_faces
        cell_volume = prepared.cell_volume

        # MATLAB uses A.' here.  SciPy's .T is likewise non-conjugating.
        adjoint = splu(system.T.tocsc()).solve(obs.toarray())
        h_k = np.empty((tests.shape[0], n_cells), dtype=complex)
        h_ss = np.empty((tests.shape[0], n_cells), dtype=complex)

        for test_number, (stim_type, obs_type) in enumerate(tests):
            field = phi[:, stim_type]
            r_rows: list[int] = []
            r_cols: list[int] = []
            r_data: list[complex] = []

            for edge in edges:
                delta = field[edge.q] - field[edge.p]
                # -dA/dK * Phi for each of the two K parameters touching a face.
                r_rows.extend((edge.p, edge.q, edge.p, edge.q))
                r_cols.extend((edge.p, edge.p, edge.q, edge.q))
                r_data.extend(
                    (
                        edge.derivative_p * delta,
                        -edge.derivative_p * delta,
                        edge.derivative_q * delta,
                        -edge.derivative_q * delta,
                    )
                )

            for face in boundary_faces:
                # d(b-A*Phi)/dK for a prescribed-head face.
                r_rows.append(face.p)
                r_cols.append(face.p)
                r_data.append(face.derivative * (face.value - field[face.p]))

            residual_derivative = sparse.csc_matrix(
                (r_data, (r_rows, r_cols)), shape=(n_cells, n_cells)
            )
            lam = adjoint[:, obs_type]
            h_k[test_number, :] = np.asarray(lam.T @ residual_derivative).reshape(-1)

            # d(A*phi-b)/dSs is i*omega*volume*phi; implicit differentiation
            # contributes the leading minus sign before the adjoint product.
            storage_rhs = -1j * float(experiment.omega) * cell_volume * field
            h_ss[test_number, :] = lam * storage_rhs

        sensitivities = (h_k, h_ss)

    return simulated, phi if compute_field else None, sensitivities
