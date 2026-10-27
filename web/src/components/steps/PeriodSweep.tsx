import React, { useState } from 'react';
import { ModelConfig } from '../../types/aquifer';
import { makePeriods, PeriodSampling, sweepTests, wellSetups } from '../../utils/periodSweep';
import { NumericInput } from '../NumericInput';

export function PeriodSweep({
  config,
  onApply,
  activeTestId,
}: {
  config: ModelConfig;
  onApply: (config: ModelConfig) => void;
  activeTestId: string;
}) {
  const blackKipp = config.testCase === 'black_kipp';
  const [mode, setMode] = useState<PeriodSampling>(blackKipp ? 'logarithmic' : 'list');
  const [start, setStart] = useState(10),
    [end, setEnd] = useState(blackKipp ? 10000 : 50);
  const [interval, setInterval] = useState(10),
    [count, setCount] = useState(20);
  const [list, setList] = useState('10, 50');
  const [target, setTarget] = useState(blackKipp ? 'active' : 'all');
  const [amplitudeMode, setAmplitudeMode] = useState<'rate' | 'volume'>('rate');
  const [amplitude, setAmplitude] = useState(config.pumpingRate);
  const [message, setMessage] = useState('');
  const setups = wellSetups(
    target === 'all' ? config.tests : config.tests.filter((test) => test.id === activeTestId),
  );
  let periods: number[] = [],
    error = '',
    generated: ReturnType<typeof sweepTests> = [];
  try {
    periods = makePeriods(mode, start, end, interval, count, list);
    generated = sweepTests(config, setups, periods, amplitude, amplitudeMode, 'preview');
  } catch (cause) {
    error = (cause as Error).message;
  }
  const inputClass =
    'mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 font-mono text-xs focus-ring';
  return (
    <section
      className="rounded-xl border border-slate-300 bg-white p-4 space-y-3"
      aria-label="Multi-period experiment builder"
    >
      <h3 className="font-bold text-sm">Period sweep · same well setup, multiple periods</h3>
      <p className="text-xs text-slate-600">
        Assign pumping/observation wells in the cards below first. Then generate period tests for those
        assignments. Nothing changes until you apply.
      </p>
      <div className="grid sm:grid-cols-2 gap-3 text-xs">
        <label>
          Well setups
          <select className={inputClass} value={target} onChange={(event) => setTarget(event.target.value)}>
            <option value="all">All distinct current well setups</option>
            <option value="active">Selected test’s well setup only</option>
          </select>
        </label>
        <label>
          Period sampling
          <select
            className={inputClass}
            value={mode}
            onChange={(event) => setMode(event.target.value as PeriodSampling)}
          >
            <option value="logarithmic">Logarithmic range (sample count)</option>
            <option value="linear">Linear range (increment in seconds)</option>
            <option value="list">Explicit period list</option>
          </select>
        </label>
        {mode === 'list' ? (
          <label className="sm:col-span-2">
            Periods (s), comma-separated
            <input className={inputClass} value={list} onChange={(event) => setList(event.target.value)} />
          </label>
        ) : (
          <>
            <label>
              Minimum period (s)
              <NumericInput
                min="0"
                step="any"
                className={inputClass}
                value={start}
                onValueChange={setStart}
              />
            </label>
            <label>
              Maximum period (s)
              <NumericInput min="0" step="any" className={inputClass} value={end} onValueChange={setEnd} />
            </label>
            {mode === 'linear' ? (
              <label>
                Period increment (s)
                <NumericInput
                  min="0"
                  step="any"
                  className={inputClass}
                  value={interval}
                  onValueChange={setInterval}
                />
              </label>
            ) : (
              <label>
                Number of samples
                <NumericInput
                  min="2"
                  max="30"
                  className={inputClass}
                  value={count}
                  onValueChange={setCount}
                />
              </label>
            )}
          </>
        )}
        <label>
          Amplitude rule
          <select
            className={inputClass}
            value={amplitudeMode}
            onChange={(event) => {
              const next = event.target.value as 'rate' | 'volume';
              setAmplitudeMode(next);
              setAmplitude(next === 'volume' ? 0.01 : config.pumpingRate);
            }}
          >
            <option value="rate">Fixed peak pumping rate Qmax</option>
            <option value="volume">Fixed cycling volume V (MATLAB rule)</option>
          </select>
        </label>
        <label>
          {amplitudeMode === 'rate' ? 'Peak pumping amplitude Qmax (m³/s)' : 'Cycling volume V (m³)'}
          <NumericInput
            min="0"
            step="any"
            className={inputClass}
            value={amplitude}
            onValueChange={setAmplitude}
          />
        </label>
      </div>
      <p className="text-xs text-slate-600">
        P is one complete pumping cycle, not the logger sampling interval or test duration; frequency f = 1/P.
        Qmax is peak rate, not peak-to-peak. Fixed-volume mode uses Qmax = πV/P, matching the original
        MATLAB/Python example.
      </p>
      {error ? (
        <p role="alert" className="text-xs text-red-800">
          {error}
        </p>
      ) : (
        <div className="text-xs rounded-lg bg-slate-50 border p-3 space-y-1">
          <strong>
            {setups.length} well setups × {periods.length} periods → {generated.length} tests ·{' '}
            {generated.reduce((sum, test) => sum + test.observationWellIds.length, 0)} response pairs
          </strong>
          <p className="break-words">
            Periods (s): {periods.map((period) => Number(period.toPrecision(6))).join(', ')}
          </p>
          <p>
            Range endpoints are included. Applying replaces the current test list; well locations, grid, and
            boundaries stay unchanged.
          </p>
        </div>
      )}
      <button
        type="button"
        disabled={!!error}
        className="rounded-lg bg-[#C5050C] px-4 py-2 text-xs font-bold text-white disabled:opacity-40 focus-ring"
        onClick={() => {
          if (
            !window.confirm(
              `Replace ${config.tests.length} current tests with ${generated.length} period tests? Well locations and model settings will not change.`,
            )
          )
            return;
          const tests = sweepTests(
            config,
            setups,
            periods,
            amplitude,
            amplitudeMode,
            `sweep-${crypto.randomUUID()}`,
          );
          onApply({ ...config, tests, periodGroups: [] });
          setMessage(`Applied ${tests.length} tests. Review each setup below before proceeding.`);
        }}
      >
        Apply period sweep
      </button>
      {message && (
        <p role="status" className="text-xs text-green-800">
          {message}
        </p>
      )}
    </section>
  );
}
