"""Regression tests against the professor-provided P=10 MATLAB workspace."""

from __future__ import annotations

from pathlib import Path
import warnings

import numpy as np
import pytest
from scipy.io import loadmat

from oscillatory_tomography import Boundaries, Domain, Experiment, create_inputs, run_distributed_k_ss


REPOSITORY = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def reference():
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        values = loadmat(REPOSITORY / "testing_inversion_currtest.mat", simplify_cells=True)
    domain = Domain(**values["domain"])
    boundaries = Boundaries(types=values["bdrys"]["types"], values=values["bdrys"]["vals"])
    saved = values["experiment"]
    experiment = Experiment(
        omega=float(saved["omega"]),
        tests=np.asarray(saved["tests"], dtype=int) - 1,
        stims=saved["stims"].tocsc(),
        obs=saved["obs"].tocsc(),
    )
    return values, domain, boundaries, experiment


def test_python_input_builder_matches_matlab(reference):
    values, domain, _, saved = reference
    actual = create_inputs(values["well_locs"], values["test_list"], domain)[0]
    assert actual.omega == saved.omega
    np.testing.assert_array_equal(actual.tests, saved.tests)
    np.testing.assert_allclose(actual.stims.toarray(), saved.stims.toarray(), atol=0.0, rtol=0.0)
    np.testing.assert_allclose(actual.obs.toarray(), saved.obs.toarray(), atol=0.0, rtol=0.0)


def test_forward_observations_and_fields_match_matlab(reference):
    values, domain, boundaries, experiment = reference
    observations = run_distributed_k_ss(values["params_true"], domain, boundaries, [experiment], 1)
    fields = run_distributed_k_ss(values["params_true"], domain, boundaries, [experiment], 2)
    np.testing.assert_allclose(observations, values["sim_obs"], atol=1e-14, rtol=1e-13)
    np.testing.assert_allclose(fields, values["Phi_true"], atol=1e-13, rtol=1e-13)


def test_adjoint_sensitivity_matches_matlab(reference):
    values, domain, boundaries, experiment = reference
    # In this historical workspace H_adj was evaluated before params_init was
    # changed later in the script; its actual homogeneous state is [-9, -9].
    parameters = np.concatenate((np.full(2500, -9.0), np.full(2500, -9.0)))
    sensitivity = run_distributed_k_ss(parameters, domain, boundaries, [experiment], 3)
    np.testing.assert_allclose(sensitivity, values["H_adj"], atol=1e-18, rtol=1e-12)


def test_selected_complex_sensitivities_agree_with_finite_differences(reference):
    _, domain, boundaries, experiment = reference
    parameters = np.concatenate((np.full(2500, -9.0), np.full(2500, -9.0)))
    sensitivity = run_distributed_k_ss(parameters, domain, boundaries, [experiment], 3)
    epsilon = 1e-5
    for column in (1275, 3775):
        plus = parameters.copy()
        minus = parameters.copy()
        plus[column] += epsilon
        minus[column] -= epsilon
        difference = (
            run_distributed_k_ss(plus, domain, boundaries, [experiment], 1)
            - run_distributed_k_ss(minus, domain, boundaries, [experiment], 1)
        ) / (2.0 * epsilon)
        np.testing.assert_allclose(sensitivity[:, column], difference, atol=1e-12, rtol=1e-6)
