"""Measure Python inversion scaling and peak memory on successively finer grids.

Results are printed to the terminal and saved as JSON and Markdown. Each grid
size runs in a fresh subprocess so arrays retained by an earlier case cannot
inflate a later measurement.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import runpy
import subprocess
import sys
import time

import numpy as np
import psutil


ROOT = Path(__file__).resolve().parents[1]


class Timer:
    """Record wall and process CPU time for one scientific operation."""

    def __enter__(self):
        self.wall_start = time.perf_counter()
        self.cpu_start = time.process_time()
        return self

    def __exit__(self, *_) -> None:
        self.wall_seconds = time.perf_counter() - self.wall_start
        self.cpu_seconds = time.process_time() - self.cpu_start

    def result(self) -> dict[str, float]:
        return {"wall_seconds": self.wall_seconds, "cpu_seconds": self.cpu_seconds}


def worker(grid_cells: int, output: Path) -> None:
    """Run one isolated grid case and save phase-level measurements."""

    from oscillatory_tomography import run_distributed_k_ss
    from oscillatory_tomography.inversion import linear_geostatistical_inverse

    example = runpy.run_path(str(ROOT / "examples" / "testing_inversion_2d_geostat.py"))
    with Timer() as setup_timer:
        case = example["build_case"](grid_cells=grid_cells)

    forward = lambda parameters: run_distributed_k_ss(
        parameters, case["domain"], case["boundaries"], case["experiments"], 1
    )
    jacobian = lambda parameters: run_distributed_k_ss(
        parameters, case["domain"], case["boundaries"], case["experiments"], 3
    )

    with Timer() as synthetic_timer:
        data = forward(case["true_parameters"])
    with Timer() as initial_timer:
        initial_prediction = forward(case["initial_parameters"])
    with Timer() as jacobian_timer:
        sensitivity = jacobian(case["initial_parameters"])

    linearized_data = data - initial_prediction + sensitivity @ case["initial_parameters"]
    with Timer() as inverse_timer:
        estimate, xi, beta = linear_geostatistical_inverse(
            linearized_data,
            case["drift"],
            case["error_covariance"],
            case["covariance_product"],
            sensitivity,
        )

    report = {
        "grid_cells_per_axis": grid_cells,
        "spatial_cells": int(case["num_cells"]),
        "unknown_parameters": int(case["initial_parameters"].size),
        "observations": int(data.size),
        "jacobian_shape": list(sensitivity.shape),
        "jacobian_storage_mib": sensitivity.nbytes / 2**20,
        "setup": setup_timer.result(),
        "synthetic_forward": synthetic_timer.result(),
        "initial_forward": initial_timer.result(),
        "jacobian": jacobian_timer.result(),
        "linearized_inverse": inverse_timer.result(),
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
    """Return resident memory for a process and all living child processes."""

    try:
        members = [process, *process.children(recursive=True)]
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return 0
    total = 0
    for member in members:
        try:
            total += member.memory_info().rss
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    return total


def run_isolated_case(grid_cells: int, output_directory: Path, sample_seconds: float) -> dict:
    """Launch and externally monitor one fresh Python worker."""

    worker_output = output_directory / f"python_{grid_cells}.json"
    command = [
        sys.executable,
        str(Path(__file__).resolve()),
        "--worker-grid",
        str(grid_cells),
        "--worker-output",
        str(worker_output),
    ]
    process = subprocess.Popen(
        command,
        cwd=ROOT,
        env=os.environ.copy(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    monitored = psutil.Process(process.pid)
    peak_rss = 0
    wall_start = time.perf_counter()
    while process.poll() is None:
        peak_rss = max(peak_rss, process_tree_rss(monitored))
        time.sleep(sample_seconds)
    stdout, stderr = process.communicate()
    subprocess_wall = time.perf_counter() - wall_start
    if process.returncode != 0:
        raise RuntimeError(
            f"{grid_cells}x{grid_cells} worker failed with code {process.returncode}\n"
            f"stdout:\n{stdout}\nstderr:\n{stderr}"
        )
    result = json.loads(worker_output.read_text(encoding="utf-8"))
    result["peak_process_tree_rss_mib"] = peak_rss / 2**20
    result["subprocess_wall_seconds"] = subprocess_wall
    result["scientific_wall_seconds"] = sum(
        result[name]["wall_seconds"]
        for name in (
            "setup",
            "synthetic_forward",
            "initial_forward",
            "jacobian",
            "linearized_inverse",
        )
    )
    return result


def markdown_report(results: list[dict], sample_ms: float) -> str:
    """Create a portable human-readable report from benchmark results."""

    lines = [
        "# Python inversion scaling results",
        "",
        f"Peak process-tree RSS was sampled every {sample_ms:g} ms.",
        "Each grid ran in a fresh Python process.",
        "",
        "| Grid | Parameters | Jacobian | Raw Jacobian (MiB) | Peak RSS (MiB) | Jacobian (s) | Linear inverse (s) | Scientific total (s) |",
        "|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for result in results:
        rows, columns = result["jacobian_shape"]
        lines.append(
            f"| {result['grid_cells_per_axis']}×{result['grid_cells_per_axis']} "
            f"| {result['unknown_parameters']:,} | {rows}×{columns:,} "
            f"| {result['jacobian_storage_mib']:.3f} "
            f"| {result['peak_process_tree_rss_mib']:.1f} "
            f"| {result['jacobian']['wall_seconds']:.4f} "
            f"| {result['linearized_inverse']['wall_seconds']:.4f} "
            f"| {result['scientific_wall_seconds']:.4f} |"
        )
    lines.extend(
        [
            "",
            "The scientific total includes setup, two forward calculations, the analytic",
            "Jacobian, and one linearized geostatistical inverse step.",
            "",
        ]
    )
    return "\n".join(lines)


def print_table(results: list[dict]) -> None:
    print("\nPython inversion scaling results")
    print("grid       parameters   peak MiB   Jacobian s   inverse s   scientific s")
    for result in results:
        grid = f"{result['grid_cells_per_axis']}x{result['grid_cells_per_axis']}"
        print(
            f"{grid:<10} {result['unknown_parameters']:>10,} "
            f"{result['peak_process_tree_rss_mib']:>10.1f} "
            f"{result['jacobian']['wall_seconds']:>12.4f} "
            f"{result['linearized_inverse']['wall_seconds']:>11.4f} "
            f"{result['scientific_wall_seconds']:>14.4f}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sizes", nargs="+", type=int, default=[25, 50, 75, 100, 150, 200])
    parser.add_argument("--sample-ms", type=float, default=10.0)
    parser.add_argument(
        "--output-directory",
        type=Path,
        default=ROOT / "python_outputs" / "scaling",
    )
    parser.add_argument("--worker-grid", type=int, help=argparse.SUPPRESS)
    parser.add_argument("--worker-output", type=Path, help=argparse.SUPPRESS)
    args = parser.parse_args()

    if args.worker_grid is not None:
        if args.worker_output is None:
            parser.error("--worker-output is required in worker mode")
        worker(args.worker_grid, args.worker_output)
        return
    if any(size < 2 for size in args.sizes):
        parser.error("every grid size must be at least 2")

    args.output_directory.mkdir(parents=True, exist_ok=True)
    results = []
    for size in args.sizes:
        print(f"Running {size}x{size} ({2*size*size:,} parameters)...", flush=True)
        result = run_isolated_case(size, args.output_directory, args.sample_ms / 1000.0)
        results.append(result)
        print(
            f"  peak={result['peak_process_tree_rss_mib']:.1f} MiB, "
            f"scientific={result['scientific_wall_seconds']:.3f} s",
            flush=True,
        )

    combined = {
        "method": {
            "case": "P=10 s checkerboard, fixed nine-well geometry",
            "unknown_parameters": "2*N^2",
            "peak_memory": f"process-tree RSS sampled every {args.sample_ms:g} ms",
            "isolation": "one fresh subprocess per grid size",
            "inverse_scope": "one Jacobian and one linearized geostatistical inverse step",
        },
        "results": results,
    }
    json_output = args.output_directory / "python_scaling_results.json"
    markdown_output = args.output_directory / "python_scaling_results.md"
    json_output.write_text(json.dumps(combined, indent=2), encoding="utf-8")
    markdown_output.write_text(markdown_report(results, args.sample_ms), encoding="utf-8")
    print_table(results)
    print(f"\nJSON: {json_output.resolve()}")
    print(f"Markdown: {markdown_output.resolve()}")


if __name__ == "__main__":
    main()
