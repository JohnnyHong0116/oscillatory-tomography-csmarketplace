import React from 'react';
import { Activity, ArrowRight, CheckCircle2, Layers, Lock } from 'lucide-react';
import { TestCaseType } from '../../types/aquifer';

interface Step1Props {
  selectedTestCase: TestCaseType;
  onSelectTestCase: (type: TestCaseType) => void;
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

export const Step1SelectTestCase: React.FC<Step1Props> = ({ selectedTestCase, onSelectTestCase, onNext }) => <div className="max-w-5xl mx-auto space-y-6 py-2">
  <header className="bg-white border border-[#D6DADD] rounded-xl p-5 shadow-xs">
    <p className="text-xs font-semibold text-[#C5050C]">Step 1 · Choose an example</p>
    <h2 className="text-xl font-bold mt-2">Start with Black–Kipp, then explore tomography</h2>
    <p className="text-xs text-slate-600 mt-2">Both examples begin with neutral well locations. Assign pumping and observation roles afterward. Preset locations are example geometry—not surveyed field coordinates.</p>
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
  <div className="rounded-xl border border-dashed bg-slate-100 p-4 text-xs text-slate-600"><p className="flex gap-2 items-center font-bold"><Lock size={16} />Direct logger/time-series import — planned</p><p className="mt-2">Measured inversion already accepts processed steady-periodic real/imaginary head responses. Raw logger processing and live acquisition are not implemented.</p></div>
</div>;
