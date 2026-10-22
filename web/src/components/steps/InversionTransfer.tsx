import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { ExperimentSession, prepareInversion } from '../../utils/experimentWorkflow';
import { NumericInput } from '../NumericInput';

export function InversionTransfer({
  source,
  onClose,
  onTransfer,
}: {
  source: ExperimentSession;
  onClose: () => void;
  onTransfer: (session: ExperimentSession) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [nx, setNx] = useState(Math.min(60, source.config.gridNx));
  const [ny, setNy] = useState(Math.min(60, source.config.gridNy));
  const [accepted, setAccepted] = useState(false);
  const changed = nx !== source.config.gridNx || ny !== source.config.gridNy;
  let error = '',
    prepared: ExperimentSession | null = null;
  try {
    prepared = prepareInversion(source, nx, ny);
  } catch (cause) {
    error = (cause as Error).message;
  }
  useEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => {
      dialog.current?.close();
      active?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto w-[min(640px,calc(100%-32px))] max-h-[85dvh] overflow-auto rounded-2xl border border-[#D6DADD] p-0 text-[#121212] shadow-2xl backdrop:bg-black/45"
      aria-labelledby="transfer-title"
    >
      <div className="space-y-4 p-6" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#C5050C]">Forward → observations → inversion</p>
            <h2 id="transfer-title" className="mt-2 text-xl font-bold">
              Use synthetic responses for inversion
            </h2>
          </div>
          <button aria-label="Close transfer" onClick={onClose} className="rounded p-1 focus-ring">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm leading-6 text-[#4B4F52]">
          Transfer all {source.result?.pairs.length} real/imaginary head responses, preserving well locations,
          test IDs, periods, peak rates and boundaries. These are noise-free model predictions, not field
          measurements.
        </p>
        <div className="rounded-xl border bg-[#F7F7F7] p-4 text-sm">
          <strong>
            Generating grid: {source.config.gridNx} × {source.config.gridNy}
          </strong>
          <p className="mt-1 text-xs text-[#6B7074]">
            The existing inverse solver supports at most 60 × 60 cells. The original forward run will be
            retained separately.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ['Inversion Nx', nx, setNx],
              ['Inversion Ny', ny, setNy],
            ] as const
          ).map(([label, value, setter]) => (
            <label key={label} className="text-sm font-semibold">
              {label}
              <NumericInput
                aria-label={label}
                min={3}
                max={60}
                step={1}
                value={value}
                onValueChange={(n) => {
                  setter(n);
                  setAccepted(false);
                }}
                className="mt-1 w-full rounded-lg border p-2 font-mono focus-ring"
              />
            </label>
          ))}
        </div>
        {changed && (
          <label className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-5">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-1"
            />
            <span>
              I understand that changing the grid changes numerical discretization. The observations stay
              unchanged; exact baseline parity or perfect recovery is not guaranteed.
            </span>
          </label>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-800">
            {error}
          </p>
        )}
        <p className="text-xs text-[#6B7074]">
          Next: review the inverse model, then run imported-data inversion with the synthetic CSV already
          filled in. No inversion starts automatically.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm focus-ring">
            Cancel
          </button>
          <button
            disabled={!prepared || (changed && !accepted)}
            onClick={() => {
              if (prepared) onTransfer(prepared);
            }}
            className="flex items-center gap-2 rounded-lg bg-[#C5050C] px-4 py-2 text-sm font-bold text-white disabled:opacity-40 focus-ring"
          >
            Review inversion inputs
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </dialog>
  );
}
