import { AnalysisPair } from '../types/aquifer';

/** Use raw complex heads, never a rounded chart label or Black–Kipp's separate
 * phase-delay convention. Zero magnitude has no defined phase. */
export function signalValue(pair: AnalysisPair, source: 'predicted' | 'measured') {
  const value = pair[source];
  if (!value || ![value.real, value.imag].every(Number.isFinite)) return null;
  const amplitude = Math.hypot(value.real, value.imag);
  const phase = amplitude === 0 ? null : (Math.atan2(value.imag, value.real) * 180) / Math.PI;
  return { ...value, amplitude, phase };
}

export function signalRadius(amplitude: number, amplitudes: number[], scale: 'log' | 'area') {
  const max = Math.max(0, ...amplitudes);
  if (amplitude <= 0 || max === 0) return 4;
  if (scale === 'area') return Math.sqrt(25 + (375 * amplitude) / max);
  const min = Math.min(...amplitudes.filter((v) => v > 0));
  const fraction =
    max === min ? 0.5 : (Math.log10(amplitude) - Math.log10(min)) / (Math.log10(max) - Math.log10(min));
  return 6 + 14 * Math.max(0, Math.min(1, fraction));
}

/** Cyclic palette: -180 and +180 degrees have the same color. */
export const phaseColor = (phase: number | null) =>
  phase === null ? '#94A3B8' : `hsl(${(((phase + 180) % 360) + 360) % 360} 65% 55%)`;
