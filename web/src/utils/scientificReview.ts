import { BLACK_KIPP_CONFIG, DEFAULT_INVERSION_CONFIG } from '../data/presets';
import { ModelConfig } from '../types/aquifer';

/** Compare numerical inputs, not display names or transient execution status.
 * Matching inputs is not a claim of bit-for-bit MATLAB/Python result parity. */
function numericalInputs(config: ModelConfig) {
  return {
    dimension: config.dimension??2,
    ...(config.dimension===3?{z:[config.minZ,config.maxZ,config.gridNz,config.corrLengthZ],wellZ:config.wells.map(w=>w.z)}:{}),
    testCase: config.testCase,
    syntheticField: config.syntheticField ?? 'checkerboard',
    syntheticRealization: config.syntheticRealization ?? 'numpy',
    syntheticSeed: config.syntheticField === 'geostatistical' ? (config.syntheticSeed ?? 0) : null,
    domain: [config.minX, config.maxX, config.minY, config.maxY, config.gridNx, config.gridNy],
    priors: [
      config.initialLnK,
      config.initialLnSs,
      config.dataErrorVar,
      config.corrLengthX,
      config.corrLengthY,
      config.maxIterations,
    ],
    boundaries: ['west', 'east', 'south', 'north', 'top', 'bottom'].map(
      (side) => config.boundaries[side as keyof ModelConfig['boundaries']],
    ),
    wells: config.wells.map((well) => [well.id, well.x, well.y]),
    tests: config.tests.map((test) => [
      test.id,
      test.pumpingWellId,
      test.observationWellIds,
      test.pumpingPeriod ?? config.pumpingPeriod,
      test.pumpingRate ?? config.pumpingRate,
    ]),
  };
}

export function matchesBaselineConfiguration(config: ModelConfig) {
  const baseline = config.testCase === 'black_kipp' ? BLACK_KIPP_CONFIG : DEFAULT_INVERSION_CONFIG;
  return JSON.stringify(numericalInputs(config)) === JSON.stringify(numericalInputs(baseline));
}

/** Advisory design checks only. Do not automatically relocate wells, change
 * test roles, tune priors, or infer statistical confidence from this summary. */
export function scientificDesignSummary(config: ModelConfig) {
  const periods = [...new Set(config.tests.map((test) => test.pumpingPeriod ?? config.pumpingPeriod))];
  const pairs = config.tests.reduce((total, test) => total + test.observationWellIds.length, 0);
  const dx = (config.maxX - config.minX) / config.gridNx;
  const dy = (config.maxY - config.minY) / config.gridNy;
  let shortestDistance = Infinity;
  for (const test of config.tests) {
    const pump = config.wells.find((well) => well.id === test.pumpingWellId);
    if (!pump) continue;
    for (const id of test.observationWellIds) {
      const observer = config.wells.find((well) => well.id === id);
      if (observer)
        shortestDistance = Math.min(shortestDistance, Math.hypot(observer.x - pump.x, observer.y - pump.y,config.dimension===3?(observer.z??0)-(pump.z??0):0));
    }
  }
  return {
    periods: periods.length,
    pairs,
    realComponents: pairs * 2,
    unknowns: config.gridNx * config.gridNy * (config.dimension===3?(config.gridNz??1):1) * 2,
    dx,
    dy,
    shortestDistance: Number.isFinite(shortestDistance) ? shortestDistance : null,
    coincidentPair: shortestDistance === 0,
    subcellSpacing: shortestDistance > 0 && shortestDistance < Math.max(dx, dy),
  };
}
