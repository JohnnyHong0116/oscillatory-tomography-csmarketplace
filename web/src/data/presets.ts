import { ModelConfig } from '../types/aquifer';

/** A small real solver setup; no generated measurements or results. */
export const DEFAULT_INVERSION_CONFIG: ModelConfig = {
  testCase: 'inversion_10s',
  minX: 0, maxX: 100, minY: 0, maxY: 100,
  gridNx: 40, gridNy: 40,
  pumpingPeriod: 10, pumpingRate: 0.002,
  wells: [
    { id: 'w-1', name: 'W1', x: 50, y: 50 },
    { id: 'w-2', name: 'W2', x: 50, y: 75 },
    { id: 'w-3', name: 'W3', x: 75, y: 50 },
    { id: 'w-4', name: 'W4', x: 50, y: 25 },
  ],
  tests: [
    { id: 'test-1', name: 'Test 1', pumpingWellId: 'w-1', observationWellIds: ['w-2', 'w-3', 'w-4'], pumpingPeriod: 10, pumpingRate: 0.002, status: 'pending' },
    { id: 'test-2', name: 'Test 2', pumpingWellId: 'w-3', observationWellIds: ['w-1', 'w-2', 'w-4'], pumpingPeriod: 10, pumpingRate: 0.002, status: 'pending' },
    { id: 'test-3', name: 'Test 3', pumpingWellId: 'w-2', observationWellIds: ['w-4'], pumpingPeriod: 10, pumpingRate: 0.002, status: 'pending' },
  ],
  initialLnK: -9.21, initialLnSs: -11.51,
  dataErrorVar: 0.0001, corrLengthX: 25, corrLengthY: 25,
  boundaries: { west: 'constant_head', east: 'constant_head', south: 'no_flow', north: 'no_flow', top: 'no_flow', bottom: 'no_flow' },
  maxIterations: 8,
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
