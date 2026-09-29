export type StepId = 1 | 2 | 3 | 4 | 5;

export type TestCaseType = 'inversion_10s' | 'black_kipp' | 'field_data';

export type TestExecutionStatus = 'pending' | 'running' | 'complete' | 'warning' | 'failed';

export interface Well {
  id: string;
  name: string; // e.g. "W1", "W2", "W3", "W4"
  x: number; // meters
  y: number; // meters
  color?: string;
  physicalProperties?: {
    casingDiameterM?: number;
    screenTopM?: number;
    screenBottomM?: number;
  };
}

export interface TomographyTest {
  id: string;
  name: string; // e.g. "Test 1", "Test 2"
  pumpingWellId: string; // Exactly 1 pumping well ID
  observationWellIds: string[]; // 1 or more observation well IDs
  pumpingPeriod?: number; // seconds
  pumpingRate?: number; // m3/s
  frequencies?: number[]; // Hz or s
  status?: TestExecutionStatus;
  errorMessage?: string;
  progressPct?: number;
  elapsedSec?: number;
}

export type BoundaryCondition = 'constant_head' | 'no_flow';

export interface BoundaryConditions {
  west: BoundaryCondition;
  east: BoundaryCondition;
  south: BoundaryCondition;
  north: BoundaryCondition;
  top: BoundaryCondition;
  bottom: BoundaryCondition;
}

export interface ModelConfig {
  testCase: TestCaseType;
  // Domain
  minX: number; // m
  maxX: number; // m
  minY: number; // m
  maxY: number; // m
  gridNx: number; // cells
  gridNy: number; // cells

  // Test parameters
  pumpingPeriod: number; // seconds
  pumpingRate: number; // m3/s
  wells: Well[];
  tests: TomographyTest[];

  // Initial model & Geostatistics
  initialLnK: number; // ln(m/s) e.g. -9.2
  initialLnSs: number; // ln(1/m) e.g. -11.5
  dataErrorVar: number; // m^2 noise variance
  corrLengthX: number; // m
  corrLengthY: number; // m

  // Boundary Conditions
  boundaries: BoundaryConditions;

  // Advanced Settings
  maxIterations: number;
}

export interface ValidationIssue {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  field?: string;
}

/** A measured response at one observation well for one pumping test. */
export interface ComplexObservation {
  testId: string;
  wellId: string;
  real: number;
  imag: number;
}

export interface AnalysisPair {
  testId: string;
  testName: string;
  pumpingWellId: string;
  pumpingWellName: string;
  observationWellId: string;
  observationWellName: string;
  periodSeconds: number;
  pumpingRateM3PerSecond: number;
  distanceMeters: number;
  predicted: { real: number; imag: number; amplitude: number; phaseDegrees: number };
  measured: { real: number; imag: number } | null;
  residualAmplitude: number | null;
  analytical?: { amplitude: number; phaseDegrees: number };
  numericalPhaseDegrees?: number;
  amplitudeRelativeError?: number;
  phaseErrorDegrees?: number;
}

export interface AnalysisProgress {
  status: 'queued' | 'running' | 'complete' | 'failed';
  stage: string;
  percent: number;
  testId: string | null;
  message: string;
  result: AnalysisResult | null;
  error: string | null;
  completedTestIds: string[];
  events: string[];
}

export interface AnalysisResult {
  mode: 'forward' | 'inversion';
  pairs: AnalysisPair[];
  fields: { lnK: number[][]; lnSs: number[][] } | null;
  iterations: number;
  objective: number | null;
  runtimeSeconds: number;
  grid: { nx: number; ny: number };
}
