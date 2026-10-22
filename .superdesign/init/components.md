# Shared components
React 19, Parcel 2, Tailwind 4, Lucide icons; custom semantic controls.
## web/src/components/steps/PlotInspection.tsx

```tsx
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

```

## web/src/components/steps/ExpandablePlot.tsx

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import { ContextInspectionPanel } from './PlotInspection';

/** Enlarge the live chart in place: no remount, duplicated data, or lost selection. */
export function ExpandablePlot({ title, children, square = false, showInspection = false, inspectionPanel }: {
  title: string; children: React.ReactNode; square?: boolean; showInspection?: boolean;
  inspectionPanel?: (expanded: boolean) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const [inlineHeight, setInlineHeight] = useState<number>();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!expanded || !root.current) return;
    // Make everything outside the viewer inert, including controls in the same card.
    const siblings: { element: HTMLElement; inert: boolean }[] = [];
    let branch: HTMLElement = root.current;
    while (branch.parentElement) {
      for (const sibling of Array.from(branch.parentElement.children)) {
        if (sibling !== branch && sibling instanceof HTMLElement) {
          siblings.push({ element: sibling, inert: sibling.inert }); sibling.inert = true;
        }
      }
      branch = branch.parentElement;
      if (branch === document.body) break;
    }
    const scroller = root.current.closest('main');
    const oldOverflow = scroller?.style.overflow;
    if (scroller) scroller.style.overflow = 'hidden';
    close.current?.focus({ preventScroll: true });
    return () => {
      siblings.forEach(({ element, inert }) => { element.inert = inert; });
      if (scroller) scroller.style.overflow = oldOverflow ?? '';
      trigger.current?.focus({ preventScroll: true });
    };
  }, [expanded]);
  return <div className="group relative min-w-0" style={expanded ? { height: inlineHeight } : undefined}>
  <div ref={root} role={expanded ? 'dialog' : undefined} aria-modal={expanded ? true : undefined}
    aria-label={expanded ? `${title} enlarged plot` : undefined}
    className={expanded ? 'fixed inset-0 z-[100] flex flex-col bg-slate-100 text-slate-900' : 'group relative min-w-0'}
    onKeyDownCapture={event => {
      // Escape closes the viewer without clearing the chart's existing pinned selection.
      if (expanded && event.key === 'Escape') { event.stopPropagation(); setExpanded(false); }
    }}
    onKeyDown={event => {
      if (!expanded) return;
      if (event.key === 'Tab') {
        const targets = Array.from(root.current!.querySelectorAll<HTMLElement>('button, [tabindex="0"], summary, a[href]'))
          .filter(element => !element.hasAttribute('disabled') && element.getClientRects().length > 0);
        const first = targets[0], last = targets[targets.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
    {expanded && <header className="flex shrink-0 items-center justify-between gap-4 border-b bg-white px-5 py-3 shadow-sm">
      <div><h2 className="text-base font-bold">{title}</h2><p className="text-xs text-slate-500">Enlarged view · hover or click to inspect</p></div>
      <button ref={close} type="button" onClick={() => setExpanded(false)} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-slate-100 focus-ring" aria-label="Close enlarged plot"><X size={18} /> Close</button>
    </header>}
    <div className={expanded ? 'min-h-0 flex-1 overflow-auto p-4 sm:p-6' : ''}>
      <div className={expanded ? 'mx-auto grid w-full max-w-[1800px] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]' : ''}>
        <div className={expanded ? `min-w-0 w-full mx-auto ${square ? 'max-w-[min(78vh,900px)]' : ''}` : ''}>{children}</div>
        {(inspectionPanel || (expanded && showInspection)) && <aside aria-label="Plot inspection details"
          className={expanded ? 'min-w-0 lg:sticky lg:top-0 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto' : ''}>
          {inspectionPanel ? inspectionPanel(expanded) : <ContextInspectionPanel compact />}
        </aside>}
      </div>
    </div>
    {!expanded && <button ref={trigger} type="button" onClick={() => { setInlineHeight(root.current?.getBoundingClientRect().height); setExpanded(true); }}
      aria-label={`Enlarge ${title}`} title="Enlarge plot"
      className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300/60 bg-white/70 text-slate-700 shadow-sm backdrop-blur-sm opacity-0 transition duration-200 hover:bg-white/95 hover:scale-105 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 focus-ring [@media(hover:none)]:opacity-100 motion-reduce:transition-none motion-reduce:hover:scale-100"><Maximize2 size={17} /></button>}
  </div></div>;
}

```

## web/src/components/steps/ModelResolution.tsx

```tsx
import React, { useEffect, useState } from 'react';
import { BoundaryCondition, ModelConfig } from '../../types/aquifer';

/** Physical cell-size input translates to the existing uniform-grid cell counts. */
export function ModelResolution({ config, onChange }: { config: ModelConfig; onChange: (config: ModelConfig) => void }) {
  const width = config.maxX - config.minX, height = config.maxY - config.minY;
  // Keep raw text while editing: Number('') is 0 and would immediately refill
  // a cleared controlled input, preventing ordinary backspace-and-replace edits.
  const [dxDraft, setDxDraft] = useState(String(width / config.gridNx));
  const [dyDraft, setDyDraft] = useState(String(height / config.gridNy));
  useEffect(() => { setDxDraft(String(width / config.gridNx)); setDyDraft(String(height / config.gridNy)); }, [width, height, config.gridNx, config.gridNy]);
  const dx = dxDraft.trim() === '' ? NaN : Number(dxDraft);
  const dy = dyDraft.trim() === '' ? NaN : Number(dyDraft);
  const maximum = config.testCase === 'black_kipp' ? 300 : 60;
  const nx = Math.ceil(width / dx), ny = Math.ceil(height / dy);
  const valid = [width, height, dx, dy].every(value => Number.isFinite(value) && value > 0) && nx >= 3 && ny >= 3 && nx <= maximum && ny <= maximum;
  return <section className="rounded-xl border border-slate-300 bg-white p-4 space-y-4 text-xs" aria-label="Cell size and boundary conditions">
    <div><h3 className="font-bold text-sm">Level of discretization · cell size</h3><p className="mt-1 text-slate-600">The domain is divided into uniform cells. Smaller cells describe more spatial detail but cost more computation; finer does not automatically mean more accurate. Compare resolutions and domain sizes to check numerical effects.</p></div>
    <div className="grid sm:grid-cols-2 gap-3">
      <label>Target cell width Δx (m)<input type="number" min="0" step="any" value={dxDraft} onChange={event => setDxDraft(event.target.value)} className="mt-1 w-full border rounded p-2 focus-ring" /></label>
      <label>Target cell height Δy (m)<input type="number" min="0" step="any" value={dyDraft} onChange={event => setDyDraft(event.target.value)} className="mt-1 w-full border rounded p-2 focus-ring" /></label>
    </div>
    <p className={valid ? 'text-slate-600' : 'text-red-800'}>{valid ? `Will use ${nx} × ${ny} cells; actual Δx = ${(width / nx).toPrecision(5)} m, Δy = ${(height / ny).toPrecision(5)} m. Counts round up to fit the domain.` : `Choose sizes giving 3–${maximum} cells per axis within a valid domain.`}</p>
    <button type="button" disabled={!valid} onClick={() => { if (valid) onChange({ ...config, gridNx: nx, gridNy: ny }); }} className="border rounded px-3 py-2 font-semibold disabled:opacity-40 focus-ring">Apply cell size</button>
    <div className="border-t pt-4 space-y-2"><h3 className="font-bold text-sm">Domain boundary conditions</h3>
      <p className="text-slate-600">Constant head holds the oscillatory head perturbation at zero at that edge (not zero aquifer elevation). No flow blocks flux across the edge. These are modeling assumptions: choose them from site knowledge and test their effect.</p>
      <div className="grid sm:grid-cols-2 gap-3">{(['west', 'east', 'south', 'north'] as const).map(side => <label key={side} className="capitalize">{side} edge<select value={config.boundaries[side]} onChange={event => onChange({ ...config, boundaries: { ...config.boundaries, [side]: event.target.value as BoundaryCondition } })} className="mt-1 w-full border rounded p-2 bg-white focus-ring"><option value="constant_head">Constant head perturbation (h′ = 0)</option><option value="no_flow">No flow (normal flux = 0)</option></select></label>)}</div>
      <p className="text-slate-600">Top and bottom: no flow (fixed by the one-layer, unit-thickness 2-D model). This implementation requires at least one horizontal constant-head edge.</p>
      {config.testCase === 'black_kipp' && <p className="rounded bg-amber-50 p-2 text-amber-900">Black–Kipp assumes a homogeneous, laterally infinite aquifer; this numerical model has finite edges. Longer periods can be more affected by those edges. Changing geometry or boundaries creates a customized comparison, not exact baseline parity.</p>}
    </div>
  </section>;
}

```
## web/src/components/steps/PeriodSweep.tsx

```tsx
import React, { useState } from 'react';
import { ModelConfig } from '../../types/aquifer';
import { makePeriods, PeriodSampling, sweepTests, wellSetups } from '../../utils/periodSweep';

export function PeriodSweep({ config, onApply, activeTestId }: { config: ModelConfig; onApply: (config: ModelConfig) => void; activeTestId: string }) {
  const blackKipp = config.testCase === 'black_kipp';
  const [mode, setMode] = useState<PeriodSampling>(blackKipp ? 'logarithmic' : 'list');
  const [start, setStart] = useState(10), [end, setEnd] = useState(blackKipp ? 10000 : 50);
  const [interval, setInterval] = useState(10), [count, setCount] = useState(20);
  const [list, setList] = useState('10, 50');
  const [target, setTarget] = useState(blackKipp ? 'active' : 'all');
  const [amplitudeMode, setAmplitudeMode] = useState<'rate' | 'volume'>(blackKipp ? 'rate' : 'volume');
  const [amplitude, setAmplitude] = useState(blackKipp ? .001 : .01);
  const [message, setMessage] = useState('');
  const setups = wellSetups(target === 'all' ? config.tests : config.tests.filter(test => test.id === activeTestId));
  let periods: number[] = [], error = '', generated: ReturnType<typeof sweepTests> = [];
  try { periods = makePeriods(mode, start, end, interval, count, list); generated = sweepTests(config, setups, periods, amplitude, amplitudeMode, 'preview'); }
  catch (cause) { error = (cause as Error).message; }
  const inputClass = 'mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 font-mono text-xs focus-ring';
  return <section className="rounded-xl border border-slate-300 bg-white p-4 space-y-3" aria-label="Multi-period experiment builder">
    <h3 className="font-bold text-sm">Period sweep · same well setup, multiple periods</h3>
    <p className="text-xs text-slate-600">Assign pumping/observation wells in the cards below first. Then generate period tests for those assignments. Nothing changes until you apply.</p>
    <div className="grid sm:grid-cols-2 gap-3 text-xs">
      <label>Well setups<select className={inputClass} value={target} onChange={event => setTarget(event.target.value)}><option value="all">All distinct current well setups</option><option value="active">Selected test’s well setup only</option></select></label>
      <label>Period sampling<select className={inputClass} value={mode} onChange={event => setMode(event.target.value as PeriodSampling)}><option value="logarithmic">Logarithmic range (sample count)</option><option value="linear">Linear range (increment in seconds)</option><option value="list">Explicit period list</option></select></label>
      {mode === 'list' ? <label className="sm:col-span-2">Periods (s), comma-separated<input className={inputClass} value={list} onChange={event => setList(event.target.value)} /></label> : <>
        <label>Minimum period (s)<input type="number" min="0" step="any" className={inputClass} value={start} onChange={event => setStart(Number(event.target.value))} /></label>
        <label>Maximum period (s)<input type="number" min="0" step="any" className={inputClass} value={end} onChange={event => setEnd(Number(event.target.value))} /></label>
        {mode === 'linear' ? <label>Period increment (s)<input type="number" min="0" step="any" className={inputClass} value={interval} onChange={event => setInterval(Number(event.target.value))} /></label> : <label>Number of samples<input type="number" min="2" max="30" className={inputClass} value={count} onChange={event => setCount(Number(event.target.value))} /></label>}
      </>}
      <label>Amplitude rule<select className={inputClass} value={amplitudeMode} onChange={event => { const next = event.target.value as 'rate' | 'volume'; setAmplitudeMode(next); setAmplitude(next === 'volume' ? .01 : config.pumpingRate); }}><option value="rate">Fixed peak pumping rate Qmax</option><option value="volume">Fixed cycling volume V (MATLAB rule)</option></select></label>
      <label>{amplitudeMode === 'rate' ? 'Peak pumping amplitude Qmax (m³/s)' : 'Cycling volume V (m³)'}<input type="number" min="0" step="any" className={inputClass} value={amplitude} onChange={event => setAmplitude(Number(event.target.value))} /></label>
    </div>
    <p className="text-xs text-slate-600">P is one complete pumping cycle, not the logger sampling interval or test duration; frequency f = 1/P. Qmax is peak rate, not peak-to-peak. Fixed-volume mode uses Qmax = πV/P, matching the original MATLAB/Python example.</p>
    {error ? <p role="alert" className="text-xs text-red-800">{error}</p> : <div className="text-xs rounded-lg bg-slate-50 border p-3 space-y-1"><strong>{setups.length} well setups × {periods.length} periods → {generated.length} tests · {generated.reduce((sum, test) => sum + test.observationWellIds.length, 0)} response pairs</strong><p className="break-words">Periods (s): {periods.map(period => Number(period.toPrecision(6))).join(', ')}</p><p>Range endpoints are included. Applying replaces the current test list; well locations, grid, and boundaries stay unchanged.</p></div>}
    <button type="button" disabled={!!error} className="rounded-lg bg-[#C5050C] px-4 py-2 text-xs font-bold text-white disabled:opacity-40 focus-ring" onClick={() => {
      if (!window.confirm(`Replace ${config.tests.length} current tests with ${generated.length} period tests? Well locations and model settings will not change.`)) return;
      const tests = sweepTests(config, setups, periods, amplitude, amplitudeMode, `sweep-${crypto.randomUUID()}`);
      onApply({ ...config, tests }); setMessage(`Applied ${tests.length} tests. Review each setup below before proceeding.`);
    }}>Apply period sweep</button>
    {message && <p role="status" className="text-xs text-green-800">{message}</p>}
  </section>;
}

```
