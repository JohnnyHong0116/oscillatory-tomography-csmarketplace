import React, { useState } from 'react';
import { AnalysisPair, ModelConfig } from '../../types/aquifer';
import { InspectablePoint, PlotInspection, PlotLegendButton, responseDetails } from './PlotInspection';
import { ExpandablePlot } from './ExpandablePlot';

interface Props { config: ModelConfig; pairs: AnalysisPair[] }

const WELL_COLORS = ['#60A5FA', '#34D399', '#C084FC', '#F472B6'];

/** Preserve the generic observation plot used by the tomography workflow. */
function TomographyPlots({ pairs }: { pairs: AnalysisPair[] }) {
  const plot = (kind: 'amplitude' | 'phase') => {
    const width = 560, height = 270, left = 66, right = 18, top = 22, bottom = 54;
    const value = (pair: AnalysisPair) => kind === 'amplitude'
      ? Math.log10(Math.max(pair.predicted.amplitude, 1e-30))
      : pair.predicted.phaseDegrees;
    const values = pairs.map(value);
    const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
    const x = (index: number) => left + (index + 0.5) * (width - left - right) / Math.max(1, pairs.length);
    const y = (number: number) => top + (max - number) / span * (height - top - bottom);
    const points = pairs.map((pair, index) => `${x(index)},${y(value(pair))}`).join(' ');
    return <ExpandablePlot title={kind === 'amplitude' ? 'Response amplitude' : 'Phase angle'} showInspection><div className="min-w-0"><h4 className="text-sm font-bold mb-2">{kind === 'amplitude' ? 'Response amplitude (m, log scale)' : 'Phase angle (degrees)'}</h4>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full bg-[#111] rounded-lg" role="group" aria-label={`${kind} plot of predicted responses`}>
        {[0, 1, 2, 3, 4].map((index) => { const yy = top + index * (height - top - bottom) / 4; const tick = max - index * span / 4; return <g key={index}><line x1={left} x2={width - right} y1={yy} y2={yy} stroke="#444" strokeDasharray="3 4" /><text x={left - 8} y={yy + 4} textAnchor="end" fill="#bbb" fontSize="11">{kind === 'amplitude' ? `10^${tick.toFixed(1)}` : tick.toFixed(0)}</text></g>; })}
        <polyline fill="none" stroke="#60A5FA" strokeWidth="2.5" points={points} />
        {pairs.map((pair, index) => <InspectablePoint key={`${pair.testId}-${pair.observationWellId}`} cx={x(index)} cy={y(value(pair))} details={responseDetails(pair)}><circle cx={x(index)} cy={y(value(pair))} r="4" fill="#60A5FA" /></InspectablePoint>)}
        <line x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} stroke="#999" />
        {pairs.map((_, index) => index).filter(index => index === 0 || index === pairs.length - 1 || index % Math.max(1, Math.ceil(pairs.length / 6)) === 0)
          .map(index => <text key={index} x={x(index)} y={height - 32} textAnchor="middle" fill="#bbb" fontSize="10">{index + 1}</text>)}
        <text x={(left + width - right) / 2} y={height - 12} textAnchor="middle" fill="#bbb" fontSize="10">Response pair</text>
      </svg>
    </div></ExpandablePlot>;
  };
  return <div className="bg-white border border-[#D6DADD] rounded-xl p-5 space-y-4"><div><h3 className="font-bold">Predicted response plots</h3><p className="text-xs text-[#6B7074]">Blue: finite-difference Python solver</p></div><div className="grid lg:grid-cols-2 gap-5">{plot('amplitude')}{plot('phase')}</div>
    {/* One optional index serves both plots; point inspection remains the primary lookup. */}
    <details className="text-xs text-slate-600">
      <summary className="cursor-pointer w-fit rounded focus-ring">Response pair index ({pairs.length})</summary>
      <ol className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-1 max-h-48 overflow-y-auto list-none">
        {pairs.map((pair, index) => <li key={`${pair.testId}-${pair.observationWellId}`}><span className="font-mono">{index + 1}.</span> {pair.testName}: {pair.pumpingWellName} → {pair.observationWellName}</li>)}
      </ol>
    </details>
  </div>;
}

/** Baseline-style Black-Kipp plot: all four radii are shown together. When a
 * single period is selected, distance becomes the x-axis so the view still
 * contains all four numerical/analytical comparisons instead of one dot. */
function BlackKippPlots({ config, pairs }: Props) {
  const [hiddenGroups, setHiddenGroups] = useState<string[]>([]);
  const periods = [...new Set(pairs.map((pair) => pair.periodSeconds))].sort((a, b) => a - b);
  const singlePeriod = periods.length === 1;
  const wells = config.wells.filter((well) => well.id !== config.tests[0]?.pumpingWellId);
  const groups = singlePeriod
    ? [{ id: 'selected-period', label: `P = ${periods[0].toPrecision(5)} s`, color: '#60A5FA', pairs: pairs.slice().sort((a, b) => a.distanceMeters - b.distanceMeters) }]
    : wells.map((well, index) => ({
      id: well.id,
      label: `${well.name} · ${pairs.find((pair) => pair.observationWellId === well.id)?.distanceMeters ?? '—'} m`,
      color: WELL_COLORS[index % WELL_COLORS.length],
      pairs: pairs.filter((pair) => pair.observationWellId === well.id).sort((a, b) => a.periodSeconds - b.periodSeconds),
    })).filter((group) => group.pairs.length > 0);
  const xValues = singlePeriod ? groups[0].pairs.map((pair) => pair.distanceMeters) : periods;
  const logarithmicX = !singlePeriod;
  const transformX = (value: number) => logarithmicX ? Math.log10(value) : value;

  const plot = (kind: 'amplitude' | 'phase') => {
    const width = 620, height = 300, left = 72, right = 24, top = 24, bottom = 58;
    const value = (pair: AnalysisPair, analytical: boolean) => {
      const raw = kind === 'amplitude'
        ? analytical ? pair.analytical?.amplitude ?? 1e-30 : pair.predicted.amplitude
        : analytical ? pair.analytical?.phaseDegrees ?? 0 : pair.numericalPhaseDegrees ?? 0;
      return kind === 'amplitude' ? Math.log10(Math.max(raw, 1e-30)) : raw;
    };
    const values = groups.flatMap((group) => group.pairs.flatMap((pair) => [value(pair, false), value(pair, true)]));
    const rawMin = Math.min(...values), rawMax = Math.max(...values);
    const padding = Math.max((rawMax - rawMin) * 0.08, kind === 'phase' ? 1 : 0.04);
    const min = rawMin - padding, max = rawMax + padding, span = max - min || 1;
    const transformedX = xValues.map(transformX);
    const minX = Math.min(...transformedX), maxX = Math.max(...transformedX);
    const x = (number: number) => left + (transformX(number) - minX) / (maxX - minX || 1) * (width - left - right);
    const y = (number: number) => top + (max - number) / span * (height - top - bottom);
    const ticks = xValues.filter((_, index) => singlePeriod || index === 0 || index === xValues.length - 1 || index % 4 === 0);
    return <ExpandablePlot title={kind === 'amplitude' ? 'Black–Kipp response amplitude' : 'Black–Kipp phase delay'} showInspection><div className="min-w-0"><h4 className="text-sm font-bold mb-2">{kind === 'amplitude' ? 'Response amplitude (m, log scale)' : 'Phase delay (degrees)'}</h4>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full bg-[#111] rounded-lg" role="group" aria-label={`Black-Kipp ${kind} comparison`}>
        {[0, 1, 2, 3, 4].map((index) => { const yy = top + index * (height - top - bottom) / 4; const tick = max - index * span / 4; return <g key={index}><line x1={left} x2={width - right} y1={yy} y2={yy} stroke="#444" strokeDasharray="3 4" /><text x={left - 8} y={yy + 4} textAnchor="end" fill="#bbb" fontSize="10">{kind === 'amplitude' ? `10^${tick.toFixed(1)}` : tick.toFixed(0)}</text></g>; })}
        {ticks.map((tick) => <text key={tick} x={x(tick)} y={height - 25} textAnchor="middle" fill="#bbb" fontSize="9">{singlePeriod ? (Number.isInteger(tick) ? tick.toFixed(0) : tick.toFixed(1)) : tick < 100 ? tick.toFixed(1) : tick.toFixed(0)}</text>)}
        {groups.filter(group => !hiddenGroups.includes(group.id)).map((group) => {
          const analyticalPoints = group.pairs.map((pair) => `${x(singlePeriod ? pair.distanceMeters : pair.periodSeconds)},${y(value(pair, true))}`).join(' ');
          return <g key={group.id}><polyline fill="none" stroke={group.color} strokeWidth="2.2" points={analyticalPoints} />{group.pairs.map((pair) => { const cx = x(singlePeriod ? pair.distanceMeters : pair.periodSeconds), cy = y(value(pair, false)); return <g key={`${pair.testId}-${pair.observationWellId}`}><InspectablePoint cx={cx} cy={y(value(pair, true))} details={responseDetails(pair)}><circle cx={cx} cy={y(value(pair, true))} r="2" fill={group.color} /></InspectablePoint><InspectablePoint cx={cx} cy={cy} details={responseDetails(pair)}><polygon points={`${cx},${cy - 5} ${cx + 4.5},${cy + 4} ${cx - 4.5},${cy + 4}`} fill={group.color} /></InspectablePoint></g>; })}</g>;
        })}
        <line x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} stroke="#999" />
        <text x={(left + width - right) / 2} y={height - 7} textAnchor="middle" fill="#bbb" fontSize="10">{singlePeriod ? 'Pump-observer distance (m)' : 'Pumping period (s, log scale)'}</text>
      </svg>
    </div></ExpandablePlot>;
  };

  return <div className="bg-white border border-[#D6DADD] rounded-xl p-5 space-y-4"><div><h3 className="font-bold">Numerical vs Black–Kipp analytical response</h3><p className="text-xs text-[#6B7074]">Triangles: {config.gridNx}×{config.gridNy} finite-difference {config.gridNx === 300 && config.gridNy === 300 ? 'baseline' : 'model'} · Lines: analytical solution</p></div>
    <div className="grid lg:grid-cols-2 gap-5">{plot('amplitude')}{plot('phase')}</div>
    <div className="flex flex-wrap justify-center gap-4 text-[10px] text-[#4B4F52]">{groups.map((group) => <PlotLegendButton key={group.id} label={group.label} color={group.color} visible={!hiddenGroups.includes(group.id)} onToggle={() => setHiddenGroups(current => current.includes(group.id) ? current.filter(id => id !== group.id) : [...current, group.id])} />)}</div>
  </div>;
}

export const ResponsePlots: React.FC<Props> = (props) => {
  if (!props.pairs.length) return null;
  // Remount on scope changes so a pinned response cannot leak from another test.
  return <PlotInspection key={props.pairs.map(pair => `${pair.testId}-${pair.observationWellId}`).join('|')}>{props.config.testCase === 'black_kipp' ? <BlackKippPlots {...props} /> : <TomographyPlots pairs={props.pairs} />}</PlotInspection>;
};
