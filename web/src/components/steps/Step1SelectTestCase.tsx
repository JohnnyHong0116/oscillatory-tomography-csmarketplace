import React from 'react';
import { Activity, ArrowRight, CheckCircle2, Layers, Lock, Box } from 'lucide-react';
import { ExampleType } from '../../types/aquifer';

interface Step1Props {
  selectedTestCase: ExampleType;
  onSelectTestCase: (type: ExampleType) => void;
  onPreview?: (type: 'matlab_3d' | 'matlab_3d_quick') => void;
  loadingPreview?: boolean;
  onNext: () => void;
}

// Keep the learning sequence in DOM order as well as visual/keyboard order.
const examples = [
  { id: 'black_kipp' as const, Icon: Activity, stage: '1 · Start here: forward-model validation',
    title: 'Multi-frequency Black–Kipp Comparison',
    description: 'Start with physical well positions, domain, cell size, and boundaries. Then assign a pump and observers and explore how their responses change over a range of periods.',
    baseline: 'Original preset: 300×300 cells · 5 wells · 20 periods',
    features: ['Compare numerical amplitude and phase with the analytical solution', 'Generate a linear or logarithmic period sweep for the same well setup', 'Inspect response errors and effective-property diagnostics'] },
  { id: 'inversion_10s' as const, Icon: Layers, stage: '2 · Next: multi-period hydraulic tomography',
    title: 'P = 10 s Baseline & Multi-Period Tomography',
    description: 'Keep the original P=10 s checkerboard experiment, or build a customized multi-period experiment. Use forward-generated data to practice inversion before supplying measured complex-head responses.',
    baseline: 'Original preset: 50×50 cells · 9 wells · 36 responses',
    features: ['Configure pump/observer assignments, periods, and peak pumping amplitudes', 'Compare true and recovered ln(K) and ln(Ss) fields in synthetic runs', 'Inspect field error, sensitivity, observation fit, and convergence'] },
];

export const Step1SelectTestCase: React.FC<Step1Props> = ({ selectedTestCase, onSelectTestCase, onNext, onPreview, loadingPreview }) => <div className="max-w-5xl mx-auto space-y-6 py-2">
  <header className="bg-white border border-[#D6DADD] rounded-xl p-5 shadow-xs">
    <p className="text-xs font-semibold text-[#C5050C]">Step 1 · Choose an example</p>
    <h2 className="text-xl font-bold mt-2">Start with Black–Kipp, then explore tomography</h2>
    <p className="text-xs text-slate-600 mt-2">Explore analytical validation, 2D recovery, then the professor’s 3D experiment. Examples include editable well locations and predefined tests. Preset locations are synthetic geometry, not surveyed field coordinates.</p>
  </header>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">{examples.map(({ id, Icon, stage, title, description, baseline, features }) => <article key={id}
    className={`relative rounded-xl border-2 p-5 flex flex-col justify-between ${selectedTestCase === id ? 'bg-[#FEF2F2]/40 border-[#C5050C] shadow-md' : 'bg-white border-[#D6DADD]'}`}>
    <div>
      <p className="text-[11px] font-bold text-[#C5050C] flex items-center gap-2"><Icon size={20} />{stage}</p>
      <h3 className="mt-3 text-base font-bold">{title}</h3>
      {selectedTestCase === id && <p className="mt-2 text-xs text-[#C5050C] flex items-center gap-1"><CheckCircle2 size={14} />Selected example</p>}
      <p className="text-xs leading-relaxed text-slate-600 mt-3">{description}</p>
      <ul className="mt-4 space-y-2 text-xs list-disc pl-4">{features.map(feature => <li key={feature}>{feature}</li>)}</ul>
    </div>
    <footer className="border-t mt-5 pt-4 space-y-3"><p className="text-[11px] font-mono text-slate-500">{baseline}</p>
      <button type="button" onClick={() => { onSelectTestCase(id); onNext(); }} className="flex items-center gap-2 rounded bg-[#C5050C] px-3 py-2 text-xs font-bold text-white hover:bg-[#9B0000] focus-ring">Load Configuration<ArrowRight size={15} /></button>
    </footer>
  </article>)}</div>
  <section aria-label="MATLAB 3D example" className="rounded-2xl border border-[#D6DADD] bg-white overflow-hidden shadow-xs">
    <header className="p-5 border-b bg-slate-50">
      <p className="text-[11px] font-bold text-[#C5050C] flex items-center gap-2"><Box size={20}/>3 · Professor’s MATLAB example</p>
      <h3 className="mt-2 text-lg font-bold">3D geostatistical tomography</h3>
      <p className="mt-2 text-sm text-slate-600">Explore wells at multiple elevations, four pumping periods, and spatial hydraulic fields. Open a computed preview immediately, or load inputs and follow the workflow yourself.</p>
      <a className="inline-block mt-3 text-xs font-semibold text-[#C5050C] underline focus-ring" href="https://github.com/wischydro-cardiff/oscillatory-tomography/blob/7aa7146ec4d7dce63f0a4a6922ed458d6df56d5f/testing_inversion_3D_geostat.m" target="_blank" rel="noreferrer">View original MATLAB script ↗</a>
    </header>
    <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
      {([
        ['matlab_3d', 'Original configuration · forward', '20 × 20 × 20 · 8,000 cells · 4 m cells', '27 ports · 104 tests · 1,404 complex responses', 'Preserves all original well positions, periods (5 / 10 / 50 / 100 s), Qmax = 0.01π/P and six constant-head faces. Preview shows Python-generated signals and true fields. Full inversion exceeds the interactive budget.'],
        ['matlab_3d_quick', 'Quick workflow · reduced recovery', '8 × 8 × 8 · 512 cells · 10 m cells', '27 ports · central pump · 4 tests · 56 responses', 'Keeps the domain, 27 port locations, all four periods and amplitude rule. Uses W14 pumping, 14 surrounding observers and a coarser mesh to demonstrate true / recovered fields, residuals, sensitivity and convergence.']
      ] as const).map(([id,title,mesh,acquisition,description]) => <article key={id} className={`p-5 flex flex-col gap-3 ${selectedTestCase===id?'bg-red-50/40':''}`}>
        <h4 className="font-bold text-sm">{title}</h4>
        <div className="text-xs font-mono text-slate-600 space-y-1"><p>{mesh}</p><p>{acquisition}</p></div>
        <p className="text-xs leading-5 text-slate-600 flex-1">{description}</p>
        <div className="flex flex-wrap gap-2 pt-2">
          {onPreview && <button type="button" disabled={loadingPreview} onClick={()=>onPreview(id)} className="min-h-11 rounded-lg bg-[#C5050C] px-4 py-2 text-xs font-bold text-white hover:bg-[#9B0000] disabled:opacity-50 focus-ring">{loadingPreview?'Opening…':`View ${id==='matlab_3d'?'forward':'recovery'} results`}</button>}
          <button type="button" disabled={loadingPreview} onClick={()=>{onSelectTestCase(id);onNext();}} className="min-h-11 rounded-lg border bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 focus-ring">Load {id==='matlab_3d'?'original':'quick'} inputs</button>
        </div>
      </article>)}
    </div>
    <p className="border-t px-5 py-3 text-xs leading-5 text-slate-600">Computed previews are saved outputs from this project’s Python solver. Both 3D presets use saved truth fields generated by the original MATLAB routine with its legacy seed 0; Python computes the model outputs. The quick case is explicitly reduced, not original-baseline parity.</p>
  </section>
  <div className="rounded-xl border border-dashed bg-slate-100 p-4 text-xs text-slate-600"><p className="flex gap-2 items-center font-bold"><Lock size={16} />Direct logger/time-series import — planned</p><p className="mt-2">Measured inversion already accepts processed steady-periodic real/imaginary head responses. Raw logger processing and live acquisition are not implemented.</p></div>
</div>;
