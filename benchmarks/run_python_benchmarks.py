"""Reproducible correctness and performance benchmarks for Key Result #3."""

from __future__ import annotations

import json
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import platform
import runpy
import threading
import time
import warnings

import numpy as np
import psutil
import scipy
from scipy.io import loadmat

from oscillatory_tomography import (
    Boundaries,
    Domain,
    Experiment,
    quasi_linear_geostatistical_inverse,
    run_distributed_k_ss,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "benchmark_outputs" / "python_benchmarks.json"


class Measurement:
    """Measure wall time, process CPU time, and peak resident memory."""

    def __init__(self) -> None:
        self.process = psutil.Process()
        self.stop = threading.Event()
        self.peak_rss = self.process.memory_info().rss

    def _sample(self) -> None:
        while not self.stop.wait(0.01):
            self.peak_rss = max(self.peak_rss, self.process.memory_info().rss)

    def __enter__(self):
        self.start_rss = self.process.memory_info().rss
        self.start_wall = time.perf_counter()
        self.start_cpu = time.process_time()
        self.thread = threading.Thread(target=self._sample, daemon=True)
        self.thread.start()
        return self

    def __exit__(self, *_) -> None:
        self.cpu_seconds = time.process_time() - self.start_cpu
        self.wall_seconds = time.perf_counter() - self.start_wall
        self.stop.set()
        self.thread.join()
        self.peak_rss = max(self.peak_rss, self.process.memory_info().rss)
        self.peak_rss_mib = self.peak_rss / 2**20
        self.rss_increase_mib = (self.peak_rss - self.start_rss) / 2**20

    def result(self) -> dict[str, float]:
        return {
            "wall_seconds": self.wall_seconds,
            "cpu_seconds": self.cpu_seconds,
            "cpu_to_wall_ratio": self.cpu_seconds / self.wall_seconds,
            "peak_rss_mib": self.peak_rss_mib,
            "rss_increase_mib": self.rss_increase_mib,
        }


def load_reference():
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        values = loadmat(ROOT / "testing_inversion_currtest.mat", simplify_cells=True)
    domain = Domain(**values["domain"])
    boundaries = Boundaries(values["bdrys"]["types"], values["bdrys"]["vals"])
    saved = values["experiment"]
    experiment = Experiment(
        float(saved["omega"]),
        np.asarray(saved["tests"], dtype=int) - 1,
        saved["stims"].tocsc(),
        saved["obs"].tocsc(),
    )
    return values, domain, boundaries, experiment


def p10_benchmarks(results: dict) -> None:
    values, domain, boundaries, experiment = load_reference()
    parameters = values["params_true"]
    for name, mode, expected in (
        ("p10_observations", 1, values["sim_obs"]),
        ("p10_full_fields", 2, values["Phi_true"]),
    ):
        with Measurement() as measurement:
            actual = run_distributed_k_ss(parameters, domain, boundaries, [experiment], mode)
        entry = measurement.result()
        entry.update(
            max_absolute_difference=float(np.max(np.abs(actual - expected))),
            relative_l2_difference=float(np.linalg.norm(actual - expected) / np.linalg.norm(expected)),
            output_shape=list(actual.shape),
        )
        results[name] = entry

    sensitivity_parameters = np.concatenate((np.full(2500, -9.0), np.full(2500, -9.0)))
    with Measurement() as measurement:
        sensitivity = run_distributed_k_ss(
            sensitivity_parameters, domain, boundaries, [experiment], 3
        )
    entry = measurement.result()
    entry.update(
        max_absolute_difference=float(np.max(np.abs(sensitivity - values["H_adj"]))),
        relative_l2_difference=float(
            np.linalg.norm(sensitivity - values["H_adj"]) / np.linalg.norm(values["H_adj"])
        ),
        output_shape=list(sensitivity.shape),
    )
    results["p10_sensitivity"] = entry

    module = runpy.run_path(str(ROOT / "examples" / "testing_inversion_2d_geostat.py"))
    case = module["build_case"]()
    forward = lambda p: run_distributed_k_ss(
        p, case["domain"], case["boundaries"], case["experiments"], 1
    )
    jacobian = lambda p: run_distributed_k_ss(
        p, case["domain"], case["boundaries"], case["experiments"], 3
    )
    data = forward(case["true_parameters"])
    with Measurement() as measurement:
        inversion = quasi_linear_geostatistical_inverse(
            data,
            case["initial_parameters"],
            case["initial_beta"],
            case["drift"],
            case["error_covariance"],
            case["covariance_product"],
            forward,
            jacobian,
        )
    entry = measurement.result()
    entry.update(
        iterations=inversion.iterations,
        final_nlap=inversion.nlap,
        max_absolute_parameter_difference=float(
            np.max(np.abs(inversion.parameters - values["params_best"]))
        ),
        relative_parameter_l2_difference=float(
            np.linalg.norm(inversion.parameters - values["params_best"])
            / np.linalg.norm(values["params_best"])
        ),
    )
    results["p10_inversion"] = entry


def black_kipp_benchmark(results: dict) -> None:
    module = runpy.run_path(
        str(ROOT / "examples" / "testing_multifreq_analyt_blackkipp_comparison.py")
    )
    for workers in (1, 4):
        with Measurement() as measurement:
            output = module["run_case"](workers=workers)
        entry = measurement.result()
        entry.update(
            workers=workers,
            mean_relative_amplitude_error=output["mean_amplitude_error"],
            mean_absolute_phase_error_radians=output["mean_phase_error"],
            observation_l2_norm=float(np.linalg.norm(output["simulated"])),
            matlab_mean_relative_amplitude_error=0.017048687840262439,
            matlab_mean_absolute_phase_error_radians=0.035438319103395045,
            matlab_observation_l2_norm=3.6670677622391876,
        )
        suffix = "serial" if workers == 1 else "parallel_4_workers"
        results[f"black_kipp_observations_and_analysis_{suffix}"] = entry

    with Measurement() as measurement:
        full_output = module["run_case"](workers=4, include_fields=True)
    results["black_kipp_complete_parallel_4_workers"] = measurement.result() | {
        "workers": 4,
        "field_shape": list(full_output["simulated_fields"].shape),
        "mean_relative_amplitude_error": full_output["mean_amplitude_error"],
        "mean_absolute_phase_error_radians": full_output["mean_phase_error"],
        "observation_l2_norm": float(np.linalg.norm(full_output["simulated"])),
    }


def sensitivity_benchmark(results: dict) -> None:
    module = runpy.run_path(str(ROOT / "examples" / "testing_sensitivity_fd_comparison.py"))
    domain, boundaries, experiments, parameters = module["build_case"]()
    forward = lambda p: run_distributed_k_ss(p, domain, boundaries, experiments, 1)
    columns_per_field = 4
    base_columns = np.linspace(0, parameters.size // 2 - 1, columns_per_field, dtype=int)
    columns = np.concatenate((base_columns, base_columns + parameters.size // 2))
    with Measurement() as measurement:
        adjoint = run_distributed_k_ss(parameters, domain, boundaries, experiments, 3)
    results["sensitivity_adjoint"] = measurement.result() | {
        "output_shape": list(adjoint.shape)
    }
    baseline = forward(parameters)
    finite_difference = np.empty((baseline.size, columns.size))
    with Measurement() as measurement:
        for output_column, parameter_column in enumerate(columns):
            modified = parameters.copy()
            modified[parameter_column] += 0.1
            finite_difference[:, output_column] = (forward(modified) - baseline) / 0.1
    difference = finite_difference - adjoint[:, columns]
    entry = measurement.result()
    entry.update(
        columns_tested=columns.tolist(),
        maximum_absolute_difference=float(np.max(np.abs(difference))),
        relative_frobenius_difference=float(
            np.linalg.norm(difference) / np.linalg.norm(finite_difference)
        ),
        projected_full_fd_wall_seconds=float(measurement.wall_seconds / columns.size * parameters.size),
        matlab_full_fd_wall_seconds=2350.070,
    )
    results["sensitivity_finite_difference_representative"] = entry

    def evaluate_column(parameter_column: int) -> np.ndarray:
        modified = parameters.copy()
        modified[parameter_column] += 0.1
        return (forward(modified) - baseline) / 0.1

    with Measurement() as measurement:
        with ThreadPoolExecutor(max_workers=4) as executor:
            parallel_fd = np.column_stack(list(executor.map(evaluate_column, columns)))
    parallel_difference = parallel_fd - adjoint[:, columns]
    results["sensitivity_finite_difference_representative_parallel_4_workers"] = (
        measurement.result()
        | {
            "columns_tested": columns.tolist(),
            "maximum_absolute_difference": float(np.max(np.abs(parallel_difference))),
            "relative_frobenius_difference": float(
                np.linalg.norm(parallel_difference) / np.linalg.norm(parallel_fd)
            ),
            "projected_full_fd_wall_seconds": float(
                measurement.wall_seconds / columns.size * parameters.size
            ),
        }
    )


def seven_period_benchmark(results: dict) -> None:
    module = runpy.run_path(str(ROOT / "examples" / "testing_inversion_2d_geostat.py"))
    periods = np.array([10, 50, 100, 200, 400, 800, 1600], dtype=float)
    case = module["build_case"](periods=periods)
    forward = lambda p: run_distributed_k_ss(
        p, case["domain"], case["boundaries"], case["experiments"], 1
    )
    jacobian = lambda p: run_distributed_k_ss(
        p, case["domain"], case["boundaries"], case["experiments"], 3
    )
    data = forward(case["true_parameters"])
    with Measurement() as measurement:
        inversion = quasi_linear_geostatistical_inverse(
            data,
            case["initial_parameters"],
            case["initial_beta"],
            case["drift"],
            case["error_covariance"],
            case["covariance_product"],
            forward,
            jacobian,
        )
    results["seven_period_inversion"] = measurement.result() | {
        "periods_seconds": periods.tolist(),
        "iterations": inversion.iterations,
        "final_nlap": inversion.nlap,
        "observation_l2_norm": float(np.linalg.norm(data)),
        "parameter_l2_norm": float(np.linalg.norm(inversion.parameters)),
    }
    np.savez_compressed(
        ROOT / "benchmark_outputs" / "python_seven_period_outputs.npz",
        observations=data,
        parameters=inversion.parameters,
        beta=inversion.beta,
        sensitivity=inversion.sensitivity,
        nlap=inversion.nlap,
    )


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    results: dict[str, object] = {
        "environment": {
            "platform": platform.platform(),
            "python": platform.python_version(),
            "numpy": np.__version__,
            "scipy": scipy.__version__,
            "logical_cpu_count": os.cpu_count(),
            "physical_cpu_count": psutil.cpu_count(logical=False),
            "total_memory_gib": psutil.virtual_memory().total / 2**30,
        },
        "method": {
            "timer": "time.perf_counter",
            "cpu_timer": "time.process_time",
            "peak_memory": "psutil RSS sampled every 10 ms",
            "repetitions": 1,
            "note": "Scientific runs are deterministic; long workflows use one measured repetition.",
        },
    }
    p10_benchmarks(results)
    black_kipp_benchmark(results)
    sensitivity_benchmark(results)
    seven_period_benchmark(results)
    OUTPUT.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(json.dumps(results, indent=2))
    print(f"Saved {OUTPUT}")


if __name__ == "__main__":
    main()
