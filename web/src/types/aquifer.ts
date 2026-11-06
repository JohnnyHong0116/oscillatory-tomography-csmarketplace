export type StepId = 1 | 2 | 3 | 4 | 5;

export type TestCaseType = 'inversion_10s' | 'black_kipp' | 'field_data';
export type ExampleType = TestCaseType | 'matlab_3d' | 'matlab_3d_quick';

export type TestExecutionStatus = 'pending' | 'running' | 'complete' | 'warning' | 'failed';

export interface Well {
  id: string;
  name: string; // e.g. "W1", "W2", "W3", "W4"
  x: number; // meters
  y: number; // meters
  z?: number; // Local elevation (positive upward), used by 3D point ports.
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
  /** Optional entered site annotations, in the same Z datum as ports. Display
   * context only: these do not introduce a free-surface boundary condition. */
  siteContext?: { verticalDatum?: string; groundSurfaceZ?: number; waterTableZ?: number };
  dimension?: 2 | 3;
  minZ?: number;
  maxZ?: number;
  gridNz?: number;
  corrLengthZ?: number;
  /** UI-only empty period groups; actual solver periods remain on each test. */
  periodGroups?: number[];
  /** Undefined preserves homogeneous forward / original checkerboard demo. */
  syntheticField?: 'checkerboard' | 'geostatistical';
  syntheticSeed?: number;
  syntheticRealization?: 'numpy' | 'matlab_reference';
  testCase: TestCaseType;
  /** Example provenance only; the API still receives the existing solver selector. */
  examplePreset?: 'matlab_3d' | 'matlab_3d_quick';
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
  effectiveProperties?: {
    diffusivityM2PerSecond: number;
    transmissivityM2PerSecond: number;
    storativity: number;
  };
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
  solverRevision?: string;
  examplePreview?: {generatedAt: string; solver: string; source: string; sourceTreeSha256: string; note: string; randomNote: string};
  dimension?: 2 | 3;
  /** Lossless layer-major [z][y][x] volumes; 2D fields are the middle Z slice. */
  volumeFields?: Partial<Record<'fields' | 'trueFields' | 'errorFields' | 'sensitivityFields', { lnK: number[][][]; lnSs: number[][][] }>> | null;
  syntheticTruth?: {
    realization?: 'numpy' | 'matlab_reference';
    kind: 'checkerboard' | 'geostatistical';
    seed: number | null;
    meanLnK: number;
    meanLnSs: number;
    parameters: Record<string, number | string>;
  } | null;
  /** Frontend provenance only; never submitted as a scientific solver option. */
  forwardInput?: {
    sourceGrid: { nx: number; ny: number; nz?: number };
    inversionGrid: { nx: number; ny: number; nz?: number };
    responsePairs: number;
    generatingTruth?: AnalysisResult['syntheticTruth'];
  };
  observationSource?: 'field' | 'synthetic'; // User-declared provenance for imported phasors; not a solver input.
  mode: 'forward' | 'inversion';
  analysisMode: AnalysisMode;
  pairs: AnalysisPair[];
  fields: { lnK: number[][]; lnSs: number[][] } | null;
  trueFields: { lnK: number[][]; lnSs: number[][] } | null;
  errorFields: { lnK: number[][]; lnSs: number[][] } | null;
  sensitivityFields: { lnK: number[][]; lnSs: number[][] } | null;
  objectiveHistory: { iteration: number; objective: number }[];
  diagnostics: {
    responseRmse: number;
    meanAmplitudeRelativeError: number;
    phaseRmseDegrees: number;
    lnKFieldRmse?: number;
    lnSsFieldRmse?: number;
  } | null;
  iterations: number;
  objective: number | null;
  runtimeSeconds: number;
  grid: { nx: number; ny: number; nz?: number };
}

export type AnalysisMode = 'forward' | 'synthetic_demo' | 'measured_inversion';
