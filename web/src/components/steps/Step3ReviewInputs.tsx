import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Layers,
  Activity,
  HardDrive,
  FlaskConical,
  Edit2,
  ChevronDown,
  ChevronUp,
  MapPin,
  Clock,
  Radio,
} from 'lucide-react';
import { ModelConfig, ValidationIssue, TomographyTest } from '../../types/aquifer';
import { revealAfterRender } from '../../utils/scroll';

interface Step3Props {
  config: ModelConfig;
  selectedTestId?: string;
  onChangeSelectedTestId?: (id: string) => void;
  onEditTest?: (testId: string) => void;
  onNext: () => void;
  onPrev: () => void;
}

export const Step3ReviewInputs: React.FC<Step3Props> = ({
  config,
  selectedTestId: propSelectedTestId,
  onChangeSelectedTestId,
  onEditTest,
  onNext,
  onPrev,
}) => {
  const {
    testCase,
    minX,
    maxX,
    minY,
    maxY,
    gridNx,
    gridNy,
    pumpingPeriod,
    pumpingRate,
    wells = [],
    tests = [],
  } = config;

  const [expandedTestId, setExpandedTestId] = useState<string>(
    propSelectedTestId || tests[0]?.id || 'test-1'
  );
  const testCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handleToggleTest = (testId: string, isExpanded: boolean) => {
    setExpandedTestId(isExpanded ? '' : testId);
    onChangeSelectedTestId?.(testId);
    if (!isExpanded) revealAfterRender(() => testCardRefs.current[testId], 'start');
  };

  const dx = (maxX - minX) / gridNx;
  const dy = (maxY - minY) / gridNy;
  const totalCells = gridNx * gridNy;
  const unknownParams = totalCells * 2;

  // Experiment level metrics
  const uniquePumpingWellIds = Array.from(
    new Set(tests.map((t) => t.pumpingWellId).filter(Boolean))
  );
  const totalPumpingObsPairs = tests.reduce(
    (acc, t) => acc + (t.observationWellIds?.length || 0),
    0
  );
  const timeSteps = 2; // Real and imaginary components per complex response.
  const totalObs = totalPumpingObsPairs * timeSteps;

  const jacobianEntries = totalObs * unknownParams;
  const bytesPerFloat = 8;
  const estimatedMemoryMB = Math.round((jacobianEntries * bytesPerFloat / (1024 * 1024)) * 10) / 10;

  const issues: ValidationIssue[] = [];

  // Domain boundary validation
  wells.forEach((w) => {
    if (w.x < minX + dx / 2 || w.x > maxX - dx / 2 || w.y < minY + dy / 2 || w.y > maxY - dy / 2) {
      issues.push({
        id: `well-out-${w.id}`,
        type: 'error',
        title: `Well '${w.name}' Outside Model Domain`,
        message: `Coordinates (${w.x}m, ${w.y}m) must lie within the outer grid cell centers.`,
      });
    }
  });

  if (gridNx < 3 || gridNy < 3 || gridNx > 60 || gridNy > 60) {
    issues.push({
      id: 'invalid-grid',
      type: 'error',
      title: 'Invalid Grid Dimensions',
      message: 'The current API supports 3–60 cells along each axis.',
    });
  }

  // Multi-test validations
  const wellIds = new Set(wells.map((well) => well.id));
  if (wellIds.size !== wells.length || new Set(tests.map((test) => test.id)).size !== tests.length) {
    issues.push({ id: 'duplicate-ids', type: 'error', title: 'Duplicate IDs', message: 'Every well and test must have a unique ID.' });
  }
  if (!tests || tests.length === 0) {
    issues.push({
      id: 'missing-tests',
      type: 'error',
      title: 'No Tomography Tests Configured',
      message: 'At least one pumping test is required before running analysis.',
    });
  } else {
    tests.forEach((t) => {
      if (!t.pumpingWellId || !wellIds.has(t.pumpingWellId)) {
        issues.push({
          id: `test-no-pump-${t.id}`,
          type: 'error',
          title: `Test '${t.name}' Missing Pumping Well`,
          message: 'Each test must have exactly one pumping well selected.',
        });
      }
      if (!t.observationWellIds || t.observationWellIds.length === 0 || t.observationWellIds.some((id) => !wellIds.has(id))) {
        issues.push({
          id: `test-no-obs-${t.id}`,
          type: 'error',
          title: `Test '${t.name}' Missing Observation Wells`,
          message: 'At least 1 observation well is required per test.',
        });
      }
      if (t.observationWellIds?.includes(t.pumpingWellId)) {
        issues.push({
          id: `test-conflict-${t.id}`,
          type: 'error',
          title: `Test '${t.name}' Conflicting Selection`,
          message: 'Pumping well cannot also be selected as an observation well.',
        });
      }
      if (new Set(t.observationWellIds).size !== t.observationWellIds.length || (t.pumpingPeriod ?? pumpingPeriod) <= 0 || (t.pumpingRate ?? pumpingRate) <= 0) {
        issues.push({ id: `test-values-${t.id}`, type: 'error', title: `Invalid values in ${t.name}`, message: 'Observation wells must be unique, and period and pumping rate must be positive.' });
      }
    });
  }

  if (pumpingPeriod <= 0 || pumpingRate <= 0) {
    issues.push({
      id: 'nonpositive-test',
      type: 'error',
      title: 'Nonpositive Pumping Parameters',
      message: 'Pumping period and pumping rate must be strictly greater than zero.',
    });
  }

  if (totalPumpingObsPairs > 100) {
    issues.push({ id: 'too-many-pairs', type: 'error', title: 'Too Many Responses', message: 'The current API supports at most 100 test/observation pairs.' });
  }

  if (config.boundaries.top !== 'no_flow' || config.boundaries.bottom !== 'no_flow' ||
      !(['west', 'east', 'south', 'north'] as const).some((side) => config.boundaries[side] === 'constant_head')) {
    issues.push({ id: 'boundaries', type: 'error', title: 'Unsupported Boundaries', message: 'Use no-flow top and bottom and at least one horizontal constant-head boundary.' });
  }

  if (estimatedMemoryMB > 100) {
    issues.push({
      id: 'high-memory',
      type: 'warning',
      title: 'High Memory Allocation Warning',
      message: `The raw sensitivity matrix is about ${estimatedMemoryMB} MB; solver memory usage will be higher.`,
    });
  } else {
    issues.push({
      id: 'optimal-memory',
      type: 'info',
      title: 'Optimal Resource Footprint',
      message: `The raw sensitivity matrix would be about ${estimatedMemoryMB} MB if an inversion is run.`,
    });
  }

  const hasErrors = issues.some((i) => i.type === 'error');

  // Mini SVG Map for Expanded Test Cards
  const renderSmallTestMap = (test: TomographyTest) => {
    const width = 180;
    const height = 180;
    const pad = 25;
    const plotW = width - 2 * pad;
    const plotH = height - 2 * pad;

    const toSvgX = (x: number) => pad + ((x - minX) / (maxX - minX || 1)) * plotW;
    const toSvgY = (y: number) => height - pad - ((y - minY) / (maxY - minY || 1)) * plotH;

    const pWell = wells.find((w) => w.id === test.pumpingWellId);

    return (
      <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg p-1.5 flex flex-col items-center">
        <svg width={width} height={height} className="select-none">
          <rect x={pad} y={pad} width={plotW} height={plotH} fill="#181818" stroke="#333333" strokeWidth="1.5" />
          {wells.map((w) => {
            const cx = toSvgX(w.x);
            const cy = toSvgY(w.y);
            const isPump = w.id === test.pumpingWellId;
            const isObs = test.observationWellIds?.includes(w.id);

            if (isPump) {
              return (
                <g key={w.id}>
                  <polygon
                    points={`${cx},${cy - 7} ${cx + 6},${cy + 5} ${cx - 6},${cy + 5}`}
                    fill="#C5050C"
                    stroke="#ffffff"
                    strokeWidth="1.2"
                  />
                  <text x={cx} y={cy - 9} fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">
                    {w.name}
                  </text>
                </g>
              );
            }

            if (isObs) {
              return (
                <g key={w.id}>
                  <circle cx={cx} cy={cy} r="4.5" fill="#2563EB" stroke="#ffffff" strokeWidth="1.2" />
                  <text x={cx + 7} y={cy + 3} fill="#ffffff" fontSize="8" fontWeight="bold">
                    {w.name}
                  </text>
                </g>
              );
            }

            return (
              <g key={w.id} className="opacity-30">
                <circle cx={cx} cy={cy} r="3.5" fill="none" stroke="#6B7074" strokeWidth="1" strokeDasharray="2,2" />
                <text x={cx + 6} y={cy + 2} fill="#888888" fontSize="8">
                  {w.name}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="flex items-center space-x-3 text-[9px] text-[#A7ADB1] mt-1 font-mono">
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 bg-[#C5050C] rounded-xs inline-block" />
            <span>Pump ({pWell?.name || 'N/A'})</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 bg-[#2563EB] rounded-full inline-block" />
            <span>Obs ({test.observationWellIds?.length || 0})</span>
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-2">
      {/* Header */}
      <div className="bg-white border border-[#D6DADD] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-[#121212] tracking-tight">
            Step 3: Review Model Inputs & Validation
          </h2>
          <p className="text-xs text-[#4B4F52] mt-0.5">
            Verify experiment-level parameters, test role assignments, physical units, and computing resources before running the solver.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onPrev}
            className="flex items-center space-x-1 bg-white hover:bg-[#F1F2F3] text-[#121212] border border-[#D6DADD] text-xs font-semibold px-3 py-1.5 rounded transition focus-ring"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Config</span>
          </button>
          <button
            onClick={onNext}
            disabled={hasErrors}
            className={`flex items-center space-x-1.5 text-xs font-bold px-5 py-2 rounded shadow-xs transition focus-ring ${
              hasErrors
                ? 'bg-[#E1E5E7] text-[#6B7074] cursor-not-allowed'
                : 'bg-[#C5050C] hover:bg-[#9B0000] text-white'
            }`}
          >
            <span>Proceed to Run Analysis</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* REQUIREMENT 2: Experiment-Level Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#D6DADD] rounded-xl p-4 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-[#FEF2F2] text-[#C5050C] border border-[#FECDD3] flex items-center justify-center font-bold">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-[#6B7074]">Total Physical Wells</div>
            <div className="text-lg font-black text-[#121212] font-mono">{wells.length} Wells</div>
          </div>
        </div>

        <div className="bg-white border border-[#D6DADD] rounded-xl p-4 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] flex items-center justify-center font-bold">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-[#6B7074]">Total Tests</div>
            <div className="text-lg font-black text-[#121212] font-mono">{tests.length} Tests</div>
          </div>
        </div>

        <div className="bg-white border border-[#D6DADD] rounded-xl p-4 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0] flex items-center justify-center font-bold">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-[#6B7074]">Unique Pumping Wells</div>
            <div className="text-lg font-black text-[#121212] font-mono">{uniquePumpingWellIds.length} Wells</div>
          </div>
        </div>

        <div className="bg-white border border-[#D6DADD] rounded-xl p-4 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-[#FAF5FF] text-[#7E22CE] border border-[#E9D5FF] flex items-center justify-center font-bold">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-[#6B7074]">Pump–Obs Pairs</div>
            <div className="text-lg font-black text-[#121212] font-mono">{totalPumpingObsPairs} Pairs</div>
          </div>
        </div>
      </div>

      {/* Validation Banners */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#4B4F52]">
          Validation & Readiness Check
        </h3>
        <div className="space-y-2">
          {issues.map((issue) => (
            <div
              key={issue.id}
              className={`p-3.5 rounded-lg border flex items-start space-x-3 text-xs ${
                issue.type === 'error'
                  ? 'bg-[#FEE2E2] border-[#FCA5A5] text-[#991B1B]'
                  : issue.type === 'warning'
                  ? 'bg-[#FEF3C7] border-[#FDE68A] text-[#92400E]'
                  : 'bg-[#DCFCE7] border-[#86EFAC] text-[#166534]'
              }`}
            >
              {issue.type === 'error' ? (
                <XCircle className="w-5 h-5 text-[#B91C1C] flex-shrink-0 mt-0.5" />
              ) : issue.type === 'warning' ? (
                <AlertTriangle className="w-5 h-5 text-[#D97706] flex-shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-[#15803D] flex-shrink-0 mt-0.5" />
              )}

              <div>
                <div className="font-bold">{issue.title}</div>
                <div className="mt-0.5 text-[11px] opacity-90">{issue.message}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* REQUIREMENT 2: Per-Test Accordion / List with Small Well Map & Edit Action */}
      <div className="bg-white border border-[#D6DADD] rounded-xl p-4 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#D6DADD] pb-3">
          <div className="flex items-center space-x-2">
            <FlaskConical className="w-4 h-4 text-[#C5050C]" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#121212]">
              Configured Test Cards ({tests.length})
            </h3>
          </div>
          <span className="text-[11px] font-mono text-[#6B7074]">
            Click card to expand parameters and well role map
          </span>
        </div>

        <div className="space-y-3">
          {tests.map((test, index) => {
            const isExpanded = expandedTestId === test.id;
            const pumpingWell = wells.find((w) => w.id === test.pumpingWellId);
            const obsWells = wells.filter((w) => test.observationWellIds?.includes(w.id));

            const testP = test.pumpingPeriod || pumpingPeriod || 10;
            const testQ = test.pumpingRate || pumpingRate || 0.002;
            const freqHz = (1 / testP).toFixed(3);

            const isTestValid =
              test.pumpingWellId &&
              test.observationWellIds?.length > 0 &&
              !test.observationWellIds.includes(test.pumpingWellId);

            return (
              <div
                key={test.id}
                ref={(element) => { testCardRefs.current[test.id] = element; }}
                tabIndex={-1}
                className={`bg-white border rounded-xl overflow-hidden transition shadow-xs ${
                  isExpanded ? 'border-[#121212] ring-2 ring-[#121212]/10' : 'border-[#D6DADD]'
                }`}
              >
                {/* Accordion Header */}
                <div
                  onClick={() => handleToggleTest(test.id, isExpanded)}
                  className={`p-3.5 flex items-center justify-between cursor-pointer border-b text-xs transition ${
                    isExpanded ? 'bg-[#121212] text-white' : 'bg-[#F7F7F7] text-[#121212] hover:bg-[#F1F2F3]'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs ${
                        isExpanded ? 'bg-[#C5050C] text-white' : 'bg-[#E1E5E7] text-[#121212]'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div>
                      <div className="font-bold text-sm flex items-center space-x-2">
                        <span>{test.name}</span>
                        <span
                          className={`text-[10px] font-mono font-normal px-2 py-0.2 rounded border ${
                            isTestValid
                              ? isExpanded
                                ? 'bg-emerald-900/40 border-emerald-500 text-emerald-300'
                                : 'bg-[#DCFCE7] border-[#86EFAC] text-[#15803D]'
                              : 'bg-[#FEF2F2] border-[#FECDD3] text-[#B91C1C]'
                          }`}
                        >
                          {isTestValid ? 'Valid' : 'Invalid'}
                        </span>
                      </div>
                      <div className={`text-[11px] font-mono mt-0.5 ${isExpanded ? 'text-[#A7ADB1]' : 'text-[#6B7074]'}`}>
                        Pump: <strong className={isExpanded ? 'text-white' : 'text-[#121212]'}>{pumpingWell?.name || 'N/A'}</strong> &bull; Obs: <strong className={isExpanded ? 'text-white' : 'text-[#121212]'}>{obsWells.length} wells</strong> ({obsWells.map(w => w.name).join(', ') || 'None'})
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditTest?.(test.id);
                      }}
                      className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-semibold border transition ${
                        isExpanded
                          ? 'bg-[#2A2A2A] hover:bg-[#3A3A3A] text-white border-[#3A3A3A]'
                          : 'bg-white hover:bg-[#F1F2F3] text-[#121212] border-[#D6DADD]'
                      }`}
                      title="Edit this test in Step 2"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-[#C5050C]" />
                      <span>Edit Test</span>
                    </button>

                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {/* Expanded Accordion Body */}
                {isExpanded && (
                  <div className="p-4 bg-white grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
                    {/* Test Info Parameters (8 cols) */}
                    <div className="lg:col-span-8 space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="bg-[#F7F7F7] border border-[#D6DADD] p-2.5 rounded-lg space-y-0.5">
                          <span className="text-[10px] font-bold uppercase text-[#6B7074]">Pumping Well</span>
                          <div className="font-bold text-sm text-[#C5050C]">
                            {pumpingWell ? `${pumpingWell.name} (${pumpingWell.x}m, ${pumpingWell.y}m)` : 'None'}
                          </div>
                        </div>

                        <div className="bg-[#F7F7F7] border border-[#D6DADD] p-2.5 rounded-lg space-y-0.5">
                          <span className="text-[10px] font-bold uppercase text-[#6B7074]">Observation Count</span>
                          <div className="font-bold text-sm text-[#2563EB] font-mono">
                            {obsWells.length} Wells
                          </div>
                        </div>

                        <div className="bg-[#F7F7F7] border border-[#D6DADD] p-2.5 rounded-lg space-y-0.5">
                          <span className="text-[10px] font-bold uppercase text-[#6B7074]">Pumping Flow Q</span>
                          <div className="font-bold text-sm text-[#121212] font-mono">
                            {testQ} m³/s
                          </div>
                        </div>

                        <div className="bg-[#F7F7F7] border border-[#D6DADD] p-2.5 rounded-lg space-y-0.5">
                          <span className="text-[10px] font-bold uppercase text-[#6B7074]">Period P / Frequency</span>
                          <div className="font-bold text-sm text-[#121212] font-mono">
                            P = {testP}s ({freqHz} Hz)
                          </div>
                        </div>

                        <div className="bg-[#F7F7F7] border border-[#D6DADD] p-2.5 rounded-lg space-y-0.5">
                          <span className="text-[10px] font-bold uppercase text-[#6B7074]">Solver Output</span>
                          <div className="font-bold text-sm text-[#121212] font-mono">
                            Complex phasor
                          </div>
                        </div>

                        <div className="bg-[#F7F7F7] border border-[#D6DADD] p-2.5 rounded-lg space-y-0.5">
                          <span className="text-[10px] font-bold uppercase text-[#6B7074]">Status</span>
                          <div className="font-bold text-sm text-[#15803D] uppercase">
                            Ready
                          </div>
                        </div>
                      </div>

                      {/* Observation Wells Inventory Table for this Test */}
                      <div className="space-y-1 pt-1">
                        <span className="text-[11px] font-bold text-[#121212]">Observation Wells List</span>
                        <div className="overflow-x-auto border border-[#D6DADD] rounded-lg">
                          <table className="w-full text-left text-xs font-mono">
                            <thead className="bg-[#121212] text-white font-sans">
                              <tr>
                                <th className="p-2 font-semibold">Obs Well</th>
                                <th className="p-2 font-semibold">Coordinates</th>
                                <th className="p-2 font-semibold">Distance to Pumping Well ({pumpingWell?.name})</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#D6DADD]">
                              {obsWells.map((obs, idx) => {
                                const dist = pumpingWell
                                  ? Math.hypot(obs.x - pumpingWell.x, obs.y - pumpingWell.y).toFixed(1)
                                  : 'N/A';
                                return (
                                  <tr key={obs.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#F7F7F7]'}>
                                    <td className="p-2 font-bold font-sans text-[#121212]">{obs.name}</td>
                                    <td className="p-2 text-[#4B4F52]">({obs.x}m, {obs.y}m)</td>
                                    <td className="p-2 text-[#2563EB] font-bold">{dist} meters</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Mini Role Map (4 cols) */}
                    <div className="lg:col-span-4 flex flex-col items-center justify-center border-l border-[#D6DADD] pl-0 lg:pl-4">
                      <div className="text-[11px] font-bold text-[#121212] mb-1">
                        {test.name} Role Map
                      </div>
                      {renderSmallTestMap(test)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white border border-[#D6DADD] rounded-xl p-4 space-y-3 shadow-xs">
          <div className="flex items-center space-x-2 border-b border-[#D6DADD] pb-2">
            <Layers className="w-4 h-4 text-[#C5050C]" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#121212]">
              Domain & Discretization
            </h3>
          </div>

          <dl className="space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <dt className="text-[#6B7074] font-sans">Domain Dimensions:</dt>
              <dd className="font-bold text-[#121212]">
                {maxX - minX}m × {maxY - minY}m
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#6B7074] font-sans">Grid Cells (Nx × Ny):</dt>
              <dd className="font-bold text-[#121212]">
                {gridNx} × {gridNy} ({totalCells})
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#6B7074] font-sans">Cell Resolution (Δx, Δy):</dt>
              <dd className="font-bold text-[#121212]">
                {dx.toFixed(2)}m × {dy.toFixed(2)}m
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#6B7074] font-sans">Unknown Parameters:</dt>
              <dd className="font-bold text-[#C5050C]">
                {unknownParams} (ln K + ln Ss)
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-white border border-[#D6DADD] rounded-xl p-4 space-y-3 shadow-xs">
          <div className="flex items-center space-x-2 border-b border-[#D6DADD] pb-2">
            <Activity className="w-4 h-4 text-[#C5050C]" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#121212]">
              Testing & Pumping Signal
            </h3>
          </div>

          <dl className="space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <dt className="text-[#6B7074] font-sans">Selected Scenario:</dt>
              <dd className="font-bold text-[#121212]">
                {testCase === 'inversion_10s' ? 'Multi-Test Tomography' : 'Black–Kipp Multi-P'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#6B7074] font-sans">Pumping Period P:</dt>
              <dd className="font-bold text-[#121212]">{pumpingPeriod} seconds</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#6B7074] font-sans">Pumping Flow Rate Q:</dt>
              <dd className="font-bold text-[#121212]">{pumpingRate} m³/s</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#6B7074] font-sans">Physical Well Positions:</dt>
              <dd className="font-bold text-[#C5050C]">
                {wells.length} Defined Wells
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-white border border-[#D6DADD] rounded-xl p-4 space-y-3 shadow-xs">
          <div className="flex items-center space-x-2 border-b border-[#D6DADD] pb-2">
            <HardDrive className="w-4 h-4 text-[#C5050C]" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#121212]">
              Computing & Memory Estimator
            </h3>
          </div>

          <dl className="space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <dt className="text-[#6B7074] font-sans">Phasor Components per Pair:</dt>
              <dd className="font-bold text-[#121212]">{timeSteps} components</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#6B7074] font-sans">Total Observations M:</dt>
              <dd className="font-bold text-[#121212]">{totalObs} phasor components</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#6B7074] font-sans">Sensitivity Jacobian Size:</dt>
              <dd className="font-bold text-[#121212]">
                {totalObs} × {unknownParams}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#6B7074] font-sans">Raw Jacobian Size:</dt>
              <dd className="font-bold text-[#15803D]">
                ~{estimatedMemoryMB} MB
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Well Inventory Table */}
      <div className="bg-white border border-[#D6DADD] rounded-xl p-4 space-y-3 shadow-xs">
        <h3 className="font-bold text-xs uppercase tracking-wider text-[#121212]">
          Physical Well Positions & Geometrical Coordinates
        </h3>

        <div className="overflow-x-auto rounded border border-[#D6DADD]">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#121212] text-white font-sans">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Well Label</th>
                <th className="py-2.5 px-3 font-semibold">X Position (m)</th>
                <th className="py-2.5 px-3 font-semibold">Y Position (m)</th>
                <th className="py-2.5 px-3 font-semibold">Assigned Roles Across Tests</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D6DADD]">
              {wells.map((w, index) => {
                const pumpingInTests = tests.filter((t) => t.pumpingWellId === w.id).map((t) => t.name);
                const obsInTests = tests.filter((t) => t.observationWellIds?.includes(w.id)).map((t) => t.name);

                return (
                  <tr
                    key={w.id}
                    className={index % 2 === 0 ? 'bg-white' : 'bg-[#F7F7F7]'}
                  >
                    <td className="py-2 px-3 font-bold text-[#121212] font-sans flex items-center space-x-2">
                      <span className="w-5 h-5 rounded bg-[#121212] text-white text-[10px] font-bold flex items-center justify-center">
                        {w.name}
                      </span>
                      <span>{w.name}</span>
                    </td>
                    <td className="py-2 px-3 text-[#4B4F52]">{w.x} m</td>
                    <td className="py-2 px-3 text-[#4B4F52]">{w.y} m</td>
                    <td className="py-2 px-3 text-[#4B4F52]">
                      {pumpingInTests.length > 0 && (
                        <span className="text-[10px] bg-[#FEF2F2] text-[#C5050C] border border-[#FECDD3] font-sans font-bold px-2 py-0.5 rounded mr-1.5 inline-block">
                          Pump in {pumpingInTests.join(', ')}
                        </span>
                      )}
                      {obsInTests.length > 0 && (
                        <span className="text-[10px] bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] font-sans font-bold px-2 py-0.5 rounded inline-block">
                          Obs in {obsInTests.join(', ')}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onPrev}
          className="flex items-center space-x-1.5 bg-white hover:bg-[#F1F2F3] text-[#121212] border border-[#D6DADD] text-xs font-semibold px-4 py-2 rounded transition focus-ring"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Configuration</span>
        </button>

        <button
          onClick={onNext}
          disabled={hasErrors}
          className={`flex items-center space-x-2 text-xs font-bold px-6 py-2.5 rounded-lg shadow-xs transition focus-ring ${
            hasErrors
              ? 'bg-[#E1E5E7] text-[#6B7074] cursor-not-allowed'
              : 'bg-[#C5050C] hover:bg-[#9B0000] text-white'
          }`}
        >
          <span>{testCase === 'black_kipp' ? 'Run Black–Kipp Comparison' : 'Run Tomographic Analysis'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
