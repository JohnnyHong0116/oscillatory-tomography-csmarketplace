"""Checks for the parameterized inversion case used by scaling benchmarks."""

from pathlib import Path
import runpy


REPOSITORY = Path(__file__).resolve().parents[1]


def test_grid_refinement_changes_parameter_and_jacobian_dimensions():
    module = runpy.run_path(str(REPOSITORY / "examples" / "testing_inversion_2d_geostat.py"))
    case = module["build_case"](grid_cells=12)

    assert case["num_cells"] == 12**2
    assert case["initial_parameters"].shape == (2 * 12**2,)
    assert case["drift"].shape == (2 * 12**2, 2)
    assert case["error_covariance"].shape == (72, 72)


def test_grid_refinement_rejects_degenerate_domains():
    module = runpy.run_path(str(REPOSITORY / "examples" / "testing_inversion_2d_geostat.py"))
    try:
        module["build_case"](grid_cells=1)
    except ValueError as error:
        assert "at least 2" in str(error)
    else:
        raise AssertionError("grid_cells=1 should be rejected")
