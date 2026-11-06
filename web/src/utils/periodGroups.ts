import { ModelConfig, TomographyTest } from '../types/aquifer';

/** Exact numeric identity: nearby but distinct periods must never be rounded
 * into one group. Grouping is presentation only; IDs and API order are stable. */
export const periodOf = (config: ModelConfig, test: TomographyTest) =>
  test.pumpingPeriod ?? config.pumpingPeriod;
export const validPeriod = (period: number) => Number.isFinite(period) && period > 0;
/** Display labels carry their period; IDs and user-entered names remain intact. */
export const testLabel = (config: ModelConfig, test: TomographyTest) =>
  `P = ${periodOf(config, test)} s · ${test.name}`;
export const matchesScope = (config: ModelConfig, scope: string, testId: string) =>
  scope === 'all' || scope === testId || (scope.startsWith('period:') &&
    config.tests.some(t => t.id === testId && periodOf(config,t) === Number(scope.slice(7))));
export function nextTestName(config: ModelConfig, period: number) {
  const names = new Set(config.tests.map(t=>t.name));
  let n = config.tests.filter(t=>periodOf(config,t) === period).length + 1;
  while(names.has(`P = ${period} s · Test ${n}`)) n++;
  return `P = ${period} s · Test ${n}`;
}
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
