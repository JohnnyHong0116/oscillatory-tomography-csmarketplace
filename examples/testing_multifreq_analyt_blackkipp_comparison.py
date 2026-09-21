"""Python port of ``testing_multifreq_analyt_blackkipp_comparison.m``.

Runs the numerical forward model and compares it with the corrected
Black-Kipp semi-infinite analytical solution over 20 pumping periods.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from time import perf_counter

import matplotlib.pyplot as plt
import numpy as np
from scipy.special import kv

from oscillatory_tomography import Boundaries, create_inputs, run_distributed_k_ss
from oscillatory_tomography.grid import equigrid_setup


def run_case(
    *, include_fields: bool = False, workers: int = 1
) -> dict[str, np.ndarray | float | None]:
    # Bounds of the domain, and number of cells in the discretization (last).
    domain = equigrid_setup(np.array([-300, 300, 300]), np.array([-300, 300, 300]))

    # Locations of all wells (pumping and observation).
    well_locs = np.array([[0, 0], [0, 30], [60, 0], [0, -90], [-120, 0]], dtype=float)

    # Specify x/y constant-head boundaries and no-flow z boundaries.
    boundaries = Boundaries(np.array([1, 1, 1, 1, 0, 0]), np.zeros(6))

    # Each observation row contains angular frequency, pumping well, Q_max,
    # and observation well. One-based well numbers preserve the MATLAB input.
    periods = np.logspace(1, 4, 20)
    q_max = -1e-3
    test_list = np.asarray(
        [[2 * np.pi / period, 1, q_max, observation] for period in periods for observation in range(2, 6)]
    )
    experiments = create_inputs(well_locs, test_list, domain)
    num_cells = 300 * 300

    # Homogeneous synthetic parameter fields.
    mean_ln_t = np.log(3e-4)
    mean_ln_s = np.log(1e-5)
    true_parameters = np.concatenate((np.full(num_cells, mean_ln_t), np.full(num_cells, mean_ln_s)))

    # Perform all model runs. Output ordering is all real coefficients,
    # followed by all imaginary coefficients of the phasor.
    start = perf_counter()
    simulated = run_distributed_k_ss(
        true_parameters, domain, boundaries, experiments, 1, workers=workers
    )
    elapsed = perf_counter() - start
    simulated_fields = (
        run_distributed_k_ss(true_parameters, domain, boundaries, experiments, 2, workers=workers)
        if include_fields
        else None
    )
    num_observations = len(test_list)
    a_obs = -simulated[:num_observations]
    b_obs = -simulated[num_observations:]
    amplitude = np.hypot(a_obs, b_obs)
    phase = np.mod(np.arctan2(-b_obs, a_obs), 2 * np.pi)

    # Store numerical data in the same eight-column layout as synth_data.
    synthetic = np.zeros((num_observations, 8))
    for index, test in enumerate(test_list):
        pump, observation = int(test[1]) - 1, int(test[3]) - 1
        synthetic[index] = (
            test[3],
            np.linalg.norm(well_locs[pump] - well_locs[observation]),
            2 * np.pi / test[0],
            abs(test[2]),
            amplitude[index],
            phase[index],
            a_obs[index],
            b_obs[index],
        )

    # Analytical Black-Kipp solution, as corrected by Cardiff.
    analytical = np.zeros_like(synthetic)
    for index, row in enumerate(synthetic):
        well_number, radius, period, pumping_rate = row[:4]
        omega = 2 * np.pi / period
        u = np.sqrt(omega * np.exp(mean_ln_s) * radius**2 / (2 * np.exp(mean_ln_t)))
        bessel = kv(0, u + 1j * u)
        phasor = pumping_rate / (2 * np.pi * np.exp(mean_ln_t)) * bessel
        analytical[index] = (
            well_number, radius, period, pumping_rate, abs(phasor),
            np.mod(-np.angle(bessel), 2 * np.pi), phasor.real, phasor.imag,
        )

    amplitude_error = np.abs((analytical[:, 4] - synthetic[:, 4]) / analytical[:, 4])
    raw_phase_error = np.abs(analytical[:, 5] - synthetic[:, 5])
    phase_error = np.minimum(raw_phase_error, 2 * np.pi - raw_phase_error)

    # Process numerical results using the homogeneous analytical assumption.
    coefficients = np.array([-0.12665, 2.8642, -0.47779, 0.16586, -0.076402, 0.03089])
    results = np.zeros((num_observations, 5))
    for index, row in enumerate(synthetic):
        well_number, radius, period, pumping_rate, observed_amp, observed_phase = row[:6]
        omega = 2 * np.pi / period
        rasmussen_sum = sum(c * np.log(observed_phase) ** power for power, c in enumerate(coefficients))
        diffusivity = omega * radius**2 / np.exp(rasmussen_sum)
        u_estimate = np.sqrt(omega * radius**2 / (2 * diffusivity))
        transmissivity = pumping_rate / (2 * np.pi * observed_amp) * abs(kv(0, u_estimate * (1 + 1j)))
        results[index] = well_number, period, transmissivity, transmissivity / diffusivity, diffusivity

    return {
        "synthetic": synthetic,
        "analytical": analytical,
        "results": results,
        "simulated": simulated,
        "simulated_fields": simulated_fields,
        "elapsed": elapsed,
        "mean_amplitude_error": float(amplitude_error.mean()),
        "mean_phase_error": float(phase_error.mean()),
    }


def plot_comparison(result: dict[str, np.ndarray | float], output: Path) -> None:
    synthetic = result["synthetic"]
    analytical = result["analytical"]
    fig, axes = plt.subplots(1, 2, figsize=(13, 5), constrained_layout=True)
    for radius in np.unique(synthetic[:, 1]):
        selected = synthetic[:, 1] == radius
        axes[0].loglog(synthetic[selected, 2], synthetic[selected, 4], "^", label=f"{radius:g} m numerical")
        axes[0].loglog(analytical[selected, 2], analytical[selected, 4], "-")
        axes[1].semilogx(synthetic[selected, 2], synthetic[selected, 5], "^")
        axes[1].semilogx(analytical[selected, 2], analytical[selected, 5], "-")
    axes[0].set(xlabel="Period (s)", ylabel="Amplitude (m)")
    axes[1].set(xlabel="Period (s)", ylabel="Phase delay (radians)")
    for axis in axes:
        axis.grid(True)
    axes[0].legend(fontsize=8)
    output.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output, dpi=160)
    plt.close(fig)

    # Plot the effective diffusivity, transmissivity, and storativity obtained
    # by applying the homogeneous Rasmussen analysis to numerical results.
    estimates = result["results"]
    estimate_output = output.with_name(f"{output.stem}_estimated_properties{output.suffix}")
    fig, axes = plt.subplots(1, 3, figsize=(15, 4.5), constrained_layout=True)
    labels = ((4, "Diffusivity (m²/s)"), (2, "Transmissivity (m²/s)"), (3, "Storativity"))
    for axis, (column, label) in zip(axes, labels):
        axis.loglog(estimates[:, 1], estimates[:, column], "o", markersize=3)
        axis.set(xlabel="Period (s)", ylabel=label)
        axis.grid(True)
    fig.savefig(estimate_output, dpi=160)
    plt.close(fig)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("python_outputs/black_kipp_comparison.png"))
    parser.add_argument(
        "--include-fields",
        action="store_true",
        help="also calculate the original full 90,000-cell phasor fields",
    )
    parser.add_argument("--workers", type=int, default=1, help="parallel frequency-group solves")
    args = parser.parse_args()
    result = run_case(include_fields=args.include_fields, workers=args.workers)
    plot_comparison(result, args.output)
    print(f"Forward runtime: {result['elapsed']:.3f} s")
    print(f"Mean relative amplitude error: {result['mean_amplitude_error']:.16g}")
    print(f"Mean absolute phase error: {result['mean_phase_error']:.16g} rad")
    print(f"norm(sim_obs): {np.linalg.norm(result['simulated']):.16g}")
    if result["simulated_fields"] is not None:
        print(f"Full phasor field shape: {result['simulated_fields'].shape}")
    print(f"Saved plot to {args.output.resolve()}")


if __name__ == "__main__":
    main()
