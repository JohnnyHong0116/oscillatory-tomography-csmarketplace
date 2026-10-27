import { ModelConfig, TomographyTest } from '../types/aquifer';

/** Exact numeric identity: nearby but distinct periods must never be rounded
 * into one group. Grouping is presentation only; IDs and API order are stable. */
export const periodOf = (config: ModelConfig, test: TomographyTest) =>
  test.pumpingPeriod ?? config.pumpingPeriod;
export const validPeriod = (period: number) => Number.isFinite(period) && period > 0;
export function periodGroups(config: ModelConfig) {
  const periods = [
    ...new Set([...(config.periodGroups ?? []), ...config.tests.map((t) => periodOf(config, t))]),
  ]
    .filter(validPeriod)
    .sort((a, b) => a - b);
  return periods.map((period) => ({
    period,
    tests: config.tests.filter((t) => periodOf(config, t) === period),
  }));
}

export function addPeriodGroup(config: ModelConfig, period: number): ModelConfig {
  if (!validPeriod(period)) throw new Error('Enter a positive period in seconds.');
  if (periodGroups(config).some((group) => group.period === period)) return config;
  if (periodGroups(config).length >= 30) throw new Error('At most 30 period groups are supported.');
  return { ...config, periodGroups: [...(config.periodGroups ?? []), period] };
}

export function testsInPeriod(config: ModelConfig, selected: string, editingId?: string | null) {
  if (selected === 'all')
    return [
      ...periodGroups(config).flatMap((group) => group.tests),
      ...config.tests.filter((t) => !validPeriod(periodOf(config, t))),
    ];
  // Invalid drafts stay visible instead of disappearing while users backspace.
  return config.tests.filter(
    (t) =>
      t.id === editingId || !validPeriod(periodOf(config, t)) || periodOf(config, t) === Number(selected),
  );
}
