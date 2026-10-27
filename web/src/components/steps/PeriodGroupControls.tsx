import React, { useRef, useState } from "react";
import { ModelConfig } from "../../types/aquifer";
import { addPeriodGroup, periodGroups } from "../../utils/periodGroups";
import { NumericInput } from "../NumericInput";
import { revealAfterRender } from "../../utils/scroll";
import { Activity, Check, Plus, X } from "lucide-react";

export function PeriodGroupControls({
  config,
  selected,
  onSelect,
  onChange,
  onAddTest,
  onOpenSweep,
}: {
  config: ModelConfig;
  selected: string;
  onSelect: (period: string) => void;
  onChange: (config: ModelConfig) => void;
  onAddTest: (period: number) => void;
  onOpenSweep?: () => void;
}) {
  const groups = periodGroups(config);
  const [adding, setAdding] = useState(false);
  const [period, setPeriod] = useState(config.pumpingPeriod);
  const [error, setError] = useState("");
  const groupForm = useRef<HTMLFormElement>(null);
  const count =
    selected === "all"
      ? config.tests.length
      : (groups.find((g) => g.period === Number(selected))?.tests.length ?? 0);
  return (
    <section
      aria-label="Period groups"
      className="period-workspace studio-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity size={18} aria-hidden="true" className="text-[#C5050C]" />
            <h3 className="text-base font-semibold">Periods & pumping tests</h3>
          </div>
          <p className="mt-1 text-sm text-[#566372]">
            Choose a cycle period, then define who pumps and who observes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
        {onOpenSweep && <button type="button" onClick={onOpenSweep} className="studio-button studio-button-secondary">Period sweep · input methods</button>}
        <button
          type="button"
          aria-expanded={adding}
          onClick={() => {
            setAdding(!adding);
            if (!adding)
              revealAfterRender(() => groupForm.current, "nearest", false);
          }}
          className="studio-button studio-button-secondary"
        >
          {adding ? (
            <X size={16} aria-hidden="true" />
          ) : (
            <Plus size={16} aria-hidden="true" />
          )}{" "}
          {adding ? "Cancel new period" : "New period"}
        </button>
        </div>
      </div>
      <div className="period-rail" role="group" aria-label="Choose a period">
        <button
          type="button"
          aria-pressed={selected === "all"}
          onClick={() => onSelect("all")}
          className="period-tile focus-ring"
        >
          <span className="period-tile-label">Overview</span>
          <strong>All periods</strong>
          <span>
            {config.tests.length} {config.tests.length === 1 ? "test" : "tests"}{" "}
            · {groups.length} {groups.length === 1 ? "period" : "periods"}
          </span>
        </button>
        {groups.map((group) => (
          <button
            key={group.period}
            type="button"
            aria-label={`Period ${group.period} seconds, ${group.tests.length} ${group.tests.length === 1 ? "test" : "tests"}`}
            aria-pressed={selected === String(group.period)}
            onClick={() => onSelect(String(group.period))}
            className="period-tile focus-ring"
          >
            <span className="period-tile-label">
              Cycle period{" "}
              {selected === String(group.period) && (
                <Check size={13} aria-hidden="true" />
              )}
            </span>
            <strong className="font-mono">
              {group.period}
              <small> s</small>
            </strong>
            <span>
              {group.tests.length} {group.tests.length === 1 ? "test" : "tests"}{" "}
              · {(1 / group.period).toPrecision(3)} Hz
            </span>
            <svg
              viewBox="0 0 120 24"
              className="period-wave"
              aria-hidden="true"
            >
              <path
                d="M0 12 C10 12 10 2 20 2 S30 22 40 22 S50 2 60 2 S70 22 80 22 S90 2 100 2 S110 12 120 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </button>
        ))}
      </div>
      <div className="period-context">
        <div>
          <strong>
            {selected === "all" ? "All periods" : `P = ${selected} s`}
          </strong>
          <p>
            {selected === "all"
              ? "Tests are organized below by cycle period."
              : `${count} ${count === 1 ? "test" : "tests"} in this period. Each keeps its own pump, observers and amplitude.`}
          </p>
        </div>
        <button
          type="button"
          disabled={config.tests.length >= 30}
          onClick={() =>
            onAddTest(
              selected === "all" ? config.pumpingPeriod : Number(selected),
            )
          }
          className="studio-button studio-button-primary"
        >
          <Plus size={16} aria-hidden="true" />{" "}
          {selected === "all"
            ? "Add pumping test"
            : `Add test at ${selected} s`}
        </button>
      </div>
      {adding && (
        <form
          ref={groupForm}
          className="studio-disclosure flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const next = addPeriodGroup(config, period);
              if (next !== config) onChange(next);
              onSelect(String(period));
              setAdding(false);
              setError("");
            } catch (cause) {
              setError((cause as Error).message);
            }
          }}
        >
          <label className="text-xs">
            New cycle period P (s)
            <NumericInput
              aria-label="New group period"
              value={period}
              onValueChange={setPeriod}
              step="any"
              min="0"
              className="studio-input mt-1 block w-full"
            />
          </label>
          <button type="submit" className="studio-button studio-button-primary">
            Create period
          </button>
          <p className="w-full text-xs text-[#566372]">
            One period is one full pumping cycle, not a logging interval. An
            existing period opens without creating a duplicate.
          </p>
          {error && (
            <p role="alert" className="w-full text-xs text-red-800">
              {error}
            </p>
          )}
        </form>
      )}
      {selected !== "all" && count === 0 && (
        <p
          className="rounded-xl border border-dashed p-4 text-sm text-[#566372]"
          role="status"
        >
          Ready for your first test at {selected} s. Add a pumping test above;
          no wells or data have been changed.
        </p>
      )}
    </section>
  );
}
