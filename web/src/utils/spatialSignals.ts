import { AnalysisPair, ModelConfig, Well } from '../types/aquifer';
import { signalValue } from './signalMap';

export type SignalSource = 'predicted' | 'measured';
export type SignalColor = 'relative_delay' | 'phase';
export const positiveModulo = (n: number, period: number) => ((n % period) + period) % period;

/** Co-location is a display grouping, not an assertion about borehole casing or
 * screen connectivity. Exact XY identity avoids merging separate nearby holes. */
export function portColumns(wells: Well[]) {
  const groups = new Map<string, Well[]>();
  for (const well of wells) {
    const key = JSON.stringify([well.x, well.y]);
    groups.set(key, [...(groups.get(key) ?? []), well]);
  }
  return [...groups.values()].map((ports) => ({
    x: ports[0].x,
    y: ports[0].y,
    ports: [...ports].sort((a, b) => (a.z ?? 0) - (b.z ?? 0)),
  }));
}

/** Reuse a shared explicit label prefix (B1.1, B1.2 -> B1). Otherwise display
 * the first actual port label, never invent a physical borehole identifier. */
export function columnLabel(ports: Well[]) {
  const prefixes = ports.map((p) => p.name.split(/[.:/]/)[0]);
  return prefixes.every((p) => p === prefixes[0])
    ? prefixes[0]
    : `${ports[0].name}${ports.length > 1 ? '…' : ''}`;
}

/** Select the leading phase on the smallest covering circular arc. This is a
 * reproducible phase reference, NOT an independently measured first-arrival time.
 * Each test/source gets its own reference; never compare seconds across tests
 * as if they shared a measured time origin. Ties retain observation order. */
export function leadingPhaseReference(pairs: AnalysisPair[], source: SignalSource) {
  const signals = pairs
    .map((pair, index) => ({ pair, index, value: signalValue(pair, source) }))
    .filter((item) => item.value?.phase !== null && item.value?.phase !== undefined)
    .map((item) => ({ ...item, delay: positiveModulo(-item.value!.phase!, 360) }))
    .sort((a, b) => a.delay - b.delay || a.index - b.index);
  if (!signals.length) return null;
  let best = 0,
    gap = -1;
  for (let i = 0; i < signals.length; i++) {
    const next = (i + 1) % signals.length;
    const distance = signals[next].delay + (next === 0 ? 360 : 0) - signals[i].delay;
    if (distance > gap + 1e-10) {
      gap = distance;
      best = next;
    }
  }
  return signals[best].pair.observationWellId;
}

/** With h(t)=Re[Φ exp(iωt)], peak time is -arg(Φ)/ω. A relative phase delay
 * therefore uses (arg(reference)-arg(observer))/ω, modulo one period.
 * No interpolation, unwrapping across distance, or absolute travel-time inference. */
export function relativePhaseDelay(phase: number | null, reference: number | null, period: number) {
  if (
    phase === null ||
    reference === null ||
    !Number.isFinite(phase) ||
    !Number.isFinite(reference) ||
    !Number.isFinite(period) ||
    period <= 0
  )
    return null;
  const delay = (positiveModulo(reference - phase, 360) * period) / 360;
  return delay < period * 1e-12 || period - delay < period * 1e-12 ? 0 : delay;
}

export function signalDelays(
  pairs: AnalysisPair[],
  source: SignalSource,
  referenceId: string,
  period: number,
) {
  const reference = referenceId === 'auto' ? leadingPhaseReference(pairs, source) : referenceId;
  const pair = pairs.find((p) => p.observationWellId === reference);
  const phase = pair ? (signalValue(pair, source)?.phase ?? null) : null;
  return {
    referenceId: reference ?? '',
    referencePhase: phase,
    values: new Map(
      pairs.map((p) => [
        p.observationWellId,
        relativePhaseDelay(signalValue(p, source)?.phase ?? null, phase, period),
      ]),
    ),
  };
}

/** Sequential, perceptually ordered colors for scalar delay. Raw phase retains
 * its separate cyclic palette. Color semantics must never change silently. */
export function delayColor(value: number | null, maximum: number) {
  if (value === null) return '#94A3B8';
  const stops = [
    [68, 1, 84],
    [59, 82, 139],
    [33, 145, 140],
    [94, 201, 98],
    [253, 231, 37],
  ];
  const t = Math.max(0, Math.min(1, maximum > 0 ? value / maximum : 0)) * 4;
  const i = Math.min(3, Math.floor(t)),
    mix = t - i;
  return `rgb(${stops[i].map((channel, j) => Math.round(channel + (stops[i + 1][j] - channel) * mix)).join(',')})`;
}

export function referencePlanes(config: ModelConfig) {
  const lo = config.minZ ?? -40,
    hi = config.maxZ ?? 40;
  return [
    { label: 'Ground surface', z: config.siteContext?.groundSurfaceZ, color: '#647454' },
    { label: 'Water table', z: config.siteContext?.waterTableZ, color: '#0284C7' },
  ].filter((p) => p.z !== undefined && Number.isFinite(p.z) && p.z! >= lo && p.z! <= hi) as {
    label: string;
    z: number;
    color: string;
  }[];
}
