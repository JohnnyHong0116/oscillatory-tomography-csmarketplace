"""Unit tests for the MATLAB helpers and specialized model wrappers."""

import numpy as np

from oscillatory_tomography import (
    Boundaries,
    create_inputs,
    plaid_coord,
    run_amplitude_distributed_k,
    run_distributed_aperture,
    run_distributed_k_ss,
)
from oscillatory_tomography.grid import equigrid_setup, euclidean_distance
from oscillatory_tomography.utilities import (
    compute_covariance_nd,
    image_to_field,
    process_optional_args,
    reflect_nd,
    rotate_2d,
)


def small_model():
    domain = equigrid_setup(np.array([-2, 2, 4]), np.array([-2, 2, 4]))
    boundaries = Boundaries(np.array([1, 1, 1, 1, 0, 0]), np.zeros(6))
    wells = np.array([[0.0, 0.0], [1.0, 1.0]])
    tests = np.array([[2 * np.pi / 10, 1, 0.01, 2]])
    return domain, boundaries, create_inputs(wells, tests, domain)


def test_coordinate_and_geometry_utilities():
    coordinates, grids = plaid_coord(np.array([1.0, 2.0]), np.array([3.0, 4.0]))
    np.testing.assert_array_equal(coordinates, [[1, 3], [1, 4], [2, 3], [2, 4]])
    assert grids[0].shape == (2, 2)
    np.testing.assert_allclose(euclidean_distance([[0, 0]], [[3, 4], [0, 2]]), [[5, 2]])
    np.testing.assert_allclose(rotate_2d([[1, 0]], 90), [[0, -1]], atol=1e-15)
    np.testing.assert_allclose(reflect_nd([2, 3], [1, 0, -1]), [0, 3])


def test_image_covariance_and_optional_argument_utilities():
    image = np.array([[[0, 0, 0], [255, 255, 255]], [[128, 128, 128], [64, 64, 64]]])
    field = image_to_field(image, 10.0, 20.0)
    np.testing.assert_allclose(field, [[10 + 128 / 255 * 10, 10 + 64 / 255 * 10], [10, 20]])
    points = np.array([[0.0], [1.0], [3.0]])
    covariance = compute_covariance_nd(points, lambda distance, scale: np.exp(-distance / scale), 2.0)
    np.testing.assert_allclose(covariance[0], np.exp(-np.array([0, 1, 3]) / 2))
    assert process_optional_args((None, 7), 1, 2, 3) == (1, 7, 3)


def test_amplitude_wrapper_matches_complex_forward_and_finite_difference():
    domain, boundaries, experiments = small_model()
    parameters = np.concatenate((np.full(16, -9.2), np.full(16, -10.2)))
    complex_output = run_distributed_k_ss(parameters, domain, boundaries, experiments, 1)
    expected_amplitude = np.hypot(complex_output[0], complex_output[1])
    amplitude = run_amplitude_distributed_k(parameters, domain, boundaries, experiments, 1)
    np.testing.assert_allclose(amplitude, [expected_amplitude])
    sensitivity = run_amplitude_distributed_k(parameters, domain, boundaries, experiments, 3)
    epsilon = 1e-6
    modified = parameters.copy()
    modified[10] += epsilon
    finite_difference = (
        run_amplitude_distributed_k(modified, domain, boundaries, experiments, 1) - amplitude
    ) / epsilon
    np.testing.assert_allclose(sensitivity[:, 10], finite_difference, atol=1e-10, rtol=1e-5)


def test_aperture_wrapper_chain_rule_with_finite_difference():
    domain, boundaries, experiments = small_model()
    parameters = np.full(16, np.log(1e-4))
    sensitivity = run_distributed_aperture(parameters, domain, boundaries, experiments, 3)
    epsilon = 1e-5
    plus = parameters.copy()
    minus = parameters.copy()
    plus[10] += epsilon
    minus[10] -= epsilon
    finite_difference = (
        run_distributed_aperture(plus, domain, boundaries, experiments, 1)
        - run_distributed_aperture(minus, domain, boundaries, experiments, 1)
    ) / (2 * epsilon)
    np.testing.assert_allclose(sensitivity[:, 10], finite_difference, atol=1e-10, rtol=1e-5)
