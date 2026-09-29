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
