"""Geostatistical inversion routines translated from the MATLAB project."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

import numpy as np
from scipy import optimize
from scipy.sparse.linalg import LinearOperator, minres
from scipy.linalg import null_space, orth

Covariance = np.ndarray | Callable[[np.ndarray], np.ndarray]


@dataclass(frozen=True)
class InversionResult:
    """Results returned by the quasi-linear geostatistical inversion."""

    parameters: np.ndarray
    beta: np.ndarray
    sensitivity: np.ndarray
    nlap: float
    iterations: int


@dataclass(frozen=True)
class ResidualStatistics:
    """Outputs from the linear geostatistical residual diagnostic."""

    delta_residual: np.ndarray
    standard_error: np.ndarray
    orthonormal_residual: np.ndarray
    scaled_error: float
    q2: float


def _q_product(q: Covariance, values: np.ndarray) -> np.ndarray:
    # Large regular-grid covariances are supplied as FFT-backed callables.  This
    # keeps the inverse routines matrix-free while retaining dense-array support.
    if callable(q):
        rhs = np.asarray(values)
        if rhs.ndim == 1:
            return np.asarray(q(rhs)).reshape(-1)
        return np.column_stack([np.asarray(q(rhs[:, i])).reshape(-1) for i in range(rhs.shape[1])])
    return np.asarray(q) @ values


def linear_geostatistical_inverse(
    data: np.ndarray,
    drift: np.ndarray,
    error_covariance: np.ndarray,
    parameter_covariance: Covariance,
    sensitivity: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Solve one linearized geostatistical inverse problem.

    This ports ``lin_geostat_inv.m``.  It returns the parameter estimate,
    representer coefficients ``xi``, and drift coefficients ``beta``.
    """

    y = np.asarray(data, dtype=float).reshape(-1)
    x = np.asarray(drift, dtype=float)
    r = np.asarray(error_covariance, dtype=float)
    h = np.asarray(sensitivity, dtype=float)
    m = y.size
    p = x.shape[1]

    # The geostatistical representer formulation works in observation space:
    # QH' is reused both in Psi = HQH' + R and in the parameter reconstruction.
    qht = _q_product(parameter_covariance, h.T)
    psi = h @ qht + r
    phi = h @ x
    # Solve for representer weights xi and drift coefficients beta together.
    saddle = np.block([[psi, phi], [phi.T, np.zeros((p, p))]])
    solution = np.linalg.solve(saddle, np.concatenate((y, np.zeros(p))))
    xi = solution[:m]
    beta = solution[m:]
    estimate = x @ beta + qht @ xi
    return estimate, xi, beta


def geostatistical_residuals(
    data: np.ndarray,
    sensitivity: np.ndarray,
    drift: np.ndarray,
    error_covariance: np.ndarray,
    parameter_covariance: np.ndarray,
) -> ResidualStatistics:
    """Compute the diagnostics in ``geostat_resid_compute.m``."""

    y = np.asarray(data, dtype=float).reshape(-1)
    h = np.asarray(sensitivity, dtype=float)
    x = np.asarray(drift, dtype=float)
    r = np.asarray(error_covariance, dtype=float)
    q = np.asarray(parameter_covariance, dtype=float)
    m, p = y.size, x.shape[1]
    psi = h @ q @ h.T + r
    phi = h @ x
    # Project away the unknown drift component before standardizing residuals.
    # SciPy returns null-space vectors as columns; the transpose follows the
    # row-basis convention used in geostat_resid_compute.m.
    p_basis = null_space(phi.T).T
    pyy = p_basis.T @ np.linalg.solve(p_basis @ psi @ p_basis.T, p_basis)
    transform = orth(pyy).T
    delta = transform @ y
    variances = np.diag(transform @ psi @ transform.T)
    standard_error = np.sqrt(variances)
    normalized = delta / standard_error
    # q2 is the mean squared standardized residual after accounting for p drift
    # coefficients; scaled_error also includes the residual covariance volume.
    q2 = float(np.sum(normalized**2) / (m - p))
    scaled_error = float(q2 * np.exp(np.sum(np.log(variances)) / (m - p)))
    return ResidualStatistics(delta, standard_error, normalized, scaled_error, q2)


def negative_log_a_posteriori(
    data: np.ndarray,
    drift: np.ndarray,
    parameters: np.ndarray,
    beta: np.ndarray,
    parameter_covariance: Covariance,
    error_covariance: np.ndarray,
    forward_function: Callable[[np.ndarray], np.ndarray],
) -> float:
    """Evaluate the data-misfit plus prior objective from ``NLAP_eval.m``."""

    y = np.asarray(data, dtype=float).reshape(-1)
    s = np.asarray(parameters, dtype=float).reshape(-1)
    # NLAP is the sum of a measurement-error-weighted data mismatch and a
    # covariance-weighted departure from the current drift model X*beta.
    residual = y - np.asarray(forward_function(s)).reshape(-1)
    data_part = 0.5 * float(residual @ np.linalg.solve(error_covariance, residual))
    deviation = s - np.asarray(drift) @ np.asarray(beta).reshape(-1)

    if callable(parameter_covariance):
        # Only Q*v is available for FFT-backed covariance operators.  MINRES
        # obtains Q^-1*v iteratively without materializing or factoring Q.
        operator = LinearOperator(
            (deviation.size, deviation.size),
            matvec=lambda value: np.asarray(parameter_covariance(value)).reshape(-1),
            dtype=float,
        )
        q_inverse_deviation, info = minres(operator, deviation, rtol=1e-4, maxiter=10_000)
        if info != 0:
            raise RuntimeError(f"MINRES did not converge while evaluating the prior (info={info})")
    else:
        q_inverse_deviation = np.linalg.solve(parameter_covariance, deviation)
    prior_part = 0.5 * float(deviation @ q_inverse_deviation)
    return data_part + prior_part


def quasi_linear_geostatistical_inverse(
    data: np.ndarray,
    initial_parameters: np.ndarray,
    initial_beta: np.ndarray,
    drift: np.ndarray,
    error_covariance: np.ndarray,
    parameter_covariance: Covariance,
    forward_function: Callable[[np.ndarray], np.ndarray],
    sensitivity_function: Callable[[np.ndarray], np.ndarray],
    *,
    max_line_search: int = 20,
    max_gradient_evaluations: int = 30,
    objective_tolerance: float = 0.001,
    parameter_tolerance: float = 0.001,
    line_search_tolerance: float = 0.001,
    progress: Callable[[int, float], None] | None = None,
) -> InversionResult:
    """Run Kitanidis' quasi-linear geostatistical method.

    Defaults mirror ``ql_geostat_inv.m``.  The optional progress callback
    receives ``(iteration, NLAP)`` after each accepted iteration.
    """

    y = np.asarray(data, dtype=float).reshape(-1)
    s_tilde = np.asarray(initial_parameters, dtype=float).reshape(-1).copy()
    beta_tilde = np.asarray(initial_beta, dtype=float).reshape(-1).copy()
    s_hat = s_tilde.copy()
    beta_hat = beta_tilde.copy()

    def objective(s: np.ndarray, beta: np.ndarray) -> float:
        return negative_log_a_posteriori(
            y, drift, s, beta, parameter_covariance, error_covariance, forward_function
        )

    nlap = objective(s_tilde, beta_tilde)
    nlap_new = nlap
    objective_change = 0.0
    parameter_change = 0.0
    iterations = 0
    h_tilde: np.ndarray | None = None

    while (
        ((objective_change > objective_tolerance) and (parameter_change > parameter_tolerance)
         and (iterations < max_gradient_evaluations))
        or iterations == 0
    ):
        s_tilde = s_hat.copy()
        # Preserve the original ql_geostat_inv.m behavior: beta_tilde stays
        # at beta_init while s_tilde advances between iterations.
        nlap = nlap_new
        # Linearize the nonlinear forward model about the current parameter
        # estimate, then solve the resulting geostatistical inverse problem.
        h_tilde = np.asarray(sensitivity_function(s_tilde), dtype=float)
        iterations += 1
        h_at_tilde = np.asarray(forward_function(s_tilde), dtype=float).reshape(-1)
        linearized_data = y - h_at_tilde + h_tilde @ s_tilde
        s_candidate, _, beta_candidate = linear_geostatistical_inverse(
            linearized_data, drift, error_covariance, parameter_covariance, h_tilde
        )
        candidate_nlap = objective(s_candidate, beta_candidate)

        if max_line_search > 0:
            # Search along the joint (parameter, drift) update.  Nelder-Mead is
            # retained here to match the unconstrained MATLAB fminsearch step.
            delta_s = s_candidate - s_tilde
            delta_beta = beta_candidate - beta_tilde
            start = 1.0 if candidate_nlap < nlap else 0.0

            def line_objective(step_array: np.ndarray) -> float:
                step = float(np.asarray(step_array).reshape(-1)[0])
                return objective(s_tilde + step * delta_s, beta_tilde + step * delta_beta)

            search = optimize.minimize(
                line_objective,
                np.array([start]),
                method="Nelder-Mead",
                options={
                    "maxiter": max_line_search,
                    "fatol": line_search_tolerance * max(abs(candidate_nlap if start else nlap), 1.0),
                    "xatol": 1e-4,
                    "disp": False,
                },
            )
            step = float(search.x[0])
            s_hat = s_tilde + step * delta_s
            beta_hat = beta_tilde + step * delta_beta
            nlap_new = objective(s_hat, beta_hat)
        else:
            s_hat = s_candidate
            beta_hat = beta_candidate
            nlap_new = candidate_nlap

        # Both the relative objective improvement and largest relative parameter
        # change must remain significant for another outer iteration to run.
        objective_change = (nlap - nlap_new) / nlap if nlap != 0.0 else 0.0
        denominator = np.where(s_tilde != 0.0, np.abs(s_tilde), 1.0)
        parameter_change = float(np.max(np.abs(s_tilde - s_hat) / denominator))
        if progress is not None:
            progress(iterations, nlap_new)

    # Return whichever of the previous or proposed iterates has lower NLAP.
    if nlap_new < nlap:
        final_parameters = s_hat
        final_beta = beta_hat
        final_sensitivity = np.asarray(sensitivity_function(s_hat), dtype=float)
        final_nlap = nlap_new
    else:
        final_parameters = s_tilde
        final_beta = beta_tilde
        if h_tilde is None:
            h_tilde = np.asarray(sensitivity_function(s_tilde), dtype=float)
        final_sensitivity = h_tilde
        final_nlap = nlap

    return InversionResult(
        parameters=final_parameters,
        beta=final_beta,
        sensitivity=final_sensitivity,
        nlap=float(final_nlap),
        iterations=iterations,
    )
