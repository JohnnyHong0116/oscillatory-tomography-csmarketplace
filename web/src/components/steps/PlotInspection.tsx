import React, { createContext, useContext, useState } from "react";
import { AnalysisPair } from "../../types/aquifer";

export interface PlotDetails {
  id: string;
  heading: string;
  rows: [string, string][];
}
export const formatPlotNumber = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? "N/A" : value.toPrecision(7);

export function responseDetails(pair: AnalysisPair): PlotDetails {
  return {
    id: `${pair.testId}-${pair.observationWellId}`,
    heading: `${pair.testName}: ${pair.pumpingWellName} → ${pair.observationWellName}`,
    rows: [
      ["Predicted amplitude (m)", formatPlotNumber(pair.predicted.amplitude)],
      [
        "Phase (°)",
        formatPlotNumber(
          pair.numericalPhaseDegrees ?? pair.predicted.phaseDegrees,
        ),
      ],
      ["Period (s)", formatPlotNumber(pair.periodSeconds)],
      ["Distance (m)", formatPlotNumber(pair.distanceMeters)],
      ["Real head (m)", formatPlotNumber(pair.predicted.real)],
      ["Imaginary head (m)", formatPlotNumber(pair.predicted.imag)],
      ...(pair.measured
        ? ([
            ["Measured real (m)", formatPlotNumber(pair.measured.real)],
            ["Measured imaginary (m)", formatPlotNumber(pair.measured.imag)],
          ] as [string, string][])
        : []),
      ...(pair.residualAmplitude != null
        ? ([
            [
              "Residual amplitude (m)",
              formatPlotNumber(pair.residualAmplitude),
            ],
          ] as [string, string][])
        : []),
      ...(pair.analytical
        ? ([
            [
              "Analytical amplitude (m)",
              formatPlotNumber(pair.analytical.amplitude),
            ],
            [
              "Analytical phase (°)",
              formatPlotNumber(pair.analytical.phaseDegrees),
            ],
            [
              "Amplitude error (%)",
              formatPlotNumber((pair.amplitudeRelativeError ?? NaN) * 100),
            ],
            [
              "Circular phase error (°)",
              formatPlotNumber(pair.phaseErrorDegrees),
            ],
          ] as [string, string][])
        : []),
    ],
  };
}

/** Pinned selections ignore incidental pointer movement; Escape or Clear releases them. */
export function usePlotInspection() {
  const [hovered, setHovered] = useState<PlotDetails | null>(null);
  const [pinned, setPinned] = useState<PlotDetails | null>(null);
  const clear = () => {
    setPinned(null);
    setHovered(null);
  };
  return {
    details: pinned ?? hovered,
    pinned: !!pinned,
    hover: (details: PlotDetails | null) =>
      setHovered((current) =>
        current?.id === details?.id ? current : details,
      ),
    pin: (details: PlotDetails) =>
      setPinned((current) => (current?.id === details.id ? null : details)),
    clear,
  };
}
type Inspection = ReturnType<typeof usePlotInspection>;
const InspectionContext = createContext<Inspection | null>(null);
export const useInspectionContext = () => useContext(InspectionContext);

/** Show the same selection inside an enlarged chart rather than behind its viewer. */
export function ContextInspectionPanel({
  compact = false,
}: {
  compact?: boolean;
}) {
  const inspection = useContext(InspectionContext);
  return inspection ? (
    <InspectionPanel inspection={inspection} compact={compact} />
  ) : null;
}

export function PlotLegendButton({
  label,
  color,
  visible,
  onToggle,
}: {
  label: string;
  color: string;
  visible: boolean;
  onToggle: () => void;
}) {
  const inspection = useContext(InspectionContext);
  return (
    <button
      type="button"
      aria-label={`Toggle ${label}`}
      aria-pressed={visible}
      onClick={() => {
        inspection?.clear();
        onToggle();
      }}
      className={`flex items-center gap-1.5 rounded border border-slate-200 px-2 py-1 focus-ring ${visible ? "" : "opacity-40 line-through"}`}
    >
      <i className="w-4 h-0.5" style={{ background: color }} />
      {label}
    </button>
  );
}

export function InspectionPanel({
  inspection,
  compact = false,
}: {
  inspection: Inspection;
  compact?: boolean;
}) {
  const details = inspection.details;
  return (
    <div
      className={`${compact ? "" : "mt-3"} plot-inspector text-xs`}
      aria-live="polite"
      aria-atomic="true"
    >
      {details ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <strong>{details.heading}</strong>
            <button
              type="button"
              onClick={inspection.clear}
              className="rounded border px-2 py-1 focus-ring"
            >
              Clear selection
            </button>
          </div>
          <p className="my-2 text-slate-600">
            <span className="plot-selection-badge">
              {inspection.pinned ? "Pinned" : "Live probe"}
            </span>{" "}
            {inspection.pinned
              ? "Click another point to inspect it."
              : "Click to pin these values."}
          </p>
          <dl
            className={
              compact ? "grid grid-cols-1 gap-y-3" : "plot-inspector-grid"
            }
          >
            {(compact ? details.rows : details.rows.slice(0, 4)).map(
              ([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ),
            )}
          </dl>
          {!compact && details.rows.length > 4 && (
            <details className="mt-3 border-t border-slate-200 pt-2">
              <summary className="cursor-pointer w-fit rounded focus-ring">
                All response values ({details.rows.length})
              </summary>
              <dl className="plot-inspector-grid mt-3">
                {details.rows.slice(4).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
        </>
      ) : (
        <p className="text-slate-600">
          Explore anywhere in the plot or focus a point. Arrow keys browse;
          click or Enter pins values. Escape clears.
        </p>
      )}
    </div>
  );
}

export function PlotInspection({ children }: { children: React.ReactNode }) {
  const inspection = usePlotInspection();
  return (
    <InspectionContext.Provider value={inspection}>
      <div
        onKeyDown={(event) => {
          if (event.key === "Escape") inspection.clear();
        }}
      >
        {children}
        <InspectionPanel inspection={inspection} />
      </div>
    </InspectionContext.Provider>
  );
}

/** Transparent hit targets make small scientific markers practical to use. */
export function InspectablePoint({
  cx,
  cy,
  details,
  children,
}: {
  cx: number;
  cy: number;
  details: PlotDetails;
  children: React.ReactNode;
}) {
  const inspection = useContext(InspectionContext);
  const selected = inspection?.details?.id === details.id;
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`Inspect ${details.heading}`}
      aria-pressed={!!selected && !!inspection?.pinned}
      className="cursor-pointer outline-none"
      onMouseEnter={() => inspection?.hover(details)}
      onMouseLeave={() => inspection?.hover(null)}
      onFocus={() => inspection?.hover(details)}
      onBlur={() => inspection?.hover(null)}
      onClick={() => inspection?.pin(details)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inspection?.pin(details);
        }
      }}
    >
      {selected && (
        <circle
          cx={cx}
          cy={cy}
          r="8"
          fill="none"
          stroke="#F59E0B"
          strokeWidth="2"
        />
      )}
      {children}
      <circle cx={cx} cy={cy} r="9" fill="transparent" />
    </g>
  );
}
