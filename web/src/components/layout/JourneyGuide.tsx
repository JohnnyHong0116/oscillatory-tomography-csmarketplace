import React, { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Compass, Lock, Minimize2, X } from "lucide-react";
import { StepId } from "../../types/aquifer";
import { PageWalkthrough } from "./PageWalkthrough";
const stages = [
  "Wells & model",
  "Tests & periods",
  "Review",
  "Data & run",
  "Results",
];
const notes = [
  'Locate physical wells in meters. Set domain extents, cell size and boundary assumptions before assigning test roles.',
  'Choose one pump and its observers per setup. Repeat a setup over a period range; specify peak pumping amplitude, not peak-to-peak flow.',
  'Check geometry, spatial resolution, response count and model assumptions. Edit any test without losing the rest of your experiment.',
  'Predict responses from a forward model, or invert processed complex observations. Keep synthetic and field data clearly identified.',
  'Inspect plots and export a report. Forward real/imaginary responses can become inversion inputs after explicit review of the inversion grid.',
];
export function JourneyGuide({
  step,
  disabled,
  onTop,
  onBack,
  minimized = false,
  onMinimizedChange,
}: {
  step: StepId;
  disabled: boolean;
  onBack: (step: StepId) => void;
  onTop: () => void;
  minimized?: boolean;
  onMinimizedChange?: (value: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [overview, setOverview] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const detailsLauncher = useRef<HTMLButtonElement>(null);
  const overviewRoot = useRef<HTMLDivElement>(null);
  const close = () => {
    setOpen(false);
    setOverview(true);
    requestAnimationFrame(() =>
      (detailsLauncher.current ?? launcher.current)?.focus({ preventScroll: true }),
    );
  };
  useEffect(() => { setOpen(false); setOverview(false); }, [step, disabled]);
  useEffect(() => {
    if (!overview || open) return;
    const outside = (event: PointerEvent) => {
      if (!overviewRoot.current?.contains(event.target as Node)) setOverview(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOverview(false); launcher.current?.focus({preventScroll:true}); }
    };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [overview, open]);
  const start = () => {
    if (!disabled) { setOverview(false); setOpen(true); }
  };
  return (
    <>
      {minimized ? (
        <button
          ref={launcher}
          type="button"
          className="guide-bubble focus-ring"
          aria-label="Open journey guide"
          title="Open journey guide"
          disabled={disabled}
          onClick={() => {
            onMinimizedChange?.(false);
            setOverview(true);
          }}
        >
          <Compass size={23} />
        </button>
      ) : (
        <div ref={overviewRoot} className="journey-guide guide-launcher">
          {overview && !disabled && <section id="journey-overview" aria-label="Experiment journey" className="guide-overview">
            <div className="flex items-center justify-between gap-3 mb-3"><h2 className="text-sm font-bold">Your experiment · five steps</h2><button type="button" aria-label="Close simple guide" onClick={() => {setOverview(false);launcher.current?.focus({preventScroll:true});}} className="rounded p-2 hover:bg-slate-100 focus-ring"><X size={16}/></button></div>
            <ol className="grid grid-cols-5 gap-1 border-b pb-4">{stages.map((title,index)=>{
              const n=(index+1) as StepId;
              return <li key={title}><button type="button" disabled={disabled || n>=step} aria-current={n===step?'step':undefined}
                title={n>step?'Continue from the current screen after validation':title}
                onClick={()=>{setOverview(false);onBack(n);}}
                className="flex w-full flex-col items-center gap-2 rounded-lg p-1 text-xs focus-ring disabled:cursor-default">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full font-semibold ${n===step?'bg-[#C5050C] text-white ring-4 ring-red-50':n<step?'bg-[#E7F5EA] text-green-800':'bg-[#F1F2F3] text-[#566372]'}`}>{n<step?<Check size={14}/>:n>step?<Lock size={12}/>:n}</span>
                <span className={n===step?'font-bold':'text-[#566372]'}>{title}</span>
              </button></li>;
            })}</ol>
            <h3 className="mt-4 text-sm font-bold">{stages[step-1]}</h3><p className="mt-2 text-xs leading-5 text-[#566372]">{notes[step-1]}</p>
            <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-[#566372]">Forward model → synthetic observations → inversion. Synthetic recovery is a consistency check, not field validation. Examples are separate practice projects.</p>
            <button ref={detailsLauncher} type="button" onClick={start} aria-haspopup="dialog" className="studio-button studio-button-primary mt-4 w-full"><Compass size={16}/>Show me around this page</button>
          </section>}
          <button
            ref={launcher}
            type="button"
            disabled={disabled}
            onClick={() => setOverview(!overview)}
            aria-expanded={overview}
            aria-controls="journey-overview"
            className="guide-start focus-ring"
          >
            <Compass size={18} className="shrink-0 text-[#C5050C]" />
            <span className="truncate">
              {step}/5 · {stages[step - 1]}
            </span>
            <span className="ml-auto hidden sm:inline text-[#566372]">
              Journey guide
            </span>
          </button>
          <button
            type="button"
            aria-label="Minimize journey guide"
            title="Minimize guide"
            className="rounded-full p-2 hover:bg-white focus-ring"
            onClick={() => {
              setOpen(false);
              setOverview(false);
              onMinimizedChange?.(true);
              requestAnimationFrame(() =>
                launcher.current?.focus({ preventScroll: true }),
              );
            }}
          >
            <Minimize2 size={17} />
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={onTop}
        className={`guide-to-top group focus-ring ${minimized ? "guide-to-top-center" : ""}`}
        aria-label="Back to top"
      >
        <ArrowUp size={16} />
        <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all group-hover:ml-2 group-hover:max-w-24 group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-24 group-focus-visible:opacity-100 motion-reduce:transition-none">
          Back to top
        </span>
      </button>
      {open && !disabled && (
        <PageWalkthrough key={step} step={step} onClose={close} />
      )}
    </>
  );
}
