"""Python port of ``testing_sensitivity_fd_comparison.m``.

The original exhaustive run perturbs all 16,200 parameters and takes roughly
40 minutes in MATLAB. By default this port checks representative K and Ss
columns; pass ``--all-columns`` for the exact exhaustive experiment.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from time import perf_counter

import numpy as np

from oscillatory_tomography import Boundaries, create_inputs, run_distributed_k_ss
from oscillatory_tomography.grid import equigrid_setup


def build_case():
    # Bounds of the domain and number of cells in each discretization.
    domain = equigrid_setup(np.array([-90, 90, 90]), np.array([-45, 45, 90]))
    boundaries = Boundaries(np.array([1, 1, 1, 1, 0, 0]), np.zeros(6))
    well_locs = np.array(
        [[-20, 20], [0, 20], [20, 20], [-20, 0], [0, 0], [20, 0], [-20, -20], [0, -20], [20, -20]],
        dtype=float,
    )
    volume = 0.005
    periods = (10.0, 100.0, 1000.0)
    observation_wells = (1, 2, 3, 4, 6, 7, 8, 9)
    # Reproduce the MATLAB test matrix: angular frequency, pumping well,
    # oscillatory flow amplitude, and observation well (one-based well IDs).
    tests = np.asarray(
        [[2 * np.pi / period, 5, volume * np.pi / period, observation]
         for period in periods for observation in observation_wells]
    )
    experiments = create_inputs(well_locs, tests, domain)
    num_cells = 90 * 90
    # The first 8,100 entries are ln(K); the second 8,100 are ln(Ss).
    parameters = np.full(2 * num_cells, -9.2)
    return domain, boundaries, experiments, parameters


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--all-columns", action="store_true", help="run all 16,200 finite-difference columns")
    parser.add_argument("--columns-per-field", type=int, default=4, help="representative columns per field")
    parser.add_argument("--delta", type=float, default=0.1, help="forward-difference perturbation")
    parser.add_argument("--workers", type=int, default=1, help="parallel finite-difference evaluations")
    args = parser.parse_args()
    domain, boundaries, experiments, parameters = build_case()
    forward = lambda values: run_distributed_k_ss(values, domain, boundaries, experiments, 1)

    start = perf_counter()
    # Compute every analytic sensitivity column with one adjoint calculation.
    adjoint = run_distributed_k_ss(parameters, domain, boundaries, experiments, 3)
    print(f"Adjoint calculation: {perf_counter()-start:.3f} s")
    if args.all_columns:
        # This is the original MATLAB experiment and requires 16,200 additional
        # forward solves.  The default samples both parameter fields for speed.
        columns = np.arange(parameters.size)
    else:
        base = np.linspace(0, parameters.size // 2 - 1, args.columns_per_field, dtype=int)
        columns = np.concatenate((base, base + parameters.size // 2))

    baseline = forward(parameters)
    if args.workers < 1:
        raise ValueError("workers must be at least 1")

    def evaluate_column(parameter_column: int) -> np.ndarray:
        # Match the original one-sided finite difference in log-parameter space.
        modified = parameters.copy()
        modified[parameter_column] += args.delta
        return (forward(modified) - baseline) / args.delta

    start = perf_counter()
    if args.workers == 1:
        evaluated = map(evaluate_column, columns)
    else:
        with ThreadPoolExecutor(max_workers=args.workers) as executor:
            evaluated = executor.map(evaluate_column, columns)
            finite_difference = np.column_stack(list(evaluated))
    if args.workers == 1:
        finite_difference = np.column_stack(list(evaluated))
    difference = finite_difference - adjoint[:, columns]
    print(f"Finite differences ({columns.size} columns): {perf_counter()-start:.3f} s")
    print(f"Maximum absolute difference: {np.max(np.abs(difference)):.16g}")
    print(f"Relative Frobenius difference: {np.linalg.norm(difference)/np.linalg.norm(finite_difference):.16g}")


if __name__ == "__main__":
    main()
