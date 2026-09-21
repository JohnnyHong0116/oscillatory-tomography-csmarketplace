"""P=10 Python transcription of ``testing_inversion_2D_geostat.m``.

This is the professor-approved first transcription case.  It retains the
scientific setup and section comments from the MATLAB script while replacing
MATLAB plotting and matrix syntax with NumPy, SciPy, and Matplotlib.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from time import perf_counter

import matplotlib.pyplot as plt
import numpy as np

from oscillatory_tomography import (
    Boundaries,
    Domain,
    create_inputs,
    plaid_cellcenter_coord,
    quasi_linear_geostatistical_inverse,
    run_distributed_k_ss,
)
from oscillatory_tomography.covariance import covariance_product_k_ss, toeplitz_matrix_math
from oscillatory_tomography.grid import dimdist


def build_case(
    periods: np.ndarray | None = None,
    truth: str = "checkerboard",
) -> dict[str, object]:
    """Describe the setup for the forward models."""

    # PARAMETERS: Associated with domain and testing setup.
    domain = Domain(
        x=np.arange(-50.0, 50.0 + 2.0, 2.0),
        y=np.arange(-50.0, 50.0 + 2.0, 2.0),
        z=np.array([0.0, 1.0]),
    )

    # Specify boundary types and boundary values (x/y constant-head
    # boundaries, no flux in z).
    boundaries = Boundaries(
        types=np.array([1, 1, 1, 1, 0, 0]),
        values=np.zeros(6),
    )

    # Locations of all wells (pumping and observation).
    well_locs = np.array(
        [
            [-20, -20], [-20, 0], [-20, 20],
            [0, -20], [0, 0], [0, 20],
            [20, -20], [20, 0], [20, 20],
        ],
        dtype=float,
    )

    # List defining each observation. Columns are pumping angular frequency,
    # pumping well, Q_max, and observation well. The model runs fastest when
    # sorted by angular frequency and pumping well (the first two columns).
    volume = 0.01
    if periods is None:
        periods = np.array([10.0])  # Professor-selected baseline period.
    test_rows: list[list[float]] = []
    for period in periods:
        for pump in range(1, len(well_locs) + 1):
            for observation in range(pump + 1, len(well_locs) + 1):
                test_rows.append([2.0 * np.pi / period, pump, volume * np.pi / period, observation])
    test_list = np.asarray(test_rows)

    # PARAMETERS: Associated with creating the synthetic checkerboard fields.
    ln_k_mean, ln_ss_mean = -9.2, -11.2
    x_check_length = y_check_length = 10.0
    ln_k_jump, ln_ss_jump = 1.0, 0.05

    # PARAMETERS: Associated with inversion setup.
    ln_k_initial, ln_ss_initial = -9.0, -11.0
    variance_ln_k, variance_ln_ss = 4.0, 0.1
    correlation_x = correlation_y = 15.0
    data_error_variance = 1e-8

    # Create the official inputs needed by the steady-periodic model.
    experiments = create_inputs(well_locs, test_list, domain)
    coordinates, coordinate_grids = plaid_cellcenter_coord(domain)
    x_grid, y_grid = coordinate_grids
    num_y, num_x = x_grid.shape
    num_cells = num_x * num_y

    # For synthetic problem: true parameter field statistics. The MATLAB
    # default is checkerboard; its second branch is a geostatistical field.
    if truth == "checkerboard":
        checkerboard = np.sign(np.sin(np.pi * x_grid / x_check_length)) * np.sign(
            np.sin(np.pi * y_grid / y_check_length)
        )
        ln_k_true_grid = ln_k_mean + checkerboard * ln_k_jump
        ln_ss_true_grid = ln_ss_mean + checkerboard * ln_ss_jump
    elif truth == "geostatistical":
        truth_distances = dimdist(coordinates[0:1, :], coordinates)[0]
        truth_correlation = np.exp(
            -np.sqrt((truth_distances[:, 0] / 20.0) ** 2 + (truth_distances[:, 1] / 20.0) ** 2)
        )
        realizations = toeplitz_matrix_math(
            truth_correlation,
            "r",
            grid_shape=(num_y, num_x),
            rng=np.random.default_rng(0),
        )
        ln_k_true_grid = (ln_k_mean + np.sqrt(4.0) * realizations[:, 0]).reshape(
            (num_y, num_x), order="F"
        )
        ln_ss_true_grid = (ln_ss_mean + np.sqrt(0.1) * realizations[:, 1]).reshape(
            (num_y, num_x), order="F"
        )
    else:
        raise ValueError("truth must be 'checkerboard' or 'geostatistical'")
    true_parameters = np.concatenate(
        (ln_k_true_grid.reshape(-1, order="F"), ln_ss_true_grid.reshape(-1, order="F"))
    )

    # Prior setup. The first covariance row is enough because the regular
    # grid produces a block-Toeplitz covariance matrix.
    distances = dimdist(coordinates[0:1, :], coordinates)[0]
    correlation_row = np.exp(
        -np.sqrt((distances[:, 0] / correlation_x) ** 2 + (distances[:, 1] / correlation_y) ** 2)
    )
    covariance_rows = (variance_ln_k * correlation_row, variance_ln_ss * correlation_row)
    covariance_product = lambda vector: covariance_product_k_ss(
        covariance_rows, vector, (num_y, num_x)
    )

    initial_parameters = np.concatenate(
        (np.full(num_cells, ln_k_initial), np.full(num_cells, ln_ss_initial))
    )
    initial_beta = np.array([ln_k_initial, ln_ss_initial])
    drift = np.block(
        [[np.ones((num_cells, 1)), np.zeros((num_cells, 1))],
         [np.zeros((num_cells, 1)), np.ones((num_cells, 1))]]
    )
    error_covariance = data_error_variance * np.eye(2 * len(test_list))

    return locals()


def plot_fields(case: dict[str, object], estimated: np.ndarray, output: Path) -> None:
    """Plot true and estimated ln(K) and ln(Ss) fields."""

    x_grid, y_grid = case["coordinate_grids"]
    num_cells = case["num_cells"]
    true = case["true_parameters"]
    well_locs = case["well_locs"]
    fig, axes = plt.subplots(2, 2, figsize=(11, 9), constrained_layout=True)
    fields = (
        (true[:num_cells], "True ln(K [m/s])"),
        (true[num_cells:], "True ln(Ss [1/m])"),
        (estimated[:num_cells], "Estimated ln(K [m/s])"),
        (estimated[num_cells:], "Estimated ln(Ss [1/m])"),
    )
    for axis, (values, title) in zip(axes.flat, fields):
        image = axis.pcolormesh(
            x_grid, y_grid, values.reshape(x_grid.shape, order="F"), shading="nearest"
        )
        axis.plot(well_locs[:, 0], well_locs[:, 1], "ok", markersize=4)
        axis.set(title=title, xlabel="x (m)", ylabel="y (m)", aspect="equal")
        fig.colorbar(image, ax=axis)
    output.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output, dpi=160)
    plt.close(fig)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-inversion", action="store_true", help="only validate the forward model")
    parser.add_argument(
        "--all-periods",
        action="store_true",
        help="use the current MATLAB periods 10, 50, 100, 200, 400, 800, and 1600 s",
    )
    parser.add_argument("--truth", choices=("checkerboard", "geostatistical"), default="checkerboard")
    parser.add_argument("--output", type=Path, default=Path("python_outputs/p10_inversion.png"))
    args = parser.parse_args()
    periods = np.array([10, 50, 100, 200, 400, 800, 1600], dtype=float) if args.all_periods else None
    case = build_case(periods=periods, truth=args.truth)
    forward = lambda parameters: run_distributed_k_ss(
        parameters, case["domain"], case["boundaries"], case["experiments"], 1
    )
    sensitivity = lambda parameters: run_distributed_k_ss(
        parameters, case["domain"], case["boundaries"], case["experiments"], 3
    )

    # Perform all model runs to generate data. Output ordering is all real
    # phasor observations (A), followed by all imaginary observations (B).
    start = perf_counter()
    simulated_observations = forward(case["true_parameters"])
    period_label = ", ".join(f"{period:g}" for period in case["periods"])
    print(
        f"Period(s) {period_label} forward model: {simulated_observations.size} values "
        f"in {perf_counter()-start:.3f} s"
    )
    if args.skip_inversion:
        return

    # Inversion using Kitanidis' quasi-linear geostatistical method.
    start = perf_counter()
    result = quasi_linear_geostatistical_inverse(
        simulated_observations,
        case["initial_parameters"],
        case["initial_beta"],
        case["drift"],
        case["error_covariance"],
        case["covariance_product"],
        forward,
        sensitivity,
        progress=lambda iteration, nlap: print(f"iteration {iteration}: NLAP={nlap:.8g}"),
    )
    print(f"Inversion: {result.iterations} iterations in {perf_counter()-start:.3f} s")
    plot_fields(case, result.parameters, args.output)
    print(f"Saved comparison plot to {args.output.resolve()}")


if __name__ == "__main__":
    main()
