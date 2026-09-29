import { ModelConfig } from '../types/aquifer';

/** Faithful browser preset for examples/testing_inversion_2d_geostat.py.
 *  The eight tests contain the original 36 unique pump/observer pairs. */
export const DEFAULT_INVERSION_CONFIG: ModelConfig = {
  testCase: 'inversion_10s',
  minX: -50, maxX: 50, minY: -50, maxY: 50,
  gridNx: 50, gridNy: 50,
  pumpingPeriod: 10, pumpingRate: 0.01 * Math.PI / 10,
  wells: [-20, 0, 20].flatMap((x, column) => [-20, 0, 20].map((y, row) => {
    const number = column * 3 + row + 1;
    return { id: `w-${number}`, name: `W${number}`, x, y };
  })),
  tests: Array.from({ length: 8 }, (_, pumpIndex) => ({
    id: `test-${pumpIndex + 1}`,
    name: `Test ${pumpIndex + 1}`,
    pumpingWellId: `w-${pumpIndex + 1}`,
    observationWellIds: Array.from({ length: 8 - pumpIndex }, (_, offset) => `w-${pumpIndex + offset + 2}`),
    pumpingPeriod: 10,
    pumpingRate: 0.01 * Math.PI / 10,
    status: 'pending' as const,
  })),
  initialLnK: -9.0, initialLnSs: -11.0,
  dataErrorVar: 1e-8, corrLengthX: 15, corrLengthY: 15,
  boundaries: { west: 'constant_head', east: 'constant_head', south: 'constant_head', north: 'constant_head', top: 'no_flow', bottom: 'no_flow' },
  // Match the Python/MATLAB baseline budget. The solver still stops early
  // when both convergence tolerances are satisfied (typically iteration 8).
  maxIterations: 30,
};

/** Interactive subset of the MATLAB Black-Kipp sweep (same wells and physics,
 *  fewer periods and cells so it runs locally during a web demo). */
export const BLACK_KIPP_CONFIG: ModelConfig = {
  ...DEFAULT_INVERSION_CONFIG,
  testCase: 'black_kipp',
  minX: -300, maxX: 300, minY: -300, maxY: 300,
  gridNx: 60, gridNy: 60,
  pumpingPeriod: 10, pumpingRate: 0.001,
  wells: [
    { id: 'w-1', name: 'W1', x: 0, y: 0 },
    { id: 'w-2', name: 'W2', x: 0, y: 30 },
    { id: 'w-3', name: 'W3', x: 60, y: 0 },
    { id: 'w-4', name: 'W4', x: 0, y: -90 },
    { id: 'w-5', name: 'W5', x: -120, y: 0 },
  ],
  tests: [10, 20, 50, 100, 200, 400, 800, 1600, 10000].map((period, index) => ({
    id: `period-${period}`, name: `P = ${period} s`, pumpingWellId: 'w-1',
    observationWellIds: ['w-2', 'w-3', 'w-4', 'w-5'],
    pumpingPeriod: period, pumpingRate: 0.001, status: 'pending' as const,
  })),
  initialLnK: Math.log(3e-4), initialLnSs: Math.log(1e-5),
  boundaries: { west: 'constant_head', east: 'constant_head', south: 'constant_head', north: 'constant_head', top: 'no_flow', bottom: 'no_flow' },
};
