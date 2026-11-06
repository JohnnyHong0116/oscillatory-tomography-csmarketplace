import React, { useId, useState } from 'react';
import { AnalysisResult, ModelConfig, Well } from '../../types/aquifer';
import { matchesScope, periodGroups } from '../../utils/periodGroups';
import { spatialCameraProjection } from '../../utils/spatial';
import { amplitudeLegend, phaseColor, signalRadius, signalValue } from '../../utils/signalMap';
import {
  delayColor,
  columnLabel,
  portColumns,
  referencePlanes,
  signalDelays,
  SignalColor,
  SignalSource,
} from '../../utils/spatialSignals';
import { ExpandablePlot } from './ExpandablePlot';
import {
  ContextInspectionPanel,
  formatPlotNumber,
  InspectablePoint,
  PlotDetails,
  PlotInspection,
} from './PlotInspection';
import { PlotProbe } from './PlotProbe';
import { useSpatialCamera } from './useSpatialCamera';
import { SpatialViewport } from './SpatialViewport';
import { SpatialBackdrop } from './SpatialBackdrop';

const PAPER =
  'https://www.boisestate.edu/wp-content/uploads/sites/290/2020/01/Cardiff-et-al-2019-OHT-field-scale-online-gwat.12960.pdf#page=7';
const short = (n: number) => Number(n.toPrecision(4)).toString();

/** Figure-4-inspired spatial diagnostics, using only configured ports and the
 * selected test's actual phasors. Guides/planes are context, never a synthetic
 * continuous hydraulic surface or a new boundary/solver assumption. */
export function SpatialSignalMap({
  config: c,
  result,
  scope,
}: {
  config: ModelConfig;
  result: AnalysisResult;
  scope: string;
}) {
  const tests = c.tests.filter(
    (t) => matchesScope(c, scope, t.id) && result.pairs.some((p) => p.testId === t.id),
  );
  const [testId, setTestId] = useState(tests[0]?.id ?? '');
  const [source, setSource] = useState<SignalSource>(
    result.pairs.some((p) => p.measured != null) ? 'measured' : 'predicted',
  );
  const [scale, setScale] = useState<'log' | 'area'>('area');
  const [metric, setMetric] = useState<SignalColor>('relative_delay');
  const [reference, setReference] = useState('auto');
  const controller = useSpatialCamera(720,650,325,265);
  const {yaw,pitch} = controller.camera;
  const [labels, setLabels] = useState(c.wells.length <= 12),
    [guides, setGuides] = useState(true),
    [planes, setPlanes] = useState(true);
  const gradient = `signal-${useId().replace(/[^a-z0-9]/gi, '')}`;
  const test = tests.find((t) => t.id === testId) ?? tests[0];
  if (!test) return null;
  const pairs = result.pairs.filter((p) => p.testId === test.id),
    index = tests.indexOf(test);
  const period = test.pumpingPeriod ?? c.pumpingPeriod;
  const delays = signalDelays(pairs, source, reference, period);
  const referenceName = c.wells.find((w) => w.id === delays.referenceId)?.name ?? 'unavailable';
  const delayValues = [...delays.values.values()].filter((v): v is number => v !== null);
  const colorMax = metric === 'phase' ? 180 : Math.max(0, ...delayValues) || period;
  const amplitudeValues = result.pairs
    .map((p) => signalValue(p, source)?.amplitude)
    .filter((v): v is number => v !== undefined);
  const columns = portColumns(c.wells),
    annotations = referencePlanes(c);
  const synthetic = result.analysisMode === 'synthetic_demo' || result.observationSource === 'synthetic';
  const sourceLabel =
    source === 'predicted'
      ? result.syntheticTruth ? 'Predicted · synthetic field' : 'Predicted heads'
      : synthetic
        ? 'Synthetic observations'
        : 'Imported measurements';
  const pump = c.wells.find((w) => w.id === test.pumpingWellId);
  const {project} = spatialCameraProjection(c,controller.camera,560,450,325,265);
  const zmin = c.minZ ?? -40,
    zmax = c.maxZ ?? 40;
  const floor = [c.minX, c.maxX].flatMap((x) => [c.minY, c.maxY].map((y) => ({ x, y, z: zmin })));
  const nearest = [...floor].sort((a, b) => project(a.x, a.y, a.z).depth - project(b.x, b.y, b.z).depth)[0];
  // Keep the elevation ruler on the left silhouette, not through the pump and
  // central receiver columns as happens when all axes share the front corner.
  const zEdge = [...floor].sort((a, b) => project(a.x, a.y, a.z).x - project(b.x, b.y, b.z).x)[0];
  const farX = nearest.x === c.minX ? c.maxX : c.minX,
    farY = nearest.y === c.minY ? c.maxY : c.minY;
  const corners = [...floor, ...floor.map((p) => ({ ...p, z: zmax }))];
  const coordinate = (w: Well) => `${short(w.x)}, ${short(w.y)}, ${short(w.z ?? 0)}`;
  const points = (values: number[][]) =>
    values
      .map((p) => {
        const v = project(p[0], p[1], p[2]);
        return `${v.x},${v.y}`;
      })
      .join(' ');
  const details = (well: Well): PlotDetails => {
    const pair = pairs.find((p) => p.observationWellId === well.id),
      value = pair ? signalValue(pair, source) : null,
      isPump = well.id === test.pumpingWellId;
    return {
      id: `${test.id}-${well.id}-${source}-${metric}-${delays.referenceId}`,
      heading: `${test.name} · ${well.name}${isPump ? ' (pump)' : ''}`,
      rows: [
        [
          'Amplitude (m)',
          value
            ? formatPlotNumber(value.amplitude)
            : isPump
              ? 'Not sampled at source'
              : 'Unavailable for selected source',
        ],
        ['Relative phase delay (s)', formatPlotNumber(delays.values.get(well.id))],
        ['Phase reference', `${referenceName} · wrapped to one cycle`],
        ['X / Y / Z (m)', coordinate(well)],
        ['Role', isPump ? 'Pumping port' : pair ? 'Observation port' : 'Not used in selected test'],
        ['Raw phasor phase (°)', formatPlotNumber(value?.phase)],
        ['Period (s)', String(period)],
        ['Peak Q (m³/s)', formatPlotNumber(test.pumpingRate ?? c.pumpingRate)],
        ['Pump–observer distance (m)', pair ? formatPlotNumber(pair.distanceMeters) : '—'],
        ['Data', sourceLabel],
        ...(value
          ? [
              ['Real head (m)', formatPlotNumber(value.real)],
              ['Imaginary head (m)', formatPlotNumber(value.imag)],
            ]
          : []),
      ] as [string, string][],
    };
  };
  const tickLine = (a: number[], b: number[], key: string, color = '#D7E1EB') => {
    const p = project(a[0], a[1], a[2]),
      q = project(b[0], b[1], b[2]);
    return <line key={key} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={color} strokeWidth="1" />;
  };
  const axes = [
    {
      label: 'X distance (m)',
      start: [c.minX, nearest.y, zmin],
      end: [c.maxX, nearest.y, zmin],
      lo: c.minX,
      hi: c.maxX,
    },
    {
      label: 'Y distance (m)',
      start: [nearest.x, c.minY, zmin],
      end: [nearest.x, c.maxY, zmin],
      lo: c.minY,
      hi: c.maxY,
    },
    {
      label: `Z elevation (m${c.siteContext?.verticalDatum ? `, ${c.siteContext.verticalDatum.length > 24 ? `${c.siteContext.verticalDatum.slice(0, 24)}…` : c.siteContext.verticalDatum}` : ', local datum'})`,
      start: [zEdge.x, zEdge.y, zmin],
      end: [zEdge.x, zEdge.y, zmax],
      lo: zmin,
      hi: zmax,
    },
  ];
  return (
    <section className="studio-panel space-y-4" aria-label="Spatial response map">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-base">3D well signal map</h3>
          <p className="mt-1 text-xs text-slate-600">
            One pumping test · response amplitude and phase at physical ports
          </p>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <button
            aria-label="Previous map test"
            disabled={index === 0}
            onClick={() => {
              setTestId(tests[index - 1].id);
              setReference('auto');
            }}
            className="min-h-11 rounded-lg border px-3 disabled:opacity-30 focus-ring"
          >
            ←
          </button>
          <select
            aria-label="Map pumping test"
            value={test.id}
            onChange={(e) => {
              setTestId(e.target.value);
              setReference('auto');
            }}
            className="min-w-0 max-w-64 min-h-11 rounded-lg border bg-white p-2 text-sm focus-ring"
          >
            {periodGroups(c).map((g) => (
              <optgroup key={g.period} label={`P = ${g.period} s`}>
                {g.tests
                  .filter((t) => tests.some((v) => v.id === t.id))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <button
            aria-label="Next map test"
            disabled={index === tests.length - 1}
            onClick={() => {
              setTestId(tests[index + 1].id);
              setReference('auto');
            }}
            className="min-h-11 rounded-lg border px-3 disabled:opacity-30 focus-ring"
          >
            →
          </button>
        </div>
      </header>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 text-xs">
        <label>
          Data source
          <select
            aria-label="Map data source"
            value={source}
            onChange={(e) => {
              setSource(e.target.value as SignalSource);
              setReference('auto');
            }}
            className="mt-1 min-h-11 block w-full rounded-lg border bg-white p-2 focus-ring"
          >
            <option value="predicted">Predicted heads</option>
            {result.pairs.some((p) => p.measured != null) && (
              <option value="measured">
                {synthetic ? 'Synthetic observations' : 'Imported measurements'}
              </option>
            )}
          </select>
        </label>
        <label>
          Circle size
          <select
            aria-label="Map amplitude scale"
            value={scale}
            onChange={(e) => setScale(e.target.value as 'log' | 'area')}
            className="mt-1 min-h-11 block w-full rounded-lg border bg-white p-2 focus-ring"
          >
            <option value="area">Linear area + minimum size</option>
            <option value="log">Log-scaled radius</option>
          </select>
        </label>
        <label>
          Color represents
          <select
            aria-label="Map color metric"
            value={metric}
            onChange={(e) => setMetric(e.target.value as SignalColor)}
            className="mt-1 min-h-11 block w-full rounded-lg border bg-white p-2 focus-ring"
          >
            <option value="relative_delay">Relative phase delay (s)</option>
            <option value="phase">Raw phasor phase (°)</option>
          </select>
        </label>
        <label>
          Phase reference
          <select
            aria-label="Map phase reference"
            value={reference}
            disabled={metric === 'phase'}
            onChange={(e) => setReference(e.target.value)}
            className="mt-1 min-h-11 block w-full rounded-lg border bg-white p-2 disabled:opacity-40 focus-ring"
          >
            <option value="auto">Leading phase · this test</option>
            {pairs
              .filter((p) => signalValue(p, source)?.phase != null)
              .map((p) => (
                <option key={p.observationWellId} value={p.observationWellId}>
                  {p.observationWellName}
                </option>
              ))}
          </select>
        </label>
      </div>
      <PlotInspection key={`${test.id}-${source}-${metric}-${reference}`}>
        <ExpandablePlot
          title="3D well signal map"
          inspectionPanel={(expanded) =>
            expanded ? (
              <section className="space-y-3 text-sm">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="font-semibold">Test context</h3>
                  <dl className="mt-3 space-y-2 text-xs">
                    {[
                      ['Test', test.name],
                      ['Data', sourceLabel],
                      ['Pump', pump?.name ?? '—'],
                      ['Pump X / Y / Z (m)', pump ? coordinate(pump) : '—'],
                      ['Period (s)', String(period)],
                      ['Peak Q (m³/s)', formatPlotNumber(test.pumpingRate ?? c.pumpingRate)],
                      [
                        'Color',
                        metric === 'phase'
                          ? 'Raw phasor phase (°)'
                          : `Relative phase delay (s) · ${referenceName}`,
                      ],
                      ['Vertical datum', c.siteContext?.verticalDatum || 'Local datum'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex flex-wrap justify-between gap-2">
                        <dt className="text-slate-500">{label}</dt>
                        <dd className="max-w-full font-medium break-words">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <ContextInspectionPanel compact />
              </section>
            ) : null
          }
        >
          <div className="spatial-map-options">
            <span>Display</span>
            <label><input type="checkbox" checked={guides} onChange={e=>setGuides(e.target.checked)}/> Well traces</label>
            <label><input type="checkbox" checked={labels} onChange={e=>setLabels(e.target.checked)}/> Port labels</label>
            {annotations.length>0&&<label><input type="checkbox" checked={planes} onChange={e=>setPlanes(e.target.checked)}/> Site planes</label>}
          </div>
          <SpatialViewport controller={controller} label="3D well signal map">
          <svg
            viewBox="0 0 720 650"
            data-spatial-scene
            role="group"
            aria-label={`${sourceLabel} amplitude and ${metric === 'phase' ? 'raw phase' : 'relative phase delay'} map for ${test.name}`}
            className="w-full rounded-b-xl border bg-white"
          >
            <defs>
              <linearGradient id={gradient} x1="0" y1="1" x2="0" y2="0">
                {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                  <stop
                    key={f}
                    offset={`${100 * f}%`}
                    stopColor={metric === 'phase' ? phaseColor(-180 + f * 360) : delayColor(f, 1)}
                  />
                ))}
              </linearGradient>
              <clipPath id={`${gradient}-clip`}>
                <rect x="18" y="74" width="594" height="440" />
              </clipPath>
            </defs>
            <text x="28" y="29" fontSize="18" fontWeight="700" fill="#18222D">
              {test.name.length > 32 ? `${test.name.slice(0, 32)}…` : test.name} · {sourceLabel}
            </text>
            <text x="28" y="54" fontSize="15" fill="#475569">
              P = {short(period)} s · Qmax = {(test.pumpingRate ?? c.pumpingRate).toExponential(2)} m³/s ·{' '}
              {pairs.filter((p) => signalValue(p, source)).length}/{pairs.length} responses
            </text>
            <g clipPath={`url(#${gradient}-clip)`}>
              <SpatialBackdrop config={c} camera={controller.camera} project={project} dark={false}/>
              {corners.flatMap((p, i) =>
                corners
                  .filter(
                    (q, j) => j > i && Number(q.x !== p.x) + Number(q.y !== p.y) + Number(q.z !== p.z) === 1,
                  )
                  .map((q, j) => tickLine([p.x, p.y, p.z], [q.x, q.y, q.z], `edge-${i}-${j}`, '#94A3B8')),
              )}
              {planes &&
                annotations.map((plane) => (
                  <g key={plane.label}>
                    <polygon
                      points={points([
                        [c.minX, c.minY, plane.z],
                        [c.maxX, c.minY, plane.z],
                        [c.maxX, c.maxY, plane.z],
                        [c.minX, c.maxY, plane.z],
                      ])}
                      fill={plane.color}
                      fillOpacity=".08"
                      stroke={plane.color}
                      strokeDasharray="5 4"
                    />
                    <text
                      x={Math.min(592, project(farX, farY, plane.z).x - 6)}
                      textAnchor="end"
                      y={project(farX, farY, plane.z).y - 8}
                      fill={plane.color}
                      fontSize="14"
                    >
                      {plane.label} (entered)
                    </text>
                  </g>
                ))}
              {guides &&
                columns.map((column, i) => {
                  const a = project(column.x, column.y, zmin),
                    b = project(column.x, column.y, zmax),
                    low = project(column.x, column.y, column.ports[0].z ?? 0),
                    high = project(column.x, column.y, column.ports[column.ports.length - 1].z ?? 0);
                  return (
                    <g key={i}>
                      <line
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke="#8293A5"
                        strokeWidth="1.2"
                        strokeDasharray="4 4"
                      />
                      <line x1={low.x} y1={low.y} x2={high.x} y2={high.y} stroke="#475569" strokeWidth="2" />
                      {column.ports.length > 1 && (
                        <circle cx={b.x} cy={b.y} r="3" fill="white" stroke="#475569" />
                      )}
                      {columns.length <= 12 && (
                        <text
                          x={b.x}
                          y={b.y - 10}
                          textAnchor="middle"
                          fontSize="15"
                          fill="#334155"
                          stroke="white"
                          strokeWidth="3"
                          paintOrder="stroke"
                        >
                          <title>{`XY column at ${column.x}, ${column.y} m; ${column.ports.map((p) => p.name).join(', ')}`}</title>
                          {columnLabel(column.ports)}
                        </text>
                      )}
                    </g>
                  );
                })}
              {[...c.wells]
                .sort((a, b) => project(b.x, b.y, b.z ?? 0).depth - project(a.x, a.y, a.z ?? 0).depth)
                .map((w) => {
                  const p = project(w.x, w.y, w.z ?? 0),
                    pair = pairs.find((p) => p.observationWellId === w.id),
                    value = pair ? signalValue(pair, source) : null,
                    isPump = w.id === test.pumpingWellId,
                    r = value ? signalRadius(value.amplitude, amplitudeValues, scale) : 4;
                  const mark = (
                    <>
                      <title>{`${w.name} · (${coordinate(w)}) m${value ? ` · amplitude ${value.amplitude.toExponential(4)} m` : ''}`}</title>
                      {isPump ? (
                        <>
                          <rect
                            x={p.x - 9}
                            y={p.y - 9}
                            width="18"
                            height="18"
                            fill="#111827"
                            stroke="white"
                            strokeWidth="2"
                          />
                          <rect
                            x={p.x - 12}
                            y={p.y - 12}
                            width="24"
                            height="24"
                            fill="none"
                            stroke="#C5050C"
                            strokeWidth="1.5"
                          />
                        </>
                      ) : (
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={r}
                          fill={
                            value
                              ? metric === 'phase'
                                ? phaseColor(value.phase)
                                : delayColor(delays.values.get(w.id) ?? null, colorMax)
                              : '#CBD5E1'
                          }
                          opacity={value ? 1 : 0.45}
                          stroke={value ? '#334155' : '#94A3B8'}
                          strokeWidth="1.2"
                        />
                      )}
                      {(labels || isPump) && (
                        <text
                          x={p.x + (isPump ? 16 : r + 5)}
                          y={p.y - 5}
                          fill="#18222D"
                          fontSize="16"
                          fontWeight={isPump ? '700' : '500'}
                          paintOrder="stroke"
                          stroke="white"
                          strokeWidth="3"
                          pointerEvents="none"
                        >
                          {w.name}
                          {isPump ? ' · pump' : ''}
                        </text>
                      )}
                    </>
                  );
                  return (
                    <InspectablePoint key={w.id} cx={p.x} cy={p.y} details={details(w)}>
                      {mark}
                    </InspectablePoint>
                  );
                })}
            </g>
            {axes.map((axis, i) => {
              const a = project(...(axis.start as [number, number, number])),
                b = project(...(axis.end as [number, number, number])),
                length = Math.hypot(b.x - a.x, b.y - a.y);
              if (length < 25) return null;
              let nx = -(b.y - a.y) / length,
                ny = (b.x - a.x) / length;
              const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
              if (nx * (mid.x - 325) + ny * (mid.y - 265) < 0) {
                nx = -nx;
                ny = -ny;
              }
              if (i === 2) {
                nx = -1;
                ny = 0;
              }
              // Keep captions parallel to their rulers, outside the tick labels.
              // A horizontal caption on an oblique Y ruler crosses its own ticks.
              let captionAngle = i === 2 ? -90 : Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
              if (captionAngle > 90) captionAngle -= 180;
              if (captionAngle < -90) captionAngle += 180;
              const captionOffset = i === 2 ? 49 : 48;
              return (
                <g key={axis.label}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#475569" strokeWidth="1.6" />
                  {[0, 0.25, 0.5, 0.75, 1]
                    .filter((t) => i !== 1 || t !== (nearest.y === c.minY ? 0 : 1))
                    .map((t) => {
                      const x = a.x + t * (b.x - a.x),
                        y = a.y + t * (b.y - a.y);
                      return (
                        <g key={t}>
                          <line x1={x} y1={y} x2={x + nx * 5} y2={y + ny * 5} stroke="#475569" />
                          <text
                            x={x + nx * 15}
                            y={y + ny * 15 + 5}
                            textAnchor={nx > 0.4 ? 'start' : nx < -0.4 ? 'end' : 'middle'}
                            fill="#475569"
                            fontSize="14"
                          >
                            {short(axis.lo + t * (axis.hi - axis.lo))}
                          </text>
                        </g>
                      );
                    })}
                  <text
                    x={mid.x + nx * captionOffset}
                    y={mid.y + ny * captionOffset}
                    textAnchor="middle"
                    fill="#334155"
                    fontSize="16"
                    transform={`rotate(${captionAngle} ${mid.x + nx * captionOffset} ${mid.y + ny * captionOffset})`}
                  >
                    {axis.label}
                  </text>
                </g>
              );
            })}
            <text x="612" y="280" fontSize="15" fill="#334155">
              {metric === 'phase' ? 'Phase (°)' : 'Delay (s)'}
            </text>
            <rect x="626" y="300" width="19" height="200" fill={`url(#${gradient})`} stroke="#CBD5E1" />
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <g key={f}>
                <line x1="645" y1={500 - f * 200} x2="650" y2={500 - f * 200} stroke="#64748B" />
                <text x="655" y={505 - f * 200} fontSize="14" fill="#475569">
                  {short(metric === 'phase' ? -180 + 360 * f : colorMax * f)}
                </text>
              </g>
            ))}
            <text x="28" y="544" fill="#334155" fontSize="15">
              Amplitude (m) · {scale === 'log' ? 'log radius' : 'linear area + minimum marker'}
            </text>
            {amplitudeLegend(amplitudeValues, scale).map(({ value, radius }, i, entries) => {
              const x = 70 + (i * 350) / Math.max(1, entries.length - 1),
                [mantissa, exponent] = value.toExponential(1).split('e');
              return (
                <g key={value}>
                  <circle cx={x} cy="573" r={radius} fill="#94A3B8" stroke="#475569" />
                  <text x={x} y="609" textAnchor="middle" fontSize="14" fill="#475569">
                    {Number(mantissa) === 1 ? '10' : `${mantissa} × 10`}
                    <tspan baselineShift="super" fontSize="10">
                      {Number(exponent)}
                    </tspan>
                  </text>
                </g>
              );
            })}
            <rect x="492" y="550" width="14" height="14" fill="#111827" />
            <text x="516" y="563" fill="#334155" fontSize="14">
              Pumping port
            </text>
            <circle cx="499" cy="590" r="7" fill="#5EC962" stroke="#475569" />
            <text x="516" y="594" fill="#334155" fontSize="14">
              Observation port
            </text>
            <line x1="492" x2="506" y1="616" y2="616" stroke="#8293A5" strokeDasharray="3 3" />
            <text x="516" y="620" fill="#334155" fontSize="14">
              XY column guide
            </text>
            {(
              <PlotProbe
                dark={false}
                left={24}
                top={78}
                width={578}
                height={430}
                points={c.wells.map((w) => {
                  const p = project(w.x, w.y, w.z ?? 0);
                  return { cx: p.x, cy: p.y, details: details(w) };
                })}
              />
            )}
          </svg>
          </SpatialViewport>
        </ExpandablePlot>
      </PlotInspection>
      <div className="grid gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2">
        <p>
          <strong className="text-slate-800">Pump:</strong> {pump?.name} · ({pump ? coordinate(pump) : '—'})
          m. Z positive upward; {c.siteContext?.verticalDatum || 'local datum'}.
        </p>
        <p>
          <strong className="text-slate-800">Color:</strong>{' '}
          {metric === 'phase'
            ? 'raw arg(Φ), −180°…180°'
            : `relative to ${referenceName}; wrapped within P = ${short(period)} s`}
          . Marker-size scale is shared across tests for this data source.
        </p>
      </div>
      <details className="text-xs text-slate-600">
        <summary className="w-fit cursor-pointer rounded focus-ring">
          Interpretation & paper reference
        </summary>
        <div className="mt-2 space-y-2 leading-5">
          <p>
            Based on{' '}
            <a href={PAPER} target="_blank" rel="noreferrer" className="underline">
              Cardiff et al., Figure 4
            </a>
            : signal magnitude at each port and phase differences for one pumping test. Auto reference chooses
            the leading phase on the smallest circular arc; this is a phase reference, not an independently
            measured first arrival. Relative delay is modulo one period and cannot establish absolute travel
            time. Delay colors rescale per test; use numerical delays, rather than color alone, when comparing
            tests.
          </p>
          <p>
            Vertical guides group exact X/Y coordinates; their dashed extensions span the model for
            orientation and do not assert casing, screened intervals or surface elevations. Optional
            ground/water planes are shown only if entered, within the domain; they are display context and do
            not change boundary physics. No values are interpolated between ports. Zero amplitude has
            undefined phase; gray marks can indicate missing/unused responses.
          </p>
        </div>
      </details>
    </section>
  );
}
