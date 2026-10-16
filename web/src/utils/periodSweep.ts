import { ModelConfig, TomographyTest } from '../types/aquifer';

export type PeriodSampling = 'linear' | 'logarithmic' | 'list';
export function makePeriods(mode: PeriodSampling, start: number, end: number, interval: number, count: number, list: string): number[] {
  let periods: number[];
  if (mode === 'list') {
    periods = list.trim().split(/[\s,;]+/).map(Number);
  } else {
    if (![start, end].every(value => Number.isFinite(value) && value > 0) || end < start) throw new Error('Use positive periods with maximum ≥ minimum.');
    if (mode === 'logarithmic') {
      if (!Number.isInteger(count) || count < 2 || count > 30) throw new Error('Choose 2–30 logarithmic samples.');
      periods = Array.from({ length: count }, (_, index) => index === 0 ? start : index === count - 1 ? end : 10 ** (Math.log10(start) + index * (Math.log10(end) - Math.log10(start)) / (count - 1)));
    } else {
      if (!Number.isFinite(interval) || interval <= 0) throw new Error('Period increment must be positive.');
      const steps = Math.floor((end - start) / interval + 1e-10);
      if (steps > 29) throw new Error('This range exceeds 30 period samples. Increase the increment.');
      periods = Array.from({ length: steps + 1 }, (_, index) => Math.min(end, start + index * interval));
      if (end - periods[periods.length - 1] > Math.max(1, end) * 1e-10) periods.push(end);
    }
  }
  if (!periods.length || periods.length > 30 || periods.some(value => !Number.isFinite(value) || value <= 0)) throw new Error('Supply 1–30 finite, positive periods in seconds.');
  return [...new Set(periods)].sort((a, b) => a - b);
}

/** Group by physical roles, not by existing period rows. Sweeps leave geometry untouched. */
export function wellSetups(tests: TomographyTest[]): TomographyTest[] {
  const seen = new Set<string>();
  return tests.filter(test => {
    const key = JSON.stringify([test.pumpingWellId, [...test.observationWellIds].sort()]);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

export function sweepTests(config: ModelConfig, setups: TomographyTest[], periods: number[], amplitude: number,
  amplitudeMode: 'rate' | 'volume', idPrefix: string): TomographyTest[] {
  if (!setups.length || setups.some(setup => !setup.pumpingWellId || !setup.observationWellIds.length || setup.observationWellIds.includes(setup.pumpingWellId))) throw new Error('Select valid pumping and observation wells before building a sweep.');
  if (!periods.length || periods.some(period => !Number.isFinite(period) || period <= 0) || !Number.isFinite(amplitude) || amplitude <= 0) throw new Error('Periods and pumping amplitude must be finite and positive.');
  const testCount = setups.length * periods.length;
  const pairCount = setups.reduce((sum, setup) => sum + setup.observationWellIds.length, 0) * periods.length;
  if (testCount > 30 || pairCount > 100) throw new Error(`Sweep would create ${testCount} tests and ${pairCount} response pairs. Current limits: 30 tests / 100 pairs. Use fewer periods, fewer setups, or fewer observers.`);
  const generated = periods.flatMap((period, periodIndex) => setups.map((setup, setupIndex) => ({
    id: `${idPrefix}-${periodIndex + 1}-${setupIndex + 1}`,
    name: `${config.wells.find(well => well.id === setup.pumpingWellId)?.name ?? 'Pump'} · P=${Number(period.toPrecision(7))} s`,
    pumpingWellId: setup.pumpingWellId, observationWellIds: [...setup.observationWellIds],
    pumpingPeriod: period, pumpingRate: amplitudeMode === 'volume' ? Math.PI * amplitude / period : amplitude,
    status: 'pending' as const,
  })));
  if (generated.some(test => !Number.isFinite(test.pumpingRate) || test.pumpingRate <= 0)) throw new Error('The chosen volume and periods produce an unsupported pumping rate. Use physically meaningful values.');
  return generated;
}
