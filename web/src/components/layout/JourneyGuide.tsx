import React, { useEffect, useRef, useState } from "react";
import { ArrowUp, Compass, Minimize2 } from "lucide-react";
import { StepId } from "../../types/aquifer";
import { PageWalkthrough } from "./PageWalkthrough";
const stages = [
  "Wells & model",
  "Tests & periods",
  "Review",
  "Data & run",
  "Results",
];
export function JourneyGuide({
  step,
  disabled,
  onTop,
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
  const launcher = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() =>
      launcher.current?.focus({ preventScroll: true }),
    );
  };
  useEffect(() => setOpen(false), [step, disabled]);
  const start = () => {
    if (!disabled) setOpen(true);
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
            start();
          }}
        >
          <Compass size={23} />
        </button>
      ) : (
        <div className="journey-guide guide-launcher">
          <button
            ref={launcher}
            type="button"
            disabled={disabled}
            onClick={start}
            aria-haspopup="dialog"
            className="guide-start focus-ring"
          >
            <Compass size={18} className="shrink-0 text-[#C5050C]" />
            <span className="truncate">
              {step}/5 · {stages[step - 1]}
            </span>
            <span className="ml-auto hidden sm:inline text-[#566372]">
              Show me around
            </span>
          </button>
          <button
            type="button"
            aria-label="Minimize journey guide"
            title="Minimize guide"
            className="rounded-full p-2 hover:bg-white focus-ring"
            onClick={() => {
              setOpen(false);
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
