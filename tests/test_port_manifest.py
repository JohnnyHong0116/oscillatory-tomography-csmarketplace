"""Ensure every original MATLAB source retains a concrete Python entry point."""

from __future__ import annotations

import ast
from pathlib import Path

from oscillatory_tomography.port_manifest import MATLAB_PORTS


REPOSITORY = Path(__file__).resolve().parents[1]


def test_every_original_matlab_file_has_a_python_counterpart():
    # Original scientific MATLAB sources live at repository root.  MATLAB
    # benchmark drivers under benchmarks/ were added during the Python port.
    matlab_sources = {path.name for path in REPOSITORY.glob("*.m")}
    assert set(MATLAB_PORTS) == matlab_sources


def test_every_manifest_entry_names_a_real_python_function():
    for matlab_name, (relative_path, function_name) in MATLAB_PORTS.items():
        python_path = REPOSITORY / relative_path
        assert python_path.is_file(), f"{matlab_name}: missing {relative_path}"
        syntax_tree = ast.parse(python_path.read_text(encoding="utf-8"), filename=str(python_path))
        functions = {
            node.name
            for node in syntax_tree.body
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }
        assert function_name in functions, (
            f"{matlab_name}: {function_name} is not defined in {relative_path}"
        )
