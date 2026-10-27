import React, { useState } from 'react';
import { AnalysisResult, ModelConfig, Well } from '../../types/aquifer';
import { phaseColor, signalRadius, signalValue } from '../../utils/signalMap';
import { ExpandablePlot } from './ExpandablePlot';
import { formatPlotNumber, InspectablePoint, PlotInspection } from './PlotInspection';
import { PlotProbe } from './PlotProbe';

/** One pumping test per map. Do not overlay different pumps/periods into a
 * fictitious experiment, interpolate point data, or invent a pumping response. */
export function SignalMap({
  config,
  result,
  scope,
}: {
  config: ModelConfig;
  result: AnalysisResult;
  scope: string;
}) {
  const available = config.tests.filter((t) => result.pairs.some((p) => p.testId === t.id));
  const [selectedId, setSelectedId] = useState(scope === 'all' ? available[0]?.id : scope);
  const [source, setSource] = useState<'predicted' | 'measured'>(
    result.pairs.some((p) => p.measured != null) ? 'measured' : 'predicted',
  );
  const [scale, setScale] = useState<'log' | 'area'>('log');
  const tests = scope === 'all' ? available : available.filter((t) => t.id === scope);
  const test = tests.find((t) => t.id === selectedId) ?? tests[0];
  if (!test) return null;
  const index = tests.indexOf(test);
  const pairs = result.pairs.filter((p) => p.testId === test.id);
  const hasObservations = result.pairs.some((p) => p.measured !== null);
  const synthetic = result.analysisMode === 'synthetic_demo' || result.observationSource === 'synthetic';
  const sourceLabel =
    source === 'predicted' ? 'Predicted' : synthetic ? 'Synthetic observations' : 'Imported measurements';
  // Fixed scale across all tests for the selected source permits honest test comparison.
  const amplitudes = result.pairs
    .map((p) => signalValue(p, source)?.amplitude)
    .filter((v): v is number => v !== undefined);
  const w = 640,
    h = 410,
    pad = 52;
  const factor = Math.min(
    (w - 2 * pad) / (config.maxX - config.minX),
    (h - 2 * pad) / (config.maxY - config.minY),
  );
  const plotW = factor * (config.maxX - config.minX),
    plotH = factor * (config.maxY - config.minY);
  const left = (w - plotW) / 2,
    top = (h - plotH) / 2;
  const sx = (x: number) => left + (x - config.minX) * factor;
  const sy = (y: number) => top + (config.maxY - y) * factor;
  const mapDetails = (well: Well) => {
    const pump=well.id===test.pumpingWellId, pair=pairs.find(p=>p.observationWellId===well.id), value=pair?signalValue(pair,source):null;
    return { id:`${test.id}-${well.id}-${source}`, heading:`${test.name} · ${well.name}${pump?' (pump)':''}`, rows:[
      ...(value ? [['Amplitude (m)',formatPlotNumber(value.amplitude)],['Phasor phase (°)',value.phase===null?'Undefined (zero amplitude)':formatPlotNumber(value.phase)]] : [['Head response',pump?'Not sampled at pumping well':'No response for selected source']]),
      ['Role',pump?'Pumping well':pair?'Observation well':'Not used in this test'],['Coordinates (m)',`${well.x}, ${well.y}`],['Period (s)',String(test.pumpingPeriod??config.pumpingPeriod)],['Peak Q (m³/s)',formatPlotNumber(test.pumpingRate??config.pumpingRate)],['Data',sourceLabel],
      ...(value ? [['Real head (m)',formatPlotNumber(value.real)],['Imaginary head (m)',formatPlotNumber(value.imag)]]:[]),
    ] as [string,string][] };
  };
  return (
    <section
      aria-label="Spatial response map"
      className="studio-panel space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">Well signal map</h3>
          <p className="text-xs text-[#4B4F52]">
            {sourceLabel} · complex head signals · position in meters
          </p>
        </div>
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
          <button
            aria-label="Previous map test"
            disabled={index === 0}
            onClick={() => setSelectedId(tests[index - 1].id)}
            className="rounded border px-3 py-2 disabled:opacity-30 focus-ring"
          >
            ←
          </button>
          <label className="min-w-0 flex-1 text-xs">
            <span className="sr-only">Map pumping test</span>
            <select
              aria-label="Map pumping test"
              value={test.id}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full max-w-56 rounded border bg-white p-2 focus-ring"
            >
              {tests.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · P = {t.pumpingPeriod ?? config.pumpingPeriod} s
                </option>
              ))}
            </select>
          </label>
          <button
            aria-label="Next map test"
            disabled={index === tests.length - 1}
            onClick={() => setSelectedId(tests[index + 1].id)}
            className="rounded border px-3 py-2 disabled:opacity-30 focus-ring"
          >
            →
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-xs">
        <label className="block w-full min-w-0 sm:w-auto">
          Data source{' '}
          <select
            aria-label="Map data source"
            value={source}
            onChange={(e) => setSource(e.target.value as typeof source)}
            className="mt-1 block w-full max-w-full rounded border bg-white p-2 focus-ring"
          >
            <option value="predicted">Predicted heads</option>
            {hasObservations && (
              <option value="measured">
                {synthetic ? 'Synthetic observations' : 'Imported measurements'}
              </option>
            )}
          </select>
        </label>
        <label className="block w-full min-w-0 sm:w-auto">
          Amplitude size{' '}
          <select
            aria-label="Map amplitude scale"
            value={scale}
            onChange={(e) => setScale(e.target.value as typeof scale)}
            className="mt-1 block w-full max-w-full rounded border bg-white p-2 focus-ring"
          >
            <option value="log">Log-scaled radius</option>
            <option value="area">Linear area (minimum marker size)</option>
          </select>
        </label>
      </div>
      <PlotInspection key={`${test.id}-${source}-${scale}`}>
        <ExpandablePlot title="Well signal map" showInspection>
          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="w-full rounded-lg bg-[#121212]"
            role="group"
            aria-label={`${sourceLabel} amplitude and phase map for ${test.name}`}
          >
            <rect x={left} y={top} width={plotW} height={plotH} fill="#1d1d1d" stroke="#6B7074" />
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <g key={t}>
                <line x1={left + t * plotW} x2={left + t * plotW} y1={top} y2={top + plotH} stroke="#333" />
                <line x1={left} x2={left + plotW} y1={top + t * plotH} y2={top + t * plotH} stroke="#333" />
                <text x={left + t * plotW} y={top + plotH + 18} textAnchor="middle" fill="#ccc" fontSize="10">
                  {Number((config.minX + t * (config.maxX - config.minX)).toPrecision(5))}
                </text>
                <text x={left - 8} y={top + t * plotH + 4} textAnchor="end" fill="#ccc" fontSize="10">
                  {Number((config.maxY - t * (config.maxY - config.minY)).toPrecision(5))}
                </text>
              </g>
            ))}
            <text x={w / 2} y={h - 7} fill="#ccc" textAnchor="middle" fontSize="11">
              x (m)
            </text>
            <text
              x="16"
              y={h / 2}
              fill="#ccc"
              textAnchor="middle"
              fontSize="11"
              transform={`rotate(-90 16 ${h / 2})`}
            >
              y (m)
            </text>
            {config.wells.map((well) => {
              const pump = well.id === test.pumpingWellId;
              const pair = pairs.find((p) => p.observationWellId === well.id);
              const value = pair ? signalValue(pair, source) : null;
              const x = sx(well.x),
                y = sy(well.y);
              const radius = value ? signalRadius(value.amplitude, amplitudes, scale) : 4;
              const details = mapDetails(well);
              return (
                <InspectablePoint key={well.id} cx={x} cy={y} details={details}>
                  <title>{`${details.heading}${value ? ` · ${value.amplitude.toExponential(3)} m · ${value.phase?.toFixed(2) ?? 'undefined'}°` : ''}`}</title>
                  {pump ? (
                    <polygon
                      points={`${x},${y - 10} ${x + 9},${y + 8} ${x - 9},${y + 8}`}
                      fill="#C5050C"
                      stroke="white"
                      strokeWidth="1.5"
                    />
                  ) : (
                    <circle
                      cx={x}
                      cy={y}
                      r={radius}
                      fill={value ? phaseColor(value.phase) : '#64748B'}
                      fillOpacity={value ? 0.85 : 0.3}
                      stroke="white"
                      strokeWidth={value ? 1.5 : 0.6}
                    />
                  )}
                  <text
                    x={x + (pump ? 13 : radius + 4)}
                    y={y - 5}
                    fill="white"
                    fontSize="11"
                    stroke="#121212"
                    strokeWidth="3"
                    paintOrder="stroke"
                    pointerEvents="none"
                  >
                    {well.name}
                  </text>
                </InspectablePoint>
              );
            })}
            <PlotProbe left={left} top={top} width={plotW} height={plotH} points={config.wells.map(well=>({cx:sx(well.x),cy:sy(well.y),details:mapDetails(well)}))} />
          </svg>
        </ExpandablePlot>
      </PlotInspection>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#4B4F52]">
        <span>
          <span className="text-[#C5050C]">▲</span> Pump (not response-scaled)
        </span>
        <span>● Observer · size = amplitude</span>
        <span>Small gray = unused / unavailable</span>
        <span className="inline-flex items-center gap-2">
          Phase <span>−180°</span>
          <i
            className="inline-block h-2 w-24 rounded"
            style={{
              background:
                'linear-gradient(to right, hsl(0 65% 55%), hsl(90 65% 55%), hsl(180 65% 55%), hsl(270 65% 55%), hsl(360 65% 55%))',
            }}
          />
          <span>+180°</span>
        </span>
      </div>
      <p className="text-[11px] text-[#6B7074]">
        Phase is arg(real + i·imag), −180° to +180°, not the separate Black–Kipp phase-delay convention. Size
        scale is shared across tests:{' '}
        {amplitudes.length
          ? `${Math.min(...amplitudes).toExponential(2)}–${Math.max(...amplitudes).toExponential(2)} m`
          : 'no available values'}
        ;{' '}
        {scale === 'log'
          ? 'logarithmic radius, not area-proportional'
          : 'area scales linearly above a minimum visible size'}
        . No spatial interpolation.
      </p>
    </section>
  );
}
