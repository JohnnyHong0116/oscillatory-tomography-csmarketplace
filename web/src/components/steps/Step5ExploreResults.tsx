import { VolumeFieldPlot } from './VolumeFieldPlot';
import { matchesScope, periodGroups } from '../../utils/periodGroups';
import React, { useRef, useState } from 'react';
import { ArrowLeft, Download, FileText, FlaskConical } from 'lucide-react';
import { AnalysisPair, AnalysisResult, ModelConfig } from '../../types/aquifer';
import { FieldHeatmap } from './FieldHeatmap';
import { ResponsePlots } from './ResponsePlots';
import { SeriesPlot } from './SeriesPlot';
import { ScientificResultGuidance } from './ScientificContext';
import { revealAfterRender } from '../../utils/scroll';
import { syntheticObservationCsv } from '../../utils/syntheticObservations';
import { matchesBaselineConfiguration } from '../../utils/scientificReview';
import { SignalMap } from './SignalMap';

interface Props {
  config: ModelConfig;
  result: AnalysisResult;
  onOpenReport: () => void;
  onTransfer: () => void;
  onPrev: () => void;
}
type InversionTab = 'fields' | 'errors' | 'sensitivity' | 'responses' | 'residuals' | 'map';
type BlackKippTab = 'responses' | 'properties' | 'errors' | 'map';

function downloadCsv(result: AnalysisResult) {
  const heading =
    'testId,testName,pumpingWellId,observationWellId,periodSeconds,predictedReal,predictedImag,amplitude,phaseDegrees,measuredReal,measuredImag,residualAmplitude,analyticalAmplitude,analyticalPhaseDegrees,numericalPhaseDelayDegrees,amplitudeRelativeError,phaseErrorDegrees,diffusivity,transmissivity,storativity';
  const records = result.pairs.map((pair) =>
    [
      pair.testId,
      pair.testName,
      pair.pumpingWellId,
      pair.observationWellId,
      pair.periodSeconds,
      pair.predicted.real,
      pair.predicted.imag,
      pair.predicted.amplitude,
      pair.predicted.phaseDegrees,
      pair.measured?.real ?? '',
      pair.measured?.imag ?? '',
      pair.residualAmplitude ?? '',
      pair.analytical?.amplitude ?? '',
      pair.analytical?.phaseDegrees ?? '',
      pair.numericalPhaseDegrees ?? '',
      pair.amplitudeRelativeError ?? '',
      pair.phaseErrorDegrees ?? '',
      pair.effectiveProperties?.diffusivityM2PerSecond ?? '',
      pair.effectiveProperties?.transmissivityM2PerSecond ?? '',
      pair.effectiveProperties?.storativity ?? '',
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(','),
  );
  const url = URL.createObjectURL(
    new Blob([[heading, ...records].join('\r\n')], { type: 'text/csv;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `tomography-${result.analysisMode}-results.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

const Metric: React.FC<{ label: string; value: string; note: string }> = ({ label, value, note }) => (
  <div className="border border-[#D6DADD] bg-[#FAFAFA] rounded-lg p-4">
    <div className="text-[10px] font-mono font-bold uppercase text-[#6B7074]">{label}</div>
    <div className="text-lg font-bold mt-1">{value}</div>
    <div className="text-[10px] text-[#527A35] mt-1">{note}</div>
  </div>
);

function ResultsTable({ pairs, blackKipp }: { pairs: AnalysisPair[]; blackKipp: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left">
        <thead className="bg-[#F1F2F3]">
          <tr>
            <th className="p-2">Test</th>
            <th className="p-2">Pump → observe</th>
            <th className="p-2">P (s)</th>
            <th className="p-2">Amplitude (m)</th>
            <th className="p-2">Phase (°)</th>
            <th className="p-2">Residual</th>
            {blackKipp && (
              <>
                <th className="p-2">Analytical amp.</th>
                <th className="p-2">Amp. error</th>
                <th className="p-2">Phase error</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {pairs.map((pair) => (
            <tr key={`${pair.testId}-${pair.observationWellId}`} className="border-t">
              <td className="p-2">{pair.testName}</td>
              <td className="p-2">
                {pair.pumpingWellName} → {pair.observationWellName}
              </td>
              <td className="p-2">{pair.periodSeconds}</td>
              <td className="p-2 font-mono">{pair.predicted.amplitude.toExponential(3)}</td>
              <td className="p-2 font-mono">
                {(blackKipp ? (pair.numericalPhaseDegrees ?? 0) : pair.predicted.phaseDegrees).toFixed(2)}
              </td>
              <td className="p-2 font-mono">{pair.residualAmplitude?.toExponential(2) ?? '—'}</td>
              {blackKipp && (
                <>
                  <td className="p-2 font-mono">{pair.analytical?.amplitude.toExponential(3)}</td>
                  <td className="p-2 font-mono">{((pair.amplitudeRelativeError ?? 0) * 100).toFixed(2)}%</td>
                  <td className="p-2 font-mono">{pair.phaseErrorDegrees?.toFixed(2)}°</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const Step5ExploreResults: React.FC<Props> = ({
  config,
  result: savedResult,
  onOpenReport,
  onTransfer,
  onPrev,
}) => {
  const [fieldView,setFieldView]=useState<'volume'|'layer'>('volume');
  const [slice,setSlice]=useState(Math.floor((config.gridNz??1)/2));
  const result:AnalysisResult={...savedResult};
  for(const key of ['fields','trueFields','errorFields','sensitivityFields'] as const){const volume=savedResult.volumeFields?.[key];if(volume)result[key]={lnK:volume.lnK[slice],lnSs:volume.lnSs[slice]};}
  const fieldConfig=config.dimension===3?{...config,wells:config.wells.filter(w=>Math.abs((w.z??0)-((config.minZ??-40)+(slice+.5)*((config.maxZ??40)-(config.minZ??-40))/(config.gridNz??10)))<=((config.maxZ??40)-(config.minZ??-40))/(2*(config.gridNz??10)))}:config;
  const blackKipp = config.testCase === 'black_kipp';
  const originalBaseline = matchesBaselineConfiguration(config) && result.analysisMode === 'synthetic_demo';
  const [scope, setScope] = useState('all');
  const [tab, setTab] = useState<InversionTab | BlackKippTab>(
    result.mode === 'forward' ? 'map' : result.fields ? 'fields' : 'responses',
  );
  const plotSectionRef = useRef<HTMLElement>(null);
  const selectPlotTab = (nextTab: InversionTab | BlackKippTab) => {
    setTab(nextTab);
    // Anchor the whole section, including its tabs, after the new plot has laid out.
    // Retain focus on the clicked tab rather than moving it into a chart.
    revealAfterRender(() => plotSectionRef.current, 'start', false);
  };
  const visible = result.pairs.filter((pair) => matchesScope(config,scope,pair.testId));
  const scopes = [
    {
      id: 'all',
      label: blackKipp
        ? `All period tests (${config.tests.length})`
        : `${result.mode === 'inversion' ? 'Combined joint inversion' : 'All forward responses'} (${config.tests.length} tests)`,
    },
    ...periodGroups(config).filter(g=>g.tests.length).map(g=>({id:`period:${g.period}`,label:`P = ${g.period} s · ${g.tests.length} tests`})),
  ];
  const inversionTabs: { id: InversionTab; label: string; provenance: 'baseline' | 'derived' }[] = [
    { id: 'map', label: 'Well signal map', provenance: 'derived' },
    { id: 'fields', label: 'Parameter fields', provenance: 'baseline' },
    { id: 'errors', label: 'Field error', provenance: 'derived' },
    { id: 'sensitivity', label: 'Sensitivity coverage', provenance: 'derived' },
    { id: 'responses', label: 'Observation fit', provenance: 'derived' },
    { id: 'residuals', label: 'Residuals & convergence', provenance: 'derived' },
  ];
  const blackKippTabs: { id: BlackKippTab; label: string }[] = [
    { id: 'map', label: 'Well signal map' },
    { id: 'responses', label: 'Response comparison' },
    { id: 'properties', label: 'Effective properties' },
    { id: 'errors', label: 'Error diagnostics' },
  ];
  const tabs = blackKipp
    ? blackKippTabs
    : inversionTabs.filter((item) =>
        item.id === 'fields'
          ? !!result.fields || !!result.trueFields
          : item.id === 'errors'
            ? !!result.errorFields
            : item.id === 'sensitivity'
              ? !!result.sensitivityFields
              : item.id === 'residuals'
                ? result.mode === 'inversion'
                : true,
      );
  const propertySeries = config.wells
    .filter((well) => well.id !== config.tests[0]?.pumpingWellId)
    .map((well, index) => {
      const pairs = visible
        .filter((pair) => pair.observationWellId === well.id)
        .sort((a, b) => a.periodSeconds - b.periodSeconds);
      return { well, pairs, color: ['#C5050C', '#2563EB', '#15803D', '#9333EA'][index % 4] };
    });
  const diagnostics = result.diagnostics;

  return (
    <div className="max-w-7xl mx-auto space-y-5 py-2">
      <div className="bg-white border border-[#D6DADD] rounded-xl p-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#FEF2F2] border border-[#FECACA] px-3 py-1 text-xs font-semibold text-[#B42318]">
            <FlaskConical size={14} /> Step 5 ·{' '}
            {blackKipp
              ? 'Analytical comparison explorer'
              : result.mode === 'forward'
                ? 'Forward response explorer'
                : 'Interactive inversion explorer'}
          </div>
          <h2 className="text-xl font-bold mt-2">
            {blackKipp
              ? 'Black–Kipp analytical comparison'
              : result.mode === 'inversion'
                ? 'Hydraulic conductivity & specific storage fields'
                : 'Forward response predictions'}
          </h2>
          <p className="text-sm text-[#4B4F52] mt-1">
            {result.pairs.length} computed responses · {result.runtimeSeconds.toFixed(2)} s
            {result.iterations ? ` · ${result.iterations} outer inversion iterations` : ''}
          </p>
        </div>
        <div data-tour="result-export" className="flex flex-wrap gap-2">
          <button
            onClick={() => downloadCsv(result)}
            className="flex items-center gap-2 px-3 py-2 border rounded-md text-sm"
          >
            <Download size={16} /> Response-only CSV
          </button>
          <button
            onClick={onOpenReport}
            className="flex items-center gap-2 px-3 py-2 bg-[#C5050C] text-white rounded-md text-sm"
          >
            <FileText size={16} /> Generate report
          </button>
        </div>
      </div>

      <div data-tour="result-scope" className="studio-panel !p-3">
        <div className="flex items-center gap-3">
          <span className="shrink-0 text-xs font-semibold">Response scope</span>
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto p-1">
          {scopes.map((item) => (
            <button
              key={item.id}
              onClick={() => setScope(item.id)}
              aria-pressed={scope === item.id}
              className={`shrink-0 whitespace-nowrap px-3 py-2 rounded-lg text-xs font-semibold focus-ring ${scope === item.id ? 'bg-[#FCEBEC] text-[#9B0000] ring-1 ring-[#C5050C]' : 'bg-[#F3F5F7] text-[#566372] hover:bg-[#E8EDF2]'}`}
            >
              {item.label}
            </button>
          ))}
          </div>
        </div>
        <label className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">Pumping test<select aria-label="Result pumping test" value={config.tests.some(t=>t.id===scope)?scope:''} onChange={e=>setScope(e.target.value || (config.tests.some(t=>t.id===scope)?`period:${config.tests.find(t=>t.id===scope)!.pumpingPeriod??config.pumpingPeriod}`:scope))} className="min-w-0 max-w-full rounded border bg-white p-2 focus-ring"><option value="">All tests in selected scope</option>{periodGroups(config).filter(g=>scope==='all'||scope===`period:${g.period}`||g.tests.some(t=>t.id===scope)).map(g=><optgroup key={g.period} label={`P = ${g.period} s`}>{g.tests.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>)}</select></label>
        {!blackKipp && result.mode === 'inversion' && (
          <p className="mt-2 text-xs text-[#566372]">
            Test selection filters observation-fit plots and residual rows only. Parameter fields, field
            error, sensitivity, and convergence are one joint result calculated from all configured tests.
          </p>
        )}
      </div>

      {result.mode === 'inversion' && result.iterations >= config.maxIterations && <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Iteration budget reached ({config.maxIterations}). Review convergence before interpreting the reconstruction.</p>}
      <details className="rounded-xl border border-[#D9E0E7] bg-white p-3">
        <summary className="w-fit cursor-pointer rounded text-sm font-semibold focus-ring">Interpretation & model assumptions{result.syntheticTruth || result.observationSource === 'synthetic' ? ' · synthetic, not field measurements' : ''}</summary>
        <div className="mt-3"><ScientificResultGuidance config={config} result={result} /></div>
      </details>
      {result.analysisMode === 'forward' && (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs space-y-3">
          <h3 className="font-bold">Use forward predictions as synthetic inversion input</h3>
          <p>
            Continue directly with these predicted real/imaginary heads as synthetic observations. Test IDs,
            well geometry, periods, amplitudes and boundaries stay unchanged. Review the inversion grid before
            proceeding. Synthetic recovery is a consistency check, not field validation.
          </p>
          <div role="group" aria-label="Forward result actions" className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onTransfer}
              className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-[#C5050C] px-4 py-2 font-bold text-white focus-ring sm:w-auto"
            >
              Use these responses for inversion →
            </button>
            <button
              type="button"
              className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-blue-300 bg-white px-4 py-2 font-semibold focus-ring sm:w-auto"
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([syntheticObservationCsv(result)], { type: 'text/csv;charset=utf-8' }),
                );
                const link = document.createElement('a');
                link.href = url;
                link.download = 'synthetic-forward-inversion-input.csv';
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export synthetic inversion-input CSV
            </button>
          </div>
        </section>
      )}

      <section
        ref={plotSectionRef}
        data-tour="result-plots"
        className="bg-white border border-[#D6DADD] rounded-xl p-5 space-y-5 scroll-mt-4"
      >
        <div className="flex flex-wrap gap-1 border-b pb-3">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => selectPlotTab(item.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-bold ${tab === item.id ? 'bg-[#FEF2F2] text-[#B42318] border border-[#FECACA]' : 'text-[#3F4448] hover:bg-[#F1F2F3]'}`}
            >
              <span>
                {result.mode === 'forward' && !blackKipp && item.id === 'responses'
                  ? 'Forward responses'
                  : item.label}
              </span>
              {!blackKipp && 'provenance' in item && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[8px] uppercase tracking-wide ${item.provenance === 'baseline' ? 'bg-[#E7F5EA] text-[#287A3D]' : 'bg-[#E9EEF9] text-[#365A9D]'}`}
                >
                  {item.provenance === 'baseline'
                    ? originalBaseline
                      ? 'Original baseline'
                      : result.mode === 'forward'
                        ? 'Generating truth'
                        : 'Joint estimate'
                    : 'Derived diagnostic'}
                </span>
              )}
            </button>
          ))}
        </div>

        {config.dimension===3&&['fields','errors','sensitivity'].includes(tab)&&<div className="flex gap-2 mb-3">{(['volume','layer'] as const).map(v=><button key={v} aria-pressed={fieldView===v} onClick={()=>setFieldView(v)} className={`rounded-lg border px-3 py-2 text-sm focus-ring ${fieldView===v?'bg-slate-800 text-white':'bg-white'}`}>{v==='volume'?'3D orthogonal slices':'Horizontal layer'}</button>)}</div>}
        {config.dimension===3&&fieldView==='layer'&&['fields','errors','sensitivity'].includes(tab)&&<label className="flex flex-wrap items-center gap-3 text-sm font-semibold mb-4">Horizontal Z slice<select aria-label="Field Z slice" value={slice} onChange={e=>setSlice(Number(e.target.value))} className="rounded border p-2">{Array.from({length:config.gridNz??1},(_,k)=><option key={k} value={k}>Layer {k+1} · z = {((config.minZ??-40)+(k+.5)*((config.maxZ??40)-(config.minZ??-40))/(config.gridNz??10)).toPrecision(5)} m</option>)}</select><span className="text-xs font-normal">Only well ports inside this layer are overlaid. All layers are included in the experiment export.</span></label>}
        {config.dimension===3&&fieldView==='volume'&&['fields','errors','sensitivity'].includes(tab)&&<div className="field-results-grid gap-4">{(tab==='fields'?['trueFields','fields']:tab==='errors'?['errorFields']:['sensitivityFields']).map(key=>{const group=key as 'fields'|'trueFields'|'errorFields'|'sensitivityFields',v=savedResult.volumeFields?.[group];return v&&(['lnK','lnSs'] as const).map(prop=><VolumeFieldPlot key={`${group}-${prop}`} title={`${group==='fields'?'Estimated':group==='trueFields'?'True':group==='errorFields'?'Error':'Sensitivity'} ${prop==='lnK'?'ln(K)':'ln(Ss)'}`} values={v[prop]} config={config} symmetric={group==='errorFields'}/>);})}</div>}
        {tab === 'map'  && <SignalMap key={scope} config={config} result={result} scope={scope} />}
        {!blackKipp && !(config.dimension===3&&fieldView==='volume') && tab === 'fields' && result.trueFields && (
          <>
            <div
              className="field-results-grid gap-4 bg-[#111] rounded-xl p-5"
            >
              <FieldHeatmap
                title="True ln(K)"
                subtitle={`m/s · synthetic ${result.syntheticTruth?.kind ?? 'checkerboard'}`}
                values={result.trueFields.lnK}
                config={fieldConfig}
              />
              <FieldHeatmap
                title="True ln(Ss)"
                subtitle={`1/m · synthetic ${result.syntheticTruth?.kind ?? 'checkerboard'}`}
                values={result.trueFields.lnSs}
                config={fieldConfig}
              />
              {result.fields && (
                <FieldHeatmap
                  title="Estimated ln(K)"
                  subtitle="joint geostatistical inversion"
                  values={result.fields.lnK}
                  config={fieldConfig}
                />
              )}
              {result.fields && (
                <FieldHeatmap
                  title="Estimated ln(Ss)"
                  subtitle="joint geostatistical inversion"
                  values={result.fields.lnSs}
                  config={fieldConfig}
                />
              )}
            </div>
            <p className="text-xs text-[#5F6368]">
              {originalBaseline
                ? 'Original P=10 workflow: true and estimated fields.'
                : result.fields
                  ? 'Synthetic truth and jointly estimated fields for the configured experiment.'
                  : 'Generating synthetic fields used by this forward run. No inversion has been performed.'}{' '}
              {result.mode === 'inversion'
                ? 'The scope selector filters response diagnostics; parameter fields remain the joint estimate from all configured tests.'
                : 'Test selection does not change the common generating field.'}
            </p>
          </>
        )}
        {!blackKipp && !(config.dimension===3&&fieldView==='volume') && tab === 'fields' && result.fields && !result.trueFields && (
          <div className="field-results-grid gap-5 bg-[#111] rounded-xl p-5">
            <FieldHeatmap title="Estimated ln(K)" subtitle="m/s" values={result.fields.lnK} config={fieldConfig} />
            <FieldHeatmap
              title="Estimated ln(Ss)"
              subtitle="1/m"
              values={result.fields.lnSs}
              config={fieldConfig}
            />
          </div>
        )}
        {!blackKipp && !(config.dimension===3&&fieldView==='volume') && tab === 'errors' && result.errorFields && (
          <div className="field-results-grid gap-5 bg-[#111] rounded-xl p-5">
            <FieldHeatmap
              title="ln(K) estimation error"
              subtitle="estimate − synthetic truth"
              values={result.errorFields.lnK}
              config={fieldConfig}
              palette="diverging"
              symmetric
            />
            <FieldHeatmap
              title="ln(Ss) estimation error"
              subtitle="estimate − synthetic truth"
              values={result.errorFields.lnSs}
              config={fieldConfig}
              palette="diverging"
              symmetric
            />
          </div>
        )}
        {!blackKipp && !(config.dimension===3&&fieldView==='volume') && tab === 'sensitivity' && result.sensitivityFields && (
          <div className="field-results-grid gap-5 bg-[#111] rounded-xl p-5">
            <FieldHeatmap
              title="ln(K) sensitivity coverage"
              subtitle="log10 column-norm of final Jacobian"
              values={result.sensitivityFields.lnK}
              config={fieldConfig}
              palette="plasma"
            />
            <FieldHeatmap
              title="ln(Ss) sensitivity coverage"
              subtitle="log10 column-norm of final Jacobian"
              values={result.sensitivityFields.lnSs}
              config={fieldConfig}
              palette="plasma"
            />
          </div>
        )}
        {tab === 'responses' && <ResponsePlots config={config} pairs={visible} />}
        {!blackKipp && tab === 'residuals' && (
          <div className="space-y-5">
            {result.objectiveHistory.length > 0 && (
              <SeriesPlot
                title="Inversion convergence"
                x={result.objectiveHistory.map((item) => item.iteration)}
                series={[
                  {
                    label: 'Negative log posterior',
                    values: result.objectiveHistory.map((item) => item.objective),
                    color: '#C5050C',
                  },
                ]}
                xLabel="Iteration"
                yLabel="Objective"
                logarithmicY
              />
            )}
            <ResultsTable pairs={visible} blackKipp={false} />
          </div>
        )}
        {blackKipp && tab === 'properties' && (
          <div className="diagnostic-results-grid gap-4">
            <SeriesPlot
              title="Effective transmissivity"
              x={propertySeries[0]?.pairs.map((pair) => pair.periodSeconds) ?? []}
              series={propertySeries.map(({ well, pairs, color }) => ({
                label: well.name,
                values: pairs.map((pair) => pair.effectiveProperties!.transmissivityM2PerSecond),
                color,
              }))}
              xLabel="Period (s)"
              yLabel="T (m²/s)"
              logarithmicX
              logarithmicY
            />
            <SeriesPlot
              title="Effective storativity"
              x={propertySeries[0]?.pairs.map((pair) => pair.periodSeconds) ?? []}
              series={propertySeries.map(({ well, pairs, color }) => ({
                label: well.name,
                values: pairs.map((pair) => pair.effectiveProperties!.storativity),
                color,
              }))}
              xLabel="Period (s)"
              yLabel="S (–)"
              logarithmicX
              logarithmicY
            />
            <SeriesPlot
              title="Effective diffusivity"
              x={propertySeries[0]?.pairs.map((pair) => pair.periodSeconds) ?? []}
              series={propertySeries.map(({ well, pairs, color }) => ({
                label: well.name,
                values: pairs.map((pair) => pair.effectiveProperties!.diffusivityM2PerSecond),
                color,
              }))}
              xLabel="Period (s)"
              yLabel="D (m²/s)"
              logarithmicX
              logarithmicY
            />
          </div>
        )}
        {blackKipp && tab === 'errors' && <ResultsTable pairs={visible} blackKipp />}
      </section>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {blackKipp ? (
          <>
            <Metric
              label="Mean amplitude error"
              value={`${((100 * result.pairs.reduce((sum, pair) => sum + (pair.amplitudeRelativeError ?? 0), 0)) / Math.max(1, result.pairs.length)).toFixed(2)}%`}
              note="Finite-domain vs analytical"
            />
            <Metric
              label="Mean phase error"
              value={`${(result.pairs.reduce((sum, pair) => sum + (pair.phaseErrorDegrees ?? 0), 0) / Math.max(1, result.pairs.length)).toFixed(2)}°`}
              note="Circular phase difference"
            />
          </>
        ) : result.mode === 'inversion' && result.trueFields ? (
          <>
            <Metric
              label="ln(K) field RMSE"
              value={diagnostics?.lnKFieldRmse?.toFixed(3) ?? 'N/A'}
              note="Against labelled synthetic truth"
            />
            <Metric
              label="ln(Ss) field RMSE"
              value={diagnostics?.lnSsFieldRmse?.toFixed(3) ?? 'N/A'}
              note="Against labelled synthetic truth"
            />
          </>
        ) : result.mode === 'forward' && result.syntheticTruth ? (
          <>
            <Metric
              label="Generating field"
              value={result.syntheticTruth.kind}
              note="Synthetic truth, not site measurements"
            />
            <Metric
              label="Random seed"
              value={result.syntheticTruth.seed == null ? 'Not random' : String(result.syntheticTruth.seed)}
              note={result.syntheticTruth.realization==='matlab_reference'?'MATLAB-generated reference truth':'Custom generator; parameters recorded in report'}
            />
          </>
        ) : result.mode === 'forward' ? (
          <>
            <Metric
              label="Initial conductivity K"
              value={`${Math.exp(config.initialLnK).toExponential(3)} m/s`}
              note="Homogeneous forward-model input"
            />
            <Metric
              label="Initial specific storage Ss"
              value={`${Math.exp(config.initialLnSs).toExponential(3)} 1/m`}
              note="Homogeneous forward-model input"
            />
          </>
        ) : (
          <>
            <Metric
              label="Phase fit RMSE"
              value={diagnostics ? `${diagnostics.phaseRmseDegrees.toFixed(3)}°` : 'N/A'}
              note="Prediction versus supplied observations"
            />
            <Metric
              label="Mean amplitude fit error"
              value={diagnostics ? `${(100 * diagnostics.meanAmplitudeRelativeError).toFixed(3)}%` : 'N/A'}
              note="Not a parameter-field truth error"
            />
          </>
        )}
        <Metric
          label="Response RMSE"
          value={diagnostics ? diagnostics.responseRmse.toExponential(2) : 'Not fitted'}
          note={diagnostics ? 'Complex-head residual' : 'No observations used for calibration'}
        />
        <Metric
          label="Active data"
          value={
            scope === 'all'
              ? `${config.tests.length} tests`
              : (scope.startsWith('period:')?`P = ${scope.slice(7)} s`:(config.tests.find((test) => test.id === scope)?.name ?? scope))
          }
          note={`${visible.length} response pairs shown`}
        />
      </div>
      <button onClick={onPrev} className="flex items-center gap-2 px-4 py-2 border rounded-md text-sm">
        <ArrowLeft size={16} /> Back to analysis
      </button>
    </div>
  );
};
