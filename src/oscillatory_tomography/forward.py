"""High-level distributed K/Ss forward model.

This ports ``OHT_run_distribKSs.m``.  Parameters are natural logarithms, as in
the MATLAB workflow, while the phasor solver itself receives physical values.
"""

from __future__ import annotations

import numpy as np

from .models import Boundaries, Domain, Experiment
from .phasor import phasor_model_obssens


def run_distributed_k_ss(
    params: np.ndarray,
    domain: Domain,
    boundaries: Boundaries,
    experiments: list[Experiment],
    mode: int = 1,
) -> np.ndarray:
    """Run the forward model in one of the original MATLAB output modes.

    ``mode=1`` returns a data vector (all real observations, then all imaginary
    observations). ``mode=2`` returns the real and imaginary simulated fields.
    ``mode=3`` returns the sensitivity matrix for ln(K) and ln(Ss).
    """

    parameters = np.asarray(params, dtype=float).reshape(-1)
    if parameters.size % 2:
        raise ValueError("params must contain equal-sized ln(K) and ln(Ss) fields")
    n_cells = parameters.size // 2
    conductivity = np.exp(parameters[:n_cells])
    specific_storage = np.exp(parameters[n_cells:])

    observations: list[np.ndarray] = []
    fields: list[np.ndarray] = []
    h_k_parts: list[np.ndarray] = []
    h_ss_parts: list[np.ndarray] = []

    for experiment in experiments:
        simulated, field, sensitivities = phasor_model_obssens(
            domain,
            boundaries,
            experiment,
            conductivity,
            specific_storage,
            compute_field=mode == 2,
            compute_sensitivities=mode == 3,
        )
        observations.append(simulated)
        if field is not None:
            fields.append(field)
        if sensitivities is not None:
            h_k_parts.append(sensitivities[0])
            h_ss_parts.append(sensitivities[1])

    if mode == 1:
        combined = np.concatenate(observations)
        return np.concatenate((combined.real, combined.imag))

    if mode == 2:
        combined_fields = np.concatenate(fields, axis=1)
        return np.vstack((combined_fields.real, combined_fields.imag))

    if mode == 3:
        h_k = np.vstack(h_k_parts)
        h_ss = np.vstack(h_ss_parts)
        # d/dln(x) = x*d/dx. MATLAB implements the same chain rule by
        # multiplying each sensitivity column by K or Ss.
        log_h_k = h_k * conductivity[None, :]
        log_h_ss = h_ss * specific_storage[None, :]
        complex_h = np.hstack((log_h_k, log_h_ss))
        return np.vstack((complex_h.real, complex_h.imag))

    raise ValueError("mode must be 1 (observations), 2 (fields), or 3 (sensitivities)")


def run_amplitude_distributed_k(
    params: np.ndarray,
    domain: Domain,
    boundaries: Boundaries,
    experiments: list[Experiment],
    mode: int = 1,
) -> np.ndarray:
    """Port ``OHT_run_ampdistribK.m`` for amplitude-only K analysis.

    Modes return amplitude observations, amplitude fields, or amplitude
    sensitivity with respect to ln(K), respectively.
    """

    parameters = np.asarray(params, dtype=float).reshape(-1)
    n_cells = parameters.size // 2
    if parameters.size != 2 * n_cells:
        raise ValueError("params must contain ln(K) followed by ln(Ss)")
    conductivity = np.exp(parameters[:n_cells])
    storage = np.exp(parameters[n_cells:])
    observation_parts: list[np.ndarray] = []
    field_parts: list[np.ndarray] = []
    sensitivity_parts: list[np.ndarray] = []

    for experiment in experiments:
        observations, field, sensitivities = phasor_model_obssens(
            domain,
            boundaries,
            experiment,
            conductivity,
            storage,
            compute_field=mode in (2, 3),
            compute_sensitivities=mode == 3,
        )
        if mode == 1:
            observation_parts.append(np.abs(observations))
        elif mode == 2:
            assert field is not None
            field_parts.append(np.abs(field))
        elif mode == 3:
            assert sensitivities is not None
            log_k_sensitivity = sensitivities[0] * conductivity[None, :]
            amplitude = np.abs(observations)
            safe_amplitude = np.where(amplitude == 0.0, np.finfo(float).eps, amplitude)
            sensitivity_parts.append(
                observations.real[:, None] / safe_amplitude[:, None] * log_k_sensitivity.real
                + observations.imag[:, None] / safe_amplitude[:, None] * log_k_sensitivity.imag
            )
        else:
            raise ValueError("mode must be 1, 2, or 3")
    if mode == 1:
        return np.concatenate(observation_parts)
    if mode == 2:
        return np.concatenate(field_parts, axis=1)
    return np.vstack(sensitivity_parts)


def run_distributed_aperture(
    params: np.ndarray,
    domain: Domain,
    boundaries: Boundaries,
    experiments: list[Experiment],
    mode: int = 1,
    water_properties: np.ndarray | None = None,
) -> np.ndarray:
    """Port ``OHT_run_distrib_aperture.m`` for a one-layer fracture.

    ``water_properties`` contains density, dynamic viscosity, compressibility,
    and gravitational acceleration. Defaults reproduce the MATLAB values.
    """

    if len(domain.z) != 2 or not np.allclose(domain.z, [0.0, 1.0]):
        raise ValueError("The aperture model requires one unitless z layer from 0 to 1")
    properties = (
        np.array([998.23, 1.0016e-3, 1.0 / 2.1e9, 9.81])
        if water_properties is None
        else np.asarray(water_properties, dtype=float).reshape(-1)
    )
    if properties.size != 4:
        raise ValueError("water_properties must contain density, viscosity, compressibility, and gravity")
    density, viscosity, compressibility, gravity = properties
    aperture = np.exp(np.asarray(params, dtype=float).reshape(-1))
    transmissivity = density * gravity * aperture**3 / (12.0 * viscosity)
    storage = density * gravity * compressibility * aperture

    observations_parts: list[np.ndarray] = []
    fields: list[np.ndarray] = []
    sensitivities_parts: list[np.ndarray] = []
    for experiment in experiments:
        observations, field, sensitivities = phasor_model_obssens(
            domain,
            boundaries,
            experiment,
            transmissivity,
            storage,
            compute_field=mode == 2,
            compute_sensitivities=mode == 3,
        )
        observations_parts.append(observations)
        if field is not None:
            fields.append(field)
        if sensitivities is not None:
            # Chain rule: dT/dln(a)=3T and dS/dln(a)=S.
            sensitivities_parts.append(
                sensitivities[0] * (3.0 * transmissivity)[None, :]
                + sensitivities[1] * storage[None, :]
            )
    if mode == 1:
        combined = np.concatenate(observations_parts)
        return np.concatenate((combined.real, combined.imag))
    if mode == 2:
        combined = np.concatenate(fields, axis=1)
        return np.vstack((combined.real, combined.imag))
    if mode == 3:
        combined = np.vstack(sensitivities_parts)
        return np.vstack((combined.real, combined.imag))
    raise ValueError("mode must be 1, 2, or 3")
