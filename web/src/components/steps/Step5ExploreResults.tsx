import React, { useState } from 'react';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { AnalysisResult, ModelConfig } from '../../types/aquifer';

interface Props { config: ModelConfig; result: AnalysisResult; onOpenReport: () => void; onPrev: () => void }

/** Export the actual solver values, preserving test and well identity. */
function downloadCsv(result: AnalysisResult) {
  const heading = 'testId,testName,pumpingWellId,observationWellId,periodSeconds,predictedReal,predictedImag,amplitude,phaseDegrees,measuredReal,measuredImag,residualAmplitude';
  const records = result.pairs.map((pair) => [pair.testId, pair.testName, pair.pumpingWellId, pair.observationWellId,
    pair.periodSeconds, pair.predicted.real, pair.predicted.imag, pair.predicted.amplitude, pair.predicted.phaseDegrees,
    pair.measured?.real ?? '', pair.measured?.imag ?? '', pair.residualAmplitude ?? '',
  ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','));
  const url = URL.createObjectURL(new Blob([[heading, ...records].join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = `tomography-${result.mode}-results.csv`; link.click(); URL.revokeObjectURL(url);
}

export const Step5ExploreResults: React.FC<Props> = ({ config, result, onOpenReport, onPrev }) => {
  const [testId, setTestId] = useState('all');
  const [field, setField] = useState<'lnK' | 'lnSs'>('lnK');
  const visible = result.pairs.filter((pair) => testId === 'all' || pair.testId === testId);
  const values = result.fields?.[field] ?? null;
  const flat = values?.flat() ?? [];
  const minimum = flat.length ? Math.min(...flat) : 0;
  const maximum = flat.length ? Math.max(...flat) : 1;
  return <div className="max-w-6xl mx-auto space-y-5 py-2">
    <div className="bg-white border border-[#D6DADD] rounded-xl p-6 flex flex-wrap items-start justify-between gap-4">
      <div><div className="text-xs font-semibold text-[#C5050C] mb-2">Step 5 · Solver results</div>
        <h2 className="text-xl font-bold">{result.mode === 'inversion' ? 'Geostatistical inversion' : 'Forward model predictions'}</h2>
        <p className="text-sm text-[#4B4F52] mt-2">{result.pairs.length} complex responses · {result.runtimeSeconds.toFixed(2)} s
          {result.mode === 'inversion' && ` · ${result.iterations} iterations`}</p></div>
      <div className="flex gap-2"><button onClick={() => downloadCsv(result)} className="flex items-center gap-2 px-3 py-2 border rounded-md text-sm"><Download size={16} /> CSV</button>
        <button onClick={onOpenReport} className="flex items-center gap-2 px-3 py-2 border rounded-md text-sm"><FileText size={16} /> Report</button></div>
    </div>
    {values && <div className="bg-white border border-[#D6DADD] rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-3"><h3 className="font-bold">Estimated {field} field</h3>
        <select aria-label="Estimated field" className="border rounded p-2 text-sm" value={field} onChange={(event) => setField(event.target.value as 'lnK' | 'lnSs')}>
          <option value="lnK">ln(K), m/s</option><option value="lnSs">ln(Ss), 1/m</option></select></div>
      <div className="w-full max-w-xl aspect-square grid border" style={{ gridTemplateColumns: `repeat(${result.grid.nx}, minmax(0, 1fr))` }} aria-label={`${field} estimated grid`}>
        {[...values].reverse().flat().map((value, index) => <div key={index} title={value.toFixed(4)} style={{ backgroundColor: `hsl(${240 - 230 * ((value - minimum) / (maximum - minimum || 1))} 75% 48%)` }} />)}
      </div><div className="text-xs text-[#4B4F52]">Range {minimum.toFixed(4)} to {maximum.toFixed(4)} · {config.gridNx} × {config.gridNy} cells</div>
    </div>}
    <div className="bg-white border border-[#D6DADD] rounded-xl p-6 space-y-4">
      <div className="flex flex-wrap justify-between gap-3"><h3 className="font-bold">Predicted response by test and observation well</h3>
        <select aria-label="Filter results by test" className="border rounded p-2 text-sm" value={testId} onChange={(event) => setTestId(event.target.value)}>
          <option value="all">All tests</option>{config.tests.map((test) => <option key={test.id} value={test.id}>{test.name}</option>)}</select></div>
      <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-[#F1F2F3]"><tr>
        <th className="p-2">Test</th><th className="p-2">Pump → observe</th><th className="p-2">Period (s)</th><th className="p-2">Real (m)</th><th className="p-2">Imag (m)</th><th className="p-2">Amplitude (m)</th><th className="p-2">Phase (°)</th>{result.mode === 'inversion' && <th className="p-2">Residual (m)</th>}
      </tr></thead><tbody>{visible.map((pair) => <tr key={`${pair.testId}-${pair.observationWellId}`} className="border-t">
        <td className="p-2">{pair.testName}</td><td className="p-2">{pair.pumpingWellName} → {pair.observationWellName}</td><td className="p-2">{pair.periodSeconds}</td>
        <td className="p-2 font-mono">{pair.predicted.real.toExponential(3)}</td><td className="p-2 font-mono">{pair.predicted.imag.toExponential(3)}</td>
        <td className="p-2 font-mono">{pair.predicted.amplitude.toExponential(3)}</td><td className="p-2 font-mono">{pair.predicted.phaseDegrees.toFixed(1)}</td>
        {result.mode === 'inversion' && <td className="p-2 font-mono">{pair.residualAmplitude?.toExponential(3)}</td>}</tr>)}</tbody></table></div>
    </div><button onClick={onPrev} className="flex items-center gap-2 px-4 py-2 border rounded-md text-sm"><ArrowLeft size={16} /> Back to analysis</button>
  </div>;
};
