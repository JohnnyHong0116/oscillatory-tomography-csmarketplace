import { AnalysisResult } from '../types/aquifer';

/** Preserve IDs and full precision: these are synthetic model outputs, not measurements. */
export function syntheticObservationCsv(result: AnalysisResult): string {
  if (result.analysisMode !== 'forward') throw new Error('Use a forward prediction run to generate synthetic inversion input.');
  // The current strict CSV parser does not support quoted or comma-containing IDs.
  if (result.pairs.some(pair => [pair.testId, pair.observationWellId].some(id => /[,\r\n"]/.test(id)))) throw new Error('Test and well IDs cannot contain commas, quotes, or newlines in the measurement CSV.');
  return ['testId,wellId,real,imag', ...result.pairs.map(pair => `${pair.testId},${pair.observationWellId},${pair.predicted.real},${pair.predicted.imag}`)].join('\r\n');
}
