import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, ChevronDown, ChevronUp, Compass, Lock } from 'lucide-react';
import { StepId } from '../../types/aquifer';

const stages = [
  {
    title: 'Wells & model',
    note: 'Locate physical wells in meters. Set domain extents, cell size and boundary assumptions before assigning test roles.',
  },
  {
    title: 'Tests & periods',
    note: 'Choose one pump and its observers per setup. Repeat a setup over a period range; specify peak pumping amplitude, not peak-to-peak flow.',
  },
  {
    title: 'Review',
    note: 'Check geometry, spatial resolution, response count and model assumptions. Edit any test without losing the rest of your experiment.',
  },
  {
    title: 'Data & run',
    note: 'Predict responses from a forward model, or invert processed complex observations. Keep synthetic and field data clearly identified.',
  },
  {
    title: 'Results',
    note: 'Inspect plots and export a report. Forward real/imaginary responses can become inversion inputs, with explicit confirmation of the inversion grid.',
  },
];

/** One journey control instead of duplicated sidebar/top navigation. The popover
 * lives in the workspace overlay so it never changes or traps the page scroll. */
export function JourneyGuide({
  step,
  disabled,
  onBack,
  onTop,
}: {
  step: StepId;
  disabled: boolean;
  onBack: (step: StepId) => void;
  onTop: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setOpen(false);
  }, [step]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        ref.current?.querySelector<HTMLButtonElement>('[aria-controls]')?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div
      ref={ref}
      className="journey-guide absolute bottom-4 left-1/2 z-20 w-[min(620px,calc(100%-24px))] -translate-x-1/2"
    >
      {open && (
        <section
          id="journey-details"
          aria-label="Experiment journey"
          className="mb-2 max-h-[min(55dvh,380px)] overflow-y-auto rounded-2xl border border-[#D6DADD] bg-white/95 p-4 shadow-xl backdrop-blur-xl"
        >
          <ol className="grid grid-cols-5 gap-1 border-b pb-4">
            {stages.map((stage, index) => {
              const n = (index + 1) as StepId;
              return (
                <li key={stage.title}>
                  <button
                    disabled={disabled || n >= step}
                    onClick={() => {
                      setOpen(false);
                      onBack(n);
                    }}
                    aria-current={n === step ? 'step' : undefined}
                    title={n > step ? 'Continue from the current screen after validation' : stage.title}
                    className="flex w-full flex-col items-center gap-2 rounded-lg p-1 focus-ring disabled:cursor-default"
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${n === step ? 'bg-[#C5050C] text-white ring-4 ring-red-50' : n < step ? 'bg-[#E7F5EA] text-green-800' : 'bg-[#F1F2F3] text-[#6B7074]'}`}
                    >
                      {n < step ? <Check size={14} /> : n > step ? <Lock size={12} /> : n}
                    </span>
                    <span
                      className={`text-[10px] sm:text-xs ${n === step ? 'font-bold text-[#121212]' : 'text-[#6B7074]'}`}
                    >
                      {stage.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <h3 className="mt-4 text-sm font-bold">{stages[step - 1].title}</h3>
          <p className="mt-2 text-xs leading-5 text-[#4B4F52]">{stages[step - 1].note}</p>
          <p className="mt-3 rounded-lg bg-[#F7F7F7] p-3 text-[11px] leading-5 text-[#6B7074]">
            Forward model → synthetic observations → inversion. A synthetic recovery check is not validation
            against field measurements. Examples are separate practice projects.
          </p>
        </section>
      )}
      <div className="flex items-center justify-between gap-2 rounded-full border border-slate-300/80 bg-slate-100/90 px-2 py-1.5 text-[#343A40] shadow-lg backdrop-blur-xl">
        <button
          aria-expanded={open}
          aria-controls="journey-details"
          onClick={() => setOpen(!open)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold focus-ring"
        >
          <Compass size={17} className="shrink-0 text-[#C5050C]" />
          <span className="truncate">
            {step}/5 · {stages[step - 1].title}
          </span>
          <span className="ml-auto hidden text-[#6B7074] sm:inline">Journey guide</span>
          {open ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
        <button
          onClick={onTop}
          className="group flex items-center rounded-full border-l px-3 py-1.5 text-xs focus-ring"
          aria-label="Back to top"
        >
          <ArrowUp size={16} />
          <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover:ml-2 group-hover:max-w-24 group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-24 group-focus-visible:opacity-100 motion-reduce:transition-none">
            Back to top
          </span>
        </button>
      </div>
    </div>
  );
}
