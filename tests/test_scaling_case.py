"""Checks for the parameterized inversion case used by scaling benchmarks."""

from pathlib import Path
import runpy

import pytest


REPOSITORY = Path(__file__).resolve().parents[1]


def load_builder():
    module = runpy.run_path(str(REPOSITORY / "examples" / "testing_inversion_2d_geostat.py"))
    return module["build_case"]


def test_grid_refinement_changes_parameter_dimensions():
    case = load_builder()(grid_cells=12)
    assert case["num_cells"] == 12**2
    assert case["initial_parameters"].shape == (2 * 12**2,)
    assert case["drift"].shape == (2 * 12**2, 2)
    assert case["error_covariance"].shape == (72, 72)


def test_grid_refinement_rejects_degenerate_domains():
    with pytest.raises(ValueError, match="at least 2"):
        load_builder()(grid_cells=1)
