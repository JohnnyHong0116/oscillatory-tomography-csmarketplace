import React, { createContext, useContext, useState } from 'react';
import { AnalysisPair } from '../../types/aquifer';

export interface PlotDetails { id: string; heading: string; rows: [string, string][] }
export const formatPlotNumber = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? 'N/A' : value.toPrecision(7);

export function responseDetails(pair: AnalysisPair): PlotDetails {
  return {
    id: `${pair.testId}-${pair.observationWellId}`,
    heading: `${pair.testName}: ${pair.pumpingWellName} → ${pair.observationWellName}`,
    rows: [
      ['Period (s)', formatPlotNumber(pair.periodSeconds)], ['Distance (m)', formatPlotNumber(pair.distanceMeters)],
      ['Predicted amplitude (m)', formatPlotNumber(pair.predicted.amplitude)],
      ['Phase (°)', formatPlotNumber(pair.numericalPhaseDegrees ?? pair.predicted.phaseDegrees)],
      ['Real head (m)', formatPlotNumber(pair.predicted.real)], ['Imaginary head (m)', formatPlotNumber(pair.predicted.imag)],
      ...(pair.measured ? [['Measured real (m)', formatPlotNumber(pair.measured.real)], ['Measured imaginary (m)', formatPlotNumber(pair.measured.imag)]] as [string, string][] : []),
      ...(pair.residualAmplitude != null ? [['Residual amplitude (m)', formatPlotNumber(pair.residualAmplitude)]] as [string, string][] : []),
      ...(pair.analytical ? [['Analytical amplitude (m)', formatPlotNumber(pair.analytical.amplitude)], ['Analytical phase (°)', formatPlotNumber(pair.analytical.phaseDegrees)], ['Amplitude error (%)', formatPlotNumber((pair.amplitudeRelativeError ?? NaN) * 100)], ['Circular phase error (°)', formatPlotNumber(pair.phaseErrorDegrees)]] as [string, string][] : []),
    ],
  };
}

/** Pinned selections ignore incidental pointer movement; Escape or Clear releases them. */
export function usePlotInspection() {
  const [hovered, setHovered] = useState<PlotDetails | null>(null);
  const [pinned, setPinned] = useState<PlotDetails | null>(null);
  const clear = () => { setPinned(null); setHovered(null); };
  return { details: pinned ?? hovered, pinned: !!pinned, hover: setHovered,
    pin: (details: PlotDetails) => setPinned(current => current?.id === details.id ? null : details), clear };
}
type Inspection = ReturnType<typeof usePlotInspection>;
const InspectionContext = createContext<Inspection | null>(null);

/** Show the same selection inside an enlarged chart rather than behind its viewer. */
export function ContextInspectionPanel({ compact = false }: { compact?: boolean }) {
  const inspection = useContext(InspectionContext);
  return inspection ? <InspectionPanel inspection={inspection} compact={compact} /> : null;
}

export function PlotLegendButton({ label, color, visible, onToggle }: { label: string; color: string; visible: boolean; onToggle: () => void }) {
  const inspection = useContext(InspectionContext);
  return <button type="button" aria-label={`Toggle ${label}`} aria-pressed={visible}
    onClick={() => { inspection?.clear(); onToggle(); }}
    className={`flex items-center gap-1.5 rounded border border-slate-200 px-2 py-1 focus-ring ${visible ? '' : 'opacity-40 line-through'}`}>
    <i className="w-4 h-0.5" style={{ background: color }} />{label}
  </button>;
}

export function InspectionPanel({ inspection, compact = false }: { inspection: Inspection; compact?: boolean }) {
  const details = inspection.details;
  return <div className={`${compact ? '' : 'mt-3'} rounded-lg border border-slate-300 bg-slate-50 p-3 text-xs text-slate-900`}>
    {details ? <><div className="flex items-center justify-between gap-2"><strong>{details.heading}</strong><button type="button" onClick={inspection.clear} className="rounded border px-2 py-1 focus-ring">Clear selection</button></div>
      <p className="my-1 text-slate-600">{inspection.pinned ? 'Pinned · click another point to inspect it.' : 'Click to pin these values.'}</p>
      <dl className={`grid grid-cols-1 ${compact ? 'gap-y-3' : 'sm:grid-cols-2 gap-x-5 gap-y-1'}`}>{details.rows.map(([label, value]) => <div key={label} className={compact ? 'border-t border-slate-200 pt-2' : 'flex flex-wrap justify-between gap-2'}><dt className={compact ? 'text-slate-600' : ''}>{label}</dt><dd className={`font-mono ${compact ? 'mt-1 break-words' : ''}`}>{value}</dd></div>)}</dl></>
      : <p className="text-slate-600">Hover or focus a point to inspect values. Click or press Enter to pin; Escape clears.</p>}
  </div>;
}

export function PlotInspection({ children }: { children: React.ReactNode }) {
  const inspection = usePlotInspection();
  return <InspectionContext.Provider value={inspection}><div onKeyDown={event => { if (event.key === 'Escape') inspection.clear(); }}>{children}<InspectionPanel inspection={inspection} /></div></InspectionContext.Provider>;
}

/** Transparent hit targets make small scientific markers practical to use. */
export function InspectablePoint({ cx, cy, details, children }: { cx: number; cy: number; details: PlotDetails; children: React.ReactNode }) {
  const inspection = useContext(InspectionContext);
  const selected = inspection?.details?.id === details.id;
  return <g role="button" tabIndex={0} aria-label={`Inspect ${details.heading}`} aria-pressed={!!selected && !!inspection?.pinned}
    className="cursor-pointer outline-none" onMouseEnter={() => inspection?.hover(details)} onMouseLeave={() => inspection?.hover(null)}
    onFocus={() => inspection?.hover(details)} onBlur={() => inspection?.hover(null)} onClick={() => inspection?.pin(details)}
    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inspection?.pin(details); } }}>
    {selected && <circle cx={cx} cy={cy} r="8" fill="none" stroke="#F59E0B" strokeWidth="2" />}
    {children}<circle cx={cx} cy={cy} r="9" fill="transparent" />
  </g>;
}
