"""Compare Python and MATLAB inversion scaling and peak process memory.

Each grid uses ``N x N`` cells and therefore ``2*N**2`` unknown ln(K)/ln(Ss)
parameters.  The scientific case, wells, observations, and P=10 s pumping
period are otherwise unchanged.  Every language/grid combination runs in a
fresh subprocess so retained arrays from an earlier case cannot bias memory.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import runpy
import subprocess
import sys
import threading
import time

import numpy as np
import psutil


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIRECTORY = ROOT / "benchmark_outputs"


class OperationMeasurement:
    """Measure wall and process CPU time for one in-process operation."""

    def __enter__(self):
        self.wall_start = time.perf_counter()
        self.cpu_start = time.process_time()
        return self

    def __exit__(self, *_) -> None:
        self.wall_seconds = time.perf_counter() - self.wall_start
        self.cpu_seconds = time.process_time() - self.cpu_start

    def result(self) -> dict[str, float]:
        return {
            "wall_seconds": self.wall_seconds,
            "cpu_seconds": self.cpu_seconds,
        }


def python_worker(grid_cells: int, output: Path) -> None:
    """Run one Python case and write phase-level timings for the orchestrator."""

    from oscillatory_tomography import run_distributed_k_ss
    from oscillatory_tomography.inversion import linear_geostatistical_inverse

    module = runpy.run_path(str(ROOT / "examples" / "testing_inversion_2d_geostat.py"))
    with OperationMeasurement() as setup_timing:
        case = module["build_case"](grid_cells=grid_cells)

    forward = lambda parameters: run_distributed_k_ss(
        parameters, case["domain"], case["boundaries"], case["experiments"], 1
    )
    jacobian = lambda parameters: run_distributed_k_ss(
        parameters, case["domain"], case["boundaries"], case["experiments"], 3
    )

    with OperationMeasurement() as synthetic_timing:
        data = forward(case["true_parameters"])
    with OperationMeasurement() as initial_forward_timing:
        initial_prediction = forward(case["initial_parameters"])
    with OperationMeasurement() as jacobian_timing:
        sensitivity = jacobian(case["initial_parameters"])

    linearized_data = data - initial_prediction + sensitivity @ case["initial_parameters"]
    with OperationMeasurement() as inverse_timing:
        estimate, xi, beta = linear_geostatistical_inverse(
            linearized_data,
            case["drift"],
            case["error_covariance"],
            case["covariance_product"],
            sensitivity,
        )

    report = {
        "language": "python",
        "grid_cells_per_axis": grid_cells,
        "spatial_cells": int(case["num_cells"]),
        "unknown_parameters": int(case["initial_parameters"].size),
        "observations": int(data.size),
        "jacobian_shape": list(sensitivity.shape),
        "jacobian_storage_mib": sensitivity.nbytes / 2**20,
        "setup": setup_timing.result(),
        "synthetic_forward": synthetic_timing.result(),
        "initial_forward": initial_forward_timing.result(),
        "jacobian": jacobian_timing.result(),
        "linearized_inverse": inverse_timing.result(),
        "checks": {
            "data_l2_norm": float(np.linalg.norm(data)),
            "jacobian_l2_norm": float(np.linalg.norm(sensitivity)),
            "estimate_l2_norm": float(np.linalg.norm(estimate)),
            "xi_l2_norm": float(np.linalg.norm(xi)),
            "beta": np.asarray(beta).tolist(),
            "all_finite": bool(
                np.all(np.isfinite(data))
                and np.all(np.isfinite(sensitivity))
                and np.all(np.isfinite(estimate))
            ),
        },
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")


def process_tree_rss(process: psutil.Process) -> int:
    """Return current RSS for a process and all currently living children."""

    total = 0
    try:
        members = [process, *process.children(recursive=True)]
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return 0
    for member in members:
        try:
            total += member.memory_info().rss
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    return total


def monitored_run(
    command: list[str],
    *,
    environment: dict[str, str],
    sample_seconds: float,
) -> dict[str, object]:
    """Run a fresh process while sampling whole-process-tree peak RSS."""

    process = subprocess.Popen(
        command,
        cwd=ROOT,
        env=environment,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    ps_process = psutil.Process(process.pid)
    peak_rss = 0
    wall_start = time.perf_counter()
    while process.poll() is None:
        peak_rss = max(peak_rss, process_tree_rss(ps_process))
        time.sleep(sample_seconds)
    stdout, stderr = process.communicate()
    wall_seconds = time.perf_counter() - wall_start
    return {
        "return_code": process.returncode,
        "subprocess_wall_seconds": wall_seconds,
        "peak_process_tree_rss_mib": peak_rss / 2**20,
        "stdout_tail": stdout[-4000:],
        "stderr_tail": stderr[-4000:],
    }


def run_python_case(grid_cells: int, sample_seconds: float) -> dict[str, object]:
    output = OUTPUT_DIRECTORY / f"scaling_python_{grid_cells}.json"
    command = [
        sys.executable,
        str(Path(__file__).resolve()),
        "--python-worker",
        str(grid_cells),
        "--worker-output",
        str(output),
    ]
    monitored = monitored_run(command, environment=os.environ.copy(), sample_seconds=sample_seconds)
    if monitored["return_code"] != 0:
        return {"language": "python", "grid_cells_per_axis": grid_cells, **monitored}
    return json.loads(output.read_text(encoding="utf-8")) | monitored


def run_matlab_case(
    grid_cells: int,
    matlab: Path,
    sample_seconds: float,
) -> dict[str, object]:
    output = OUTPUT_DIRECTORY / f"scaling_matlab_{grid_cells}.json"
    environment = os.environ.copy()
    environment["OHT_GRID_CELLS"] = str(grid_cells)
    environment["OHT_SCALING_OUTPUT"] = str(output)
    command = [str(matlab), "-batch", "addpath('benchmarks'); matlab_scaling_benchmark"]
    monitored = monitored_run(command, environment=environment, sample_seconds=sample_seconds)
    if monitored["return_code"] != 0:
        return {"language": "matlab", "grid_cells_per_axis": grid_cells, **monitored}
    return json.loads(output.read_text(encoding="utf-8")) | monitored


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sizes", nargs="+", type=int, default=[25, 50, 75, 100])
    parser.add_argument("--languages", nargs="+", choices=("python", "matlab"), default=["python", "matlab"])
    parser.add_argument(
        "--matlab",
        type=Path,
        default=Path(r"C:\Program Files\MATLAB\R2026a\bin\matlab.exe"),
    )
    parser.add_argument("--sample-ms", type=float, default=10.0)
    parser.add_argument(
        "--output",
        type=Path,
        default=OUTPUT_DIRECTORY / "scaling_benchmarks.json",
        help="combined JSON report path",
    )
    parser.add_argument("--python-worker", type=int, help=argparse.SUPPRESS)
    parser.add_argument("--worker-output", type=Path, help=argparse.SUPPRESS)
    args = parser.parse_args()

    if args.python_worker is not None:
        if args.worker_output is None:
            parser.error("--worker-output is required in worker mode")
        python_worker(args.python_worker, args.worker_output)
        return

    if any(size < 2 for size in args.sizes):
        parser.error("every grid size must be at least 2")
    if "matlab" in args.languages and not args.matlab.is_file():
        parser.error(f"MATLAB executable not found: {args.matlab}")

    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    results: list[dict[str, object]] = []
    sample_seconds = args.sample_ms / 1000.0
    for grid_cells in args.sizes:
        for language in args.languages:
            print(f"Running {language} {grid_cells}x{grid_cells}...", flush=True)
            if language == "python":
                result = run_python_case(grid_cells, sample_seconds)
            else:
                result = run_matlab_case(grid_cells, args.matlab, sample_seconds)
            results.append(result)
            print(
                f"  exit={result['return_code']} peak={result['peak_process_tree_rss_mib']:.1f} MiB "
                f"wall={result['subprocess_wall_seconds']:.2f} s",
                flush=True,
            )
            if result["return_code"] != 0:
                print(result["stderr_tail"], file=sys.stderr)

    report = {
        "method": {
            "case": "P=10 s checkerboard, fixed nine-well geometry",
            "scaling_variable": "equal x/y cell count N",
            "unknown_parameter_count": "2*N^2 (ln(K) and ln(Ss))",
            "memory": f"sum of process-tree RSS sampled every {args.sample_ms:g} ms",
            "isolation": "each language/grid case runs in a fresh subprocess",
            "inverse_scope": "one Jacobian and one linearized geostatistical inverse step",
        },
        "results": results,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Saved {args.output}")


if __name__ == "__main__":
    main()
