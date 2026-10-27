import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FlaskConical,
  Loader2,
  Play,
  Terminal,
} from 'lucide-react';
import { AnalysisMode, AnalysisProgress, AnalysisResult, ModelConfig } from '../../types/aquifer';
import { parseObservations, runAnalysis } from '../../api/analysis';
import { revealAfterRender } from '../../utils/scroll';
import { matchesBaselineConfiguration } from '../../utils/scientificReview';
import { RunInput, testIssues } from '../../utils/experimentWorkflow';
import { NumericInput } from '../NumericInput';

interface Props {
  config: ModelConfig;
  input: RunInput;
  existingResult: AnalysisResult | null;
  allowSynthetic: boolean;
  onChangeConfig: (config: ModelConfig) => void;
  onChangeInput: (input: RunInput) => void;
  onRunningChange: (running: boolean) => void;
  onResult: (result: AnalysisResult) => void;
  onExplore: () => void;
  onPrev: () => void;
}
type Event = { time: string; message: string };

export const Step4RunAnalysis: React.FC<Props> = ({
  config,
  input,
  existingResult,
  allowSynthetic,
  onChangeConfig,
  onChangeInput,
  onRunningChange,
  onResult,
  onExplore,
  onPrev,
}) => {
  const { csv, observationSource, analysisMode } = input;
  const setCsv = (csv: string) => onChangeInput({ ...input, csv });
  const setObservationSource = (observationSource: 'field' | 'synthetic') =>
    onChangeInput({ ...input, observationSource });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress | null>(
    existingResult
      ? {
          status: 'complete',
          stage: 'complete',
          percent: 100,
          testId: null,
          message: 'Previous completed result retained',
          result: existingResult,
          error: null,
          completedTestIds: config.tests.map((test) => test.id),
          events: [],
        }
      : null,
  );
  const [completed, setCompleted] = useState<string[]>(
    existingResult ? config.tests.map((test) => test.id) : [],
  );
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedTestId, setSelectedTestId] = useState(config.tests[0]?.id ?? '');
  const [elapsed, setElapsed] = useState(existingResult?.runtimeSeconds ?? 0);
  const [ready, setReady] = useState(!!existingResult);
  const controller = useRef<AbortController | null>(null);
  const lastEvent = useRef('');
  const consoleRef = useRef<HTMLDivElement>(null);
  const requiredPairsRef = useRef<HTMLDetailsElement>(null);
  const tests = config.tests;
  const syntheticRunLabel = matchesBaselineConfiguration(config)
    ? 'Run original P=10 inversion'
    : 'Run synthetic inversion';
  const activeTest = tests.find((test) => test.id === selectedTestId) ?? tests[0];
  const pairs = tests.flatMap((test) => test.observationWellIds.map((wellId) => ({ test, wellId })));
  let measurementError: string | null = null;
  let measurementCount = 0;
  if (analysisMode === 'measured_inversion') {
    try {
      const parsed = parseObservations(csv, config);
      measurementCount = parsed?.length ?? 0;
      if (!parsed)
        measurementError = 'Paste measured complex-head responses before starting measured inversion.';
    } catch (cause) {
      measurementError = cause instanceof Error ? cause.message : 'Check the measured CSV.';
    }
  }

  const downloadMeasurementTemplate = () => {
    // Intentionally blank values: a template must never masquerade as field data.
    const contents = [
      'testId,wellId,real,imag',
      ...pairs.map(({ test, wellId }) => `${test.id},${wellId},,`),
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'measured-phasors-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const changeDataSource = (next: AnalysisMode) => {
    if (next === analysisMode) return;
    onChangeInput({ ...input, analysisMode: next });
    setReady(false);
    setError(null);
    // Results from another data source must not remain a ready-to-explore run.
  };

  useEffect(() => {
    onRunningChange(running);
  }, [running, onRunningChange]);
  useEffect(() => {
    if (!existingResult && !running) {
      setReady(false);
      setProgress(null);
      setCompleted([]);
      setEvents([]);
      setElapsed(0);
    }
  }, [existingResult]);
  useEffect(
    () => () => {
      controller.current?.abort();
      onRunningChange(false);
    },
    [onRunningChange],
  );
  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed((Date.now() - started) / 1000), 100);
    return () => window.clearInterval(timer);
  }, [running]);
  useEffect(() => {
    const consoleElement = consoleRef.current;
    if (consoleElement) consoleElement.scrollTop = consoleElement.scrollHeight;
  }, [events]);

  const run = async () => {
    onChangeInput(input); // Invalidate an older completed result before rerunning.
    setError(null);
    setProgress(null);
    setCompleted([]);
    setEvents([]);
    setElapsed(0);
    setReady(false);
    lastEvent.current = '';
    try {
      const issues = testIssues(config);
      if (issues.length) throw new Error(issues.join(' '));
      if (measurementError) throw new Error(measurementError);
      const observations = analysisMode === 'measured_inversion' ? parseObservations(csv, config) : null;
      controller.current = new AbortController();
      setRunning(true);
      const result = await runAnalysis(
        config,
        observations,
        analysisMode,
        controller.current.signal,
        (update) => {
          setProgress(update);
          if (update.testId) setSelectedTestId(update.testId);
          setCompleted(update.completedTestIds);
          const key = `${update.stage}:${update.message}`;
          if (key !== lastEvent.current) {
            lastEvent.current = key;
            setEvents(update.events.map((message) => ({ time: new Date().toLocaleTimeString(), message })));
          }
        },
      );
      onResult({ ...result, ...(analysisMode === 'measured_inversion' ? { observationSource } : {}) });
      setReady(true);
    } catch (cause) {
      if ((cause as Error).name !== 'AbortError')
        setError(cause instanceof Error ? cause.message : 'Analysis failed');
    } finally {
      setRunning(false);
      controller.current = null;
    }
  };

  const mapSize = 260,
    padding = 28;
  const sx = (x: number) =>
    padding + ((x - config.minX) / (config.maxX - config.minX)) * (mapSize - 2 * padding);
  const sy = (y: number) =>
    mapSize - padding - ((y - config.minY) / (config.maxY - config.minY)) * (mapSize - 2 * padding);

  return (
    <div className="max-w-6xl mx-auto space-y-5 py-2">
      <div className="bg-white border border-[#D6DADD] rounded-xl p-5 flex flex-wrap justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-[#C5050C] mb-1">Step 4 · Python solver</div>
          <h2 className="text-xl font-bold">
            Run {config.testCase === 'black_kipp' ? 'Black–Kipp comparison' : 'multi-test tomography'}
          </h2>
          <p className="text-xs text-[#4B4F52] mt-1">
            {tests.length} pumping tests · {pairs.length} observation responses. Progress below comes from
            completed solver stages.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-[#4B4F52]">
          <Clock3 size={15} /> {elapsed.toFixed(1)} s elapsed
        </div>
      </div>

      {config.testCase !== 'black_kipp' && (
        <div className="bg-white border border-[#D6DADD] rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <FlaskConical size={18} className="text-[#C5050C]" />
            <h3 className="font-bold text-sm">Analysis data source</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-2" role="radiogroup" aria-label="Analysis data source">
            {(
              [
                [
                  'synthetic_demo',
                  'Synthetic field recovery',
                  'Generate checkerboard or geostatistical truth, then jointly invert its responses. Synthetic testing, not field validation.',
                ],
                [
                  'forward',
                  'Forward prediction',
                  'Calculate well responses from a homogeneous model or a chosen synthetic field. Transfer the output to inversion later.',
                ],
                [
                  'measured_inversion',
                  'Measured inversion / imported phasors',
                  'Invert a complete complex-response CSV: field measurements or clearly identified synthetic forward data.',
                ],
              ] as const
            )
              .filter(([value]) => value !== 'synthetic_demo' || allowSynthetic)
              .map(([value, label, description]) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={analysisMode === value}
                  disabled={running}
                  onClick={() => changeDataSource(value)}
                  key={value}
                  className={`text-left rounded-lg border p-3 transition ${analysisMode === value ? 'border-[#C5050C] bg-[#FEF2F2] ring-1 ring-[#C5050C]' : 'border-[#D6DADD] hover:border-[#A7ADB1]'}`}
                >
                  <strong className="block text-xs">{label}</strong>
                  <span className="block mt-1 text-[11px] leading-4 text-[#5F6368]">{description}</span>
                </button>
              ))}
          </div>
          {analysisMode !== 'measured_inversion' && (
            <fieldset disabled={running} className="rounded-lg border bg-[#F7F7F7] p-4 space-y-3">
              <legend className="px-1 text-xs font-bold">Generating model · MATLAB test fields</legend>
              <label className="block text-xs font-semibold">
                Field type
                <select
                  aria-label="Synthetic field type"
                  value={
                    config.syntheticField ??
                    (analysisMode === 'synthetic_demo' ? 'checkerboard' : 'homogeneous')
                  }
                  onChange={(e) => {
                    onChangeConfig({
                      ...config,
                      syntheticField:
                        e.target.value === 'homogeneous'
                          ? undefined
                          : (e.target.value as ModelConfig['syntheticField']),
                    });
                    setReady(false);
                  }}
                  className="mt-1 block w-full rounded-lg border bg-white p-2.5 focus-ring"
                >
                  {analysisMode === 'forward' && (
                    <option value="homogeneous">Homogeneous · configured initial ln(K) / ln(Ss)</option>
                  )}
                  <option value="checkerboard">Checkerboard · original synthetic baseline</option>
                  <option value="geostatistical">Geostatistical · correlated random field</option>
                </select>
              </label>
              {(config.syntheticField || analysisMode === 'synthetic_demo') && (
                <>
                  <p className="text-xs text-[#4B4F52]">
                    Generating means: ln(K) = −9.2, ln(Ss) = −11.2. These truth fields are separate from the
                    inversion starting model and its covariance priors.
                  </p>
                  {config.syntheticField === 'geostatistical' ? (
                    <>
                      <label className="block text-xs">
                        Random seed (integer, 0–4294967295)
                        <NumericInput
                          aria-label="Synthetic field random seed"
                          value={config.syntheticSeed ?? 0}
                          onValueChange={(value) => onChangeConfig({ ...config, syntheticSeed: value })}
                          min="0"
                          max="4294967295"
                          step="1"
                          className="mt-1 block rounded border bg-white p-2 font-mono focus-ring"
                        />
                      </label>
                      <p className="text-xs text-[#4B4F52]">
                        Exponential spatial covariance; correlation lengths 20 m in x/y; variances 4 for
                        ln(K), 0.1 for ln(Ss). Uses the translated MATLAB realization routine with NumPy RNG.
                        Same seed + grid reproduces the Python field, not MATLAB's random numbers.
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-[#4B4F52]">
                      Checker lengths: 10 m in x/y; ln(K) jumps ±1, ln(Ss) jumps ±0.05, matching the original
                      test.
                    </p>
                  )}
                </>
              )}
            </fieldset>
          )}
          {analysisMode === 'measured_inversion' && (
            <>
              <p className="text-xs text-slate-700">
                Supply steady-periodic complex hydraulic-head responses (real and imaginary parts in meters),
                referenced to the same pumping signal and phase convention as the model. Raw transducer time
                series must be processed first. To practice with synthetic data, run Forward prediction and
                export its inversion-input CSV; reuse the same configuration here.
              </p>
              <label className="block text-xs font-semibold">
                Imported data origin
                <select
                  disabled={running}
                  value={observationSource}
                  onChange={(event) => {
                    setObservationSource(event.target.value as 'field' | 'synthetic');
                    setReady(false);
                  }}
                  className="block border rounded mt-1 p-2 bg-white"
                >
                  <option value="field">Field measurements</option>
                  <option value="synthetic">Synthetic forward-model predictions</option>
                </select>
              </label>
              <label className="block text-xs font-semibold">
                Import phasor CSV
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  disabled={running}
                  className="block mt-1 text-xs"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    try {
                      setCsv(await file.text());
                      setReady(false);
                      setError(null);
                    } catch {
                      setError('Could not read the selected CSV file.');
                    }
                  }}
                />
              </label>
              <button
                type="button"
                disabled={running}
                onClick={downloadMeasurementTemplate}
                className="border rounded px-3 py-2 text-xs focus-ring"
              >
                Download blank measurement CSV template
              </button>
              <textarea
                aria-label="Measured phasors CSV"
                aria-describedby="measurement-readiness"
                className="w-full min-h-28 border border-[#A7ADB1] rounded-md p-3 font-mono text-xs focus-ring"
                placeholder={'testId,wellId,real,imag\ntest-1,w-2,0.001,-0.002'}
                value={csv}
                onChange={(event) => {
                  setCsv(event.target.value);
                  setReady(false);
                }}
                disabled={running}
              />
              <p
                id="measurement-readiness"
                className={`text-xs ${measurementError ? 'text-amber-900' : 'text-green-800'}`}
              >
                {measurementError ??
                  `${measurementCount}/${pairs.length} required responses validated. Check units and phase reference before running.`}
              </p>
              <details
                ref={requiredPairsRef}
                tabIndex={-1}
                onToggle={(event) => {
                  if (event.currentTarget.open) revealAfterRender(() => requiredPairsRef.current, 'start');
                }}
                className="text-xs outline-none"
              >
                <summary className="cursor-pointer font-semibold">Required pair IDs ({pairs.length})</summary>
                <div className="mt-2 max-h-32 overflow-auto font-mono">
                  {pairs.map(({ test, wellId }) => (
                    <div key={`${test.id}-${wellId}`}>
                      {test.id},{wellId},real,imag
                    </div>
                  ))}
                </div>
              </details>
            </>
          )}
        </div>
      )}

      <div data-tour="run-progress" className="bg-[#121212] rounded-xl p-5 text-white space-y-4" aria-live="polite">
        <div className="flex flex-wrap justify-between gap-2">
          <div>
            <div className="text-xs text-[#F87171] font-bold uppercase">
              {progress?.stage ?? 'Ready to run'}
            </div>
            <h3 className="font-bold">Experiment progress</h3>
          </div>
          <div className="text-lg font-mono font-bold">{progress ? `${progress.percent}%` : '—'}</div>
        </div>
        <div
          className="h-3 bg-[#333] rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={progress?.percent ?? 0}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-[#C5050C] transition-all duration-500"
            style={{ width: `${progress?.percent ?? 0}%` }}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div className="bg-[#1B1B1B] border border-[#303030] rounded-lg p-3">
            <div className="font-bold mb-2">
              1. Test execution · {completed.length}/{tests.length}
            </div>
            <div className="h-2 bg-[#080808] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#C5050C] rounded-full transition-all duration-500"
                style={{ width: `${(100 * completed.length) / Math.max(1, tests.length)}%` }}
              />
            </div>
            <div className="text-[#AEB3B7] mt-2">
              {pairs.length} complex responses across {tests.length} pumping configurations
            </div>
          </div>
          <div className="bg-[#1B1B1B] border border-[#303030] rounded-lg p-3">
            <div className="font-bold mb-2">2. Active computation</div>
            <div className="h-2 bg-[#080808] rounded-full overflow-hidden">
              <div
                className={`h-full bg-[#4169E1] rounded-full ${running ? 'solver-pulse-bar' : ''}`}
                style={{ width: running ? '70%' : ready ? '100%' : '0%' }}
              />
            </div>
            <div className="text-[#AEB3B7] mt-2">
              {progress?.message ?? 'Waiting for you to start the solver'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-5">
        <div className="bg-white border border-[#D6DADD] rounded-xl p-4">
          <h3 className="text-sm font-bold mb-3">Test execution queue</h3>
          <div className="space-y-2 max-h-80 overflow-auto">
            {tests.map((test, index) => {
              const done = completed.includes(test.id);
              const active = running && progress?.testId === test.id && !done;
              return (
                <button
                  key={test.id}
                  type="button"
                  onClick={() => setSelectedTestId(test.id)}
                  className={`w-full text-left flex items-center justify-between gap-2 border rounded-lg p-3 text-xs transition ${active ? 'border-[#111] bg-[#111] text-white shadow-md' : selectedTestId === test.id ? 'border-[#C5050C] bg-[#FEF2F2]' : 'border-[#D6DADD]'}`}
                >
                  <span className="flex items-center gap-2">
                    <span className="font-mono font-bold">{index + 1}.</span>
                    <span>
                      <strong>{test.name}</strong>
                      <br />
                      <span className="text-[#6B7074]">
                        Pump {config.wells.find((well) => well.id === test.pumpingWellId)?.name} →{' '}
                        {test.observationWellIds.length}{' '}
                        {test.observationWellIds.length === 1 ? 'observer' : 'observers'} · P=
                        {test.pumpingPeriod ?? config.pumpingPeriod}s
                      </span>
                    </span>
                  </span>
                  <span className="whitespace-nowrap">
                    {done ? (
                      <CheckCircle2 size={17} className="text-green-700" aria-label="Complete" />
                    ) : active ? (
                      <Loader2 size={17} className="animate-spin text-[#C5050C]" aria-label="Running" />
                    ) : (
                      'Queued'
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 text-xs font-bold mb-2">
            <Activity size={15} className="text-[#C5050C]" /> {activeTest?.name} well diagram
          </div>
          <svg
            viewBox={`0 0 ${mapSize} ${mapSize}`}
            className="w-full"
            role="img"
            aria-label={`Pumping and observation wells for ${activeTest?.name}`}
          >
            <rect
              x={padding}
              y={padding}
              width={mapSize - 2 * padding}
              height={mapSize - 2 * padding}
              fill="#181818"
              stroke="#555"
            />
            {config.wells.map((well) => {
              const pump = well.id === activeTest?.pumpingWellId;
              const observe = activeTest?.observationWellIds.includes(well.id);
              return (
                <g key={well.id}>
                  {pump && running && (
                    <>
                      <circle
                        className="animate-hydraulic-wave-1"
                        cx={sx(well.x)}
                        cy={sy(well.y)}
                        r="6"
                        fill="none"
                        stroke="#F87171"
                      />
                      <circle
                        className="animate-hydraulic-wave-2"
                        cx={sx(well.x)}
                        cy={sy(well.y)}
                        r="6"
                        fill="none"
                        stroke="#F87171"
                      />
                      <circle
                        className="animate-hydraulic-wave-3"
                        cx={sx(well.x)}
                        cy={sy(well.y)}
                        r="6"
                        fill="none"
                        stroke="#F87171"
                      />
                    </>
                  )}
                  <circle
                    cx={sx(well.x)}
                    cy={sy(well.y)}
                    r={pump ? 7 : 5}
                    fill={pump ? '#C5050C' : observe ? '#4169E1' : '#777'}
                    stroke="white"
                    strokeWidth="1.5"
                  />
                  <text x={sx(well.x) + 9} y={sy(well.y) - 7} fill="white" fontSize="10">
                    {well.name}
                    {pump ? ' pump' : ''}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="flex gap-4 text-[10px] text-[#CCC]">
            <span className="flex items-center gap-1">
              <i className="w-2 h-2 rounded-full bg-[#C5050C]" /> Pumping
            </span>
            <span className="flex items-center gap-1">
              <i className="w-2 h-2 rounded-full bg-[#2563EB]" /> Observation
            </span>
          </div>
        </div>
      </div>

      <div className="bg-[#0A0A0A] rounded-xl text-white overflow-hidden">
        <div className="bg-[#181818] p-3 flex gap-2 text-xs font-bold">
          <Terminal size={16} className="text-[#C5050C]" /> Execution console ({events.length} events)
        </div>
        <div
          ref={consoleRef}
          className="p-3 font-mono text-xs max-h-44 overflow-auto"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Solver events"
        >
          {events.length ? (
            events.map((event, index) => (
              <div key={index} className="py-1">
                <span className="text-[#6B7280]">[{event.time}]</span>{' '}
                <span className="text-[#F87171]">[{index === events.length - 1 ? 'ACTIVE' : 'DONE'}]</span>{' '}
                <span className="text-[#E5E7EB]">{event.message}</span>
              </div>
            ))
          ) : (
            <span className="text-[#888]">No solver events yet.</span>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-[#9B0000] bg-[#FEF2F2] p-3 rounded-md">
          {error}
        </p>
      )}
      <div className="flex justify-between gap-3">
        <button
          onClick={onPrev}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 border rounded-md text-sm disabled:opacity-50"
        >
          <ArrowLeft size={16} /> Back to review
        </button>
        <div className="flex gap-2">
          <button
            onClick={run}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#C5050C] text-white font-semibold text-sm disabled:opacity-50"
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {running
              ? 'Solving…'
              : ready
                ? 'Run again'
                : config.testCase === 'black_kipp'
                  ? 'Run comparison'
                  : analysisMode === 'synthetic_demo'
                    ? syntheticRunLabel
                    : analysisMode === 'measured_inversion'
                      ? observationSource === 'synthetic' ? 'Run imported-data inversion' : 'Run measured inversion'
                      : 'Run forward model'}
          </button>
          {ready && (
            <button
              onClick={onExplore}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#15803D] text-white font-semibold text-sm"
            >
              Explore results <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
