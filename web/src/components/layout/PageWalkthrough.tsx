import React, { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { StepId } from "../../types/aquifer";
import { pageTours, TourStop, tourLayout } from "../../utils/walkthrough";

export function PageWalkthrough({
  step,
  onClose,
}: {
  step: StepId;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    card = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const mask = useId().replace(/:/g, ""),
    headingId = `${mask}-heading`,
    descriptionId = `${mask}-text`;
  const [stops] = useState<TourStop[]>(() => {
    if (typeof document === "undefined") return [];
    const available = pageTours[step].filter(
      (s) => document.querySelector(s.selector)?.getClientRects().length,
    );
    return available.length
      ? available
      : [
          {
            selector: "main",
            title: "Your experiment workspace",
            text: "Complete the current screen and its readiness checks, then continue using normal navigation. You can reopen this optional guide at any time.",
          },
        ];
  });
  const [index, setIndex] = useState(0),
    [layout, setLayout] = useState<ReturnType<typeof tourLayout> | null>(null);
  const stop = stops[index];
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    // Native modal top layer traps focus and makes ALL background controls inert,
    // including the highlighted section. This is a tour, not an editing mode.
    node.showModal();
    closeButton.current?.focus();
    return () => {
      if (node.open) node.close();
    };
  }, []);
  useEffect(() => {
    if (!stop) return;
    const target = document.querySelector<HTMLElement>(stop.selector);
    if (!target) return;
    target.scrollIntoView({
      block: "start",
      inline: "nearest",
      behavior: "instant",
    });
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        let rect = target.getBoundingClientRect();
        // Reflow can move a target fully offscreen. Never draw the spotlight
        // over an unrelated footer just because an offscreen rect was clamped.
        if (rect.top >= innerHeight - 24 || rect.bottom <= 24) {
          target.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
          rect = target.getBoundingClientRect();
        }
        setLayout(
          tourLayout(
            rect,
            innerWidth,
            innerHeight,
            Math.min(380, innerWidth - 24),
            card.current?.getBoundingClientRect().height ?? 250,
          ),
        );
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    if (card.current) observer.observe(card.current);
    const resize = () => {
      target.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
      measure();
    };
    window.addEventListener("resize", resize);
    document.addEventListener("scroll", measure, true);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("scroll", measure, true);
    };
  }, [stop]);
  if (!stop) return null;
  return (
    <dialog
      ref={dialog}
      className="page-walkthrough"
      aria-modal="true"
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const buttons = Array.from(
          dialog.current!.querySelectorAll<HTMLButtonElement>(
            'button:not(:disabled):not([tabindex="-1"])',
          ),
        );
        const first = buttons[0],
          last = buttons[buttons.length - 1],
          active = document.activeElement;
        if (
          event.shiftKey &&
          (active === first || !dialog.current?.contains(active))
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (active === last || !dialog.current?.contains(active))
        ) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <button
        type="button"
        className="tour-dismiss-area"
        aria-label="Dismiss walkthrough backdrop"
        tabIndex={-1}
        onClick={onClose}
      />
      <svg className="tour-shade" width="100%" height="100%" aria-hidden="true">
        <defs>
          <mask id={mask}>
            <rect width="100%" height="100%" fill="white" />
            {layout && (
              <rect
                x={layout.box.left}
                y={layout.box.top}
                width={layout.box.width}
                height={layout.box.height}
                rx="10"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="#101820"
          fillOpacity=".72"
          mask={`url(#${mask})`}
        />
        {layout && (
          <rect
            x={layout.box.left}
            y={layout.box.top}
            width={layout.box.width}
            height={layout.box.height}
            rx="10"
            fill="none"
            stroke="#F8CF79"
            strokeWidth="3"
          />
        )}
      </svg>
      <div
        ref={card}
        className="tour-card"
        style={
          layout
            ? {
                left: layout.card.left,
                top: layout.card.top,
                width: layout.card.width,
              }
            : undefined
        }
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b p-3">
          <span className="text-xs font-semibold text-[#566372]">
            Page guide · {index + 1} of {stops.length}
          </span>
          <button
            ref={closeButton}
            type="button"
            aria-label="Close walkthrough"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-slate-100 focus-ring"
          >
            <X size={18} />
          </button>
        </header>
        <div
          className="min-h-0 overflow-y-auto p-4"
          aria-live="polite"
          aria-atomic="true"
        >
          <h2 id={headingId} className="text-base font-bold">
            {stop.title}
          </h2>
          <p
            id={descriptionId}
            className="mt-2 text-sm leading-relaxed text-[#566372]"
          >
            {stop.text}
          </p>
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t p-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-2 text-xs text-[#566372] underline focus-ring"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => setIndex(index - 1)}
              className="studio-button studio-button-secondary"
            >
              <ArrowLeft size={15} />
              Back
            </button>
            <button
              type="button"
              onClick={() =>
                index === stops.length - 1 ? onClose() : setIndex(index + 1)
              }
              className="studio-button studio-button-primary"
            >
              {index === stops.length - 1 ? "Done" : "Next"}
              <ArrowRight size={15} />
            </button>
          </div>
        </footer>
      </div>
    </dialog>
  );
}
