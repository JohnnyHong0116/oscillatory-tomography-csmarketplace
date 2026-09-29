import React, { useState } from 'react';
import { AnalysisPair, ModelConfig } from '../../types/aquifer';

interface Props { config: ModelConfig; pairs: AnalysisPair[] }

/** Draw solver values directly; no synthetic canvas texture or placeholder data. */
export const ResponsePlots: React.FC<Props> = ({ config, pairs }) => {
  const isComparison = config.testCase === 'black_kipp';
  const [wellId, setWellId] = useState(config.wells.find((well) => well.id !== config.tests[0]?.pumpingWellId)?.id ?? '');
  const plotted = (isComparison ? pairs.filter((pair) => pair.observationWellId === wellId) : pairs)
    .slice().sort((a, b) => isComparison ? a.periodSeconds - b.periodSeconds : 0);
  const labels = plotted.map((pair) => isComparison ? `${pair.periodSeconds}s` : `${pair.testName} · ${pair.observationWellName}`);

  const plot = (kind: 'amplitude' | 'phase') => {
    const width = 560, height = 270, left = 66, right = 18, top = 22, bottom = 54;
    const value = (pair: AnalysisPair, source: 'predicted' | 'analytical') => {
      const data = pair[source];
      const raw = kind === 'amplitude' ? data?.amplitude : source === 'predicted' && isComparison ? pair.numericalPhaseDegrees : data?.phaseDegrees;
      return kind === 'amplitude' ? Math.log10(Math.max(raw ?? 1e-30, 1e-30)) : (raw ?? 0);
    };
    const all = plotted.flatMap((pair) => [value(pair, 'predicted'), ...(pair.analytical ? [value(pair, 'analytical')] : [])]);
    const min = Math.min(...all), max = Math.max(...all);
    const span = max - min || 1;
    const logPeriods = plotted.map((pair) => Math.log10(pair.periodSeconds));
    const minPeriod = Math.min(...logPeriods), maxPeriod = Math.max(...logPeriods);
    const x = (index: number) => isComparison
      ? left + 12 + (logPeriods[index] - minPeriod) / (maxPeriod - minPeriod || 1) * (width - left - right - 24)
      : left + (index + 0.5) * (width - left - right) / Math.max(1, plotted.length);
    const y = (number: number) => top + (max - number) / span * (height - top - bottom);
    const points = (source: 'predicted' | 'analytical') => plotted.map((pair, index) => `${x(index)},${y(value(pair, source))}`).join(' ');
    return <div className="min-w-0"><h4 className="text-sm font-bold mb-2">{kind === 'amplitude' ? 'Response amplitude (m, log scale)' : isComparison ? 'Phase delay (degrees)' : 'Phase angle (degrees)'}</h4>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full bg-[#111] rounded-lg" role="img" aria-label={`${kind} plot of numerical${isComparison ? ' and analytical' : ''} responses`}>
        {[0, 1, 2, 3, 4].map((index) => { const yy = top + index * (height - top - bottom) / 4; const tick = max - index * span / 4; return <g key={index}><line x1={left} x2={width - right} y1={yy} y2={yy} stroke="#444" strokeDasharray="3 4" /><text x={left - 8} y={yy + 4} textAnchor="end" fill="#bbb" fontSize="11">{kind === 'amplitude' ? `10^${tick.toFixed(1)}` : tick.toFixed(0)}</text></g>; })}
        <polyline fill="none" stroke="#60A5FA" strokeWidth="2.5" points={points('predicted')} />
        {isComparison && <polyline fill="none" stroke="#F87171" strokeWidth="2.5" strokeDasharray="6 4" points={points('analytical')} />}
        {plotted.map((pair, index) => <g key={`${pair.testId}-${pair.observationWellId}`}><circle cx={x(index)} cy={y(value(pair, 'predicted'))} r="4" fill="#60A5FA"><title>{labels[index]}: {kind === 'amplitude' ? pair.predicted.amplitude.toExponential(3) : (isComparison ? pair.numericalPhaseDegrees ?? 0 : pair.predicted.phaseDegrees).toFixed(2)}</title></circle>{isComparison && <circle cx={x(index)} cy={y(value(pair, 'analytical'))} r="3.5" fill="#F87171" />}{(isComparison || plotted.length <= 10) && <text x={x(index)} y={height - 20} textAnchor="middle" fill="#bbb" fontSize="10">{isComparison ? labels[index] : `${index + 1}`}</text>}</g>)}
        <line x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} stroke="#999" />
      </svg>
      {!isComparison && <div className="mt-2 text-[11px] text-[#6B7074]">{labels.map((label, index) => `${index + 1}: ${label}`).join(' · ')}</div>}
    </div>;
  };

  if (!plotted.length) return null;
  return <div className="bg-white border border-[#D6DADD] rounded-xl p-5 space-y-4"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-bold">{isComparison ? 'Numerical vs Black–Kipp analytical response' : 'Predicted response plots'}</h3><p className="text-xs text-[#6B7074]">Blue: finite-difference Python solver{isComparison ? ' · Red: analytical solution' : ''}</p></div>
    {isComparison && <select aria-label="Observation well for comparison" className="border rounded p-2 text-xs" value={wellId} onChange={(event) => setWellId(event.target.value)}>{config.wells.filter((well) => well.id !== config.tests[0]?.pumpingWellId).map((well) => <option key={well.id} value={well.id}>{well.name} · {pairs.find((pair) => pair.observationWellId === well.id)?.distanceMeters} m</option>)}</select>}</div>
    <div className="grid lg:grid-cols-2 gap-5">{plot('amplitude')}{plot('phase')}</div>
  </div>;
};
