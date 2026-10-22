import {
  AnalysisMode,
  AnalysisResult,
  ModelConfig,
  StepId,
  TestCaseType,
  TomographyTest,
} from '../types/aquifer';
import { BLACK_KIPP_CONFIG, DEFAULT_INVERSION_CONFIG } from '../data/presets';
import { syntheticObservationCsv } from './syntheticObservations';

export interface RunInput {
  analysisMode: AnalysisMode;
  csv: string;
  observationSource: 'field' | 'synthetic';
}
export interface ForwardSource {
  config: ModelConfig;
  result: AnalysisResult;
}
export interface ExperimentSession {
  name: string;
  step: StepId;
  config: ModelConfig;
  result: AnalysisResult | null;
  selectedTestId: string;
  runInput: RunInput;
  /** Keep the original generating run separate from the later inverse model. */
  forwardSource: ForwardSource | null;
}

/** A real project starts without invented site coordinates or assigned roles.
 * testCase remains the existing API's solver selector, NOT the project's name. */
export function createExperiment(): ExperimentSession {
  return {
    name: 'Untitled experiment',
    step: 1,
    config: {
      ...structuredClone(DEFAULT_INVERSION_CONFIG),
      minX: -100,
      maxX: 100,
      minY: -100,
      maxY: 100,
      gridNx: 40,
      gridNy: 40,
      wells: [],
      tests: [],
      pumpingRate: 0.001,
    },
    result: null,
    selectedTestId: '',
    forwardSource: null,
    runInput: { analysisMode: 'forward', csv: '', observationSource: 'field' },
  };
}

export function createExample(type: TestCaseType): ExperimentSession {
  if (type === 'field_data') throw new Error('Raw logger import is not implemented.');
  const config = structuredClone(type === 'black_kipp' ? BLACK_KIPP_CONFIG : DEFAULT_INVERSION_CONFIG);
  return {
    name: type === 'black_kipp' ? 'Black–Kipp practice' : 'P = 10 s checkerboard practice',
    step: 1,
    config,
    result: null,
    selectedTestId: config.tests[0].id,
    forwardSource: null,
    runInput: {
      analysisMode: type === 'black_kipp' ? 'forward' : 'synthetic_demo',
      csv: '',
      observationSource: 'synthetic',
    },
  };
}

/** Shared early gate mirrors the API's geometric contract. Do not silently
 * clip coordinates, move wells to cells, or invent a new domain to pass it. */
export function modelIssues(config: ModelConfig): string[] {
  const issues: string[] = [];
  const { minX, maxX, minY, maxY, gridNx: nx, gridNy: ny, wells, boundaries } = config;
  const max = config.testCase === 'black_kipp' ? 300 : 60;
  const domainValid = [minX, maxX, minY, maxY].every(Number.isFinite) && minX < maxX && minY < maxY;
  const gridValid = [nx, ny].every((n) => Number.isInteger(n) && n >= 3 && n <= max);
  if (!domainValid) issues.push('Enter valid domain extents: minimum must be below maximum.');
  if (!gridValid) issues.push(`Use whole grid counts from 3 to ${max} per axis.`);
  if (wells.length < 2 || wells.length > 30) issues.push('Define 2–30 physical wells before continuing.');
  if (
    new Set(wells.map((w) => w.id)).size !== wells.length ||
    new Set(wells.map((w) => w.name.trim().toLowerCase())).size !== wells.length ||
    wells.some((w) => !w.name.trim())
  )
    issues.push('Use unique well IDs and non-empty, unique labels.');
  if (wells.some((w) => !Number.isFinite(w.x) || !Number.isFinite(w.y)))
    issues.push('All well coordinates must be finite numbers.');
  if (domainValid && gridValid) {
    const hx = (maxX - minX) / (2 * nx),
      hy = (maxY - minY) / (2 * ny);
    if (wells.some((w) => w.x < minX + hx || w.x > maxX - hx || w.y < minY + hy || w.y > maxY - hy))
      issues.push('Keep wells within the outer cell centers; expand the domain or edit coordinates.');
  }
  if (
    !['west', 'east', 'north', 'south'].some(
      (side) => boundaries[side as keyof typeof boundaries] === 'constant_head',
    )
  )
    issues.push('This solver requires at least one horizontal constant-head edge.');
  if (boundaries.top !== 'no_flow' || boundaries.bottom !== 'no_flow')
    issues.push('The one-layer model requires no-flow top and bottom boundaries.');
  if (
    ![config.initialLnK, config.initialLnSs].every(n => Number.isFinite(n) && n >= -30 && n <= 0) ||
    ![config.dataErrorVar, config.corrLengthX, config.corrLengthY].every(n => Number.isFinite(n) && n > 0) ||
    !Number.isInteger(config.maxIterations) || config.maxIterations < 1 || config.maxIterations > 50
  ) issues.push('Check initial log properties (−30 to 0), positive variance/correlation lengths, and 1–50 whole inversion iterations.');
  return issues;
}

export function testIssues(config: ModelConfig): string[] {
  const issues = modelIssues(config);
  const ids = new Set(config.wells.map((w) => w.id));
  if (!config.tests.length || config.tests.length > 30) issues.push('Configure 1–30 tests.');
  if (config.tests.reduce((n, t) => n + t.observationWellIds.length, 0) > 100)
    issues.push('The current solver supports at most 100 response pairs.');
  if (new Set(config.tests.map((t) => t.id)).size !== config.tests.length)
    issues.push('Test IDs must be unique.');
  for (const t of config.tests) {
    if (!t.name.trim()) issues.push('Give every test a non-empty name.');
    if (
      !ids.has(t.pumpingWellId) ||
      !t.observationWellIds.length ||
      t.observationWellIds.some((id) => !ids.has(id) || id === t.pumpingWellId) ||
      new Set(t.observationWellIds).size !== t.observationWellIds.length
    )
      issues.push(`${t.name}: choose one pump and distinct, existing observers.`);
    if (
      ![t.pumpingPeriod ?? config.pumpingPeriod, t.pumpingRate ?? config.pumpingRate].every(
        (n) => Number.isFinite(n) && n > 0,
      )
    )
      issues.push(`${t.name}: period and peak pumping amplitude must be positive.`);
    const pump = config.wells.find((w) => w.id === t.pumpingWellId);
    if (
      config.testCase === 'black_kipp' &&
      pump &&
      config.wells.some((w) => t.observationWellIds.includes(w.id) && w.x === pump.x && w.y === pump.y)
    )
      issues.push(`${t.name}: Black–Kipp requires a nonzero pump–observer distance.`);
  }
  return issues;
}

/** Transfer actual phasors, never amplitudes/phases rounded for chart display.
 * Keep geometry, roles, periods, rates, boundaries and source grid metadata.
 * A coarser inverse grid is explicit; its discretization error is not erased. */
export function prepareInversion(source: ExperimentSession, nx: number, ny: number): ExperimentSession {
  if (!source.result || source.result.analysisMode !== 'forward')
    throw new Error('Complete a forward run before transferring observations.');
  if (![nx, ny].every((n) => Number.isInteger(n) && n >= 3 && n <= 60))
    throw new Error('The inversion grid must have 3–60 whole cells per axis.');
  if (source.result.grid.nx !== source.config.gridNx || source.result.grid.ny !== source.config.gridNy)
    throw new Error('The result grid no longer matches the configured generating model. Run forward again.');
  const expected = new Map<string, TomographyTest>(
    source.config.tests.flatMap((t) => t.observationWellIds.map((id) => [`${t.id}\0${id}`, t] as const)),
  );
  const seen = new Set<string>();
  for (const pair of source.result.pairs) {
    const key = `${pair.testId}\0${pair.observationWellId}`,
      t = expected.get(key);
    if (
      !t ||
      seen.has(key) ||
      pair.pumpingWellId !== t.pumpingWellId ||
      pair.periodSeconds !== (t.pumpingPeriod ?? source.config.pumpingPeriod) ||
      pair.pumpingRateM3PerSecond !== (t.pumpingRate ?? source.config.pumpingRate) ||
      ![pair.predicted.real, pair.predicted.imag].every(Number.isFinite)
    )
      throw new Error('Forward responses do not match the current tests. Run forward again before transfer.');
    seen.add(key);
  }
  if (!expected.size || expected.size !== seen.size) throw new Error('Forward responses are incomplete.');
  const config = {
    ...structuredClone(source.config),
    testCase: 'inversion_10s' as const,
    gridNx: nx,
    gridNy: ny,
  };
  const problems = testIssues(config);
  if (problems.length) throw new Error(problems.join(' '));
  return {
    ...structuredClone(source),
    step: 3,
    config,
    result: null,
    runInput: {
      analysisMode: 'measured_inversion',
      csv: syntheticObservationCsv(source.result),
      observationSource: 'synthetic',
    },
    forwardSource: { config: structuredClone(source.config), result: structuredClone(source.result) },
  };
}
