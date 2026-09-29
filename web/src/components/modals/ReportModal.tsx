import React, { useState } from 'react';
import { Download, Loader2, Printer, X } from 'lucide-react';
import { AnalysisResult, ModelConfig } from '../../types/aquifer';
import { exportReport, REPORT_FORMATS, ReportFormat } from '../../reporting/reportExport';

interface Props { isOpen: boolean; onClose: () => void; config: ModelConfig; result: AnalysisResult | null }

/** The report reads the same result object as the results screen and CSV. */
export const ReportModal: React.FC<Props> = ({ isOpen, onClose, config, result }) => {
  const [format, setFormat] = useState<ReportFormat>('pdf');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  if (!isOpen || !result) return null;
  const download = async () => {
    setExportError(null); setExporting(true);
    try { await exportReport(format, config, result); }
    catch (cause) { setExportError(cause instanceof Error ? cause.message : 'Could not create report'); }
    finally { setExporting(false); }
  };
  return <div role="dialog" aria-modal="true" aria-label="Analysis report" className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
      <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center print:hidden">
        <h2 className="font-bold">Analysis report</h2><div className="flex gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-2 border rounded"><Printer size={16} /> Print</button>
          <button onClick={onClose} aria-label="Close report" className="p-2 border rounded"><X size={16} /></button>
        </div>
      </div>
      <div className="p-7 space-y-6 text-sm">
        <section className="print:hidden border border-[#D6DADD] rounded-xl p-4 bg-[#F7F7F7]">
          <div className="flex flex-wrap items-end gap-3"><label className="flex-1 min-w-64"><span className="block font-bold text-xs mb-1">Download report format</span><select aria-label="Report format" value={format} onChange={(event) => setFormat(event.target.value as ReportFormat)} className="w-full bg-white border border-[#A7ADB1] rounded-md px-3 py-2.5 focus-ring">{REPORT_FORMATS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><button onClick={download} disabled={exporting} className="flex items-center justify-center gap-2 min-w-44 px-4 py-2.5 rounded-md bg-[#C5050C] text-white font-bold disabled:opacity-60">{exporting ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}{exporting ? 'Creating report…' : 'Download report'}</button></div>
          <p className="text-xs text-[#5F6368] mt-2">{REPORT_FORMATS.find((option) => option.value === format)?.description}</p>
          {exportError && <p role="alert" className="text-xs text-[#9B0000] mt-2">{exportError}</p>}
        </section>
        <div><h1 className="text-2xl font-bold">{config.testCase === 'black_kipp' ? 'Black–Kipp analytical comparison' : 'Oscillatory tomography analysis'}</h1>
          <p className="text-[#4B4F52] mt-2">{config.testCase === 'black_kipp' ? 'Finite-difference forward responses compared with the Black–Kipp analytical solution' : result.analysisMode === 'synthetic_demo' ? 'Original P=10 checkerboard synthetic experiment and joint geostatistical inversion' : result.mode === 'inversion' ? 'Geostatistical inversion using supplied measured phasors' : 'Forward model predictions from initial ln(K) and ln(Ss)'}</p></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-[#F7F7F7] p-4 rounded">
          <div>Tests<br /><strong>{config.tests.length}</strong></div><div>Wells<br /><strong>{config.wells.length}</strong></div>
          <div>Grid<br /><strong>{config.gridNx} × {config.gridNy}</strong></div><div>Solver runtime<br /><strong>{result.runtimeSeconds.toFixed(2)} s</strong></div>
        </div>
        <section><h2 className="font-bold mb-2">Experiment settings</h2>
          <p>Domain: x {config.minX}–{config.maxX} m, y {config.minY}–{config.maxY} m. Initial ln(K): {config.initialLnK}; initial ln(Ss): {config.initialLnSs}. Data error variance: {config.dataErrorVar} m².</p>
          {result.mode === 'inversion' && <p>Outer inversion iterations: {result.iterations}; final retained objective: {result.objective?.toPrecision(5)}.</p>}
        </section>
        <section><h2 className="font-bold mb-2">Test configuration</h2>
          <div className="space-y-1">{config.tests.map((test) => <p key={test.id}>{test.name}: pump {config.wells.find((well) => well.id === test.pumpingWellId)?.name}; observe {test.observationWellIds.map((id) => config.wells.find((well) => well.id === id)?.name).join(', ')}; period {test.pumpingPeriod ?? config.pumpingPeriod} s.</p>)}</div>
        </section>
        <section><h2 className="font-bold mb-2">Computed complex responses</h2>
          <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Test</th><th>Pump → observe</th><th>Real (m)</th><th>Imag (m)</th><th>Amplitude (m)</th><th>{config.testCase === 'black_kipp' ? 'Phase delay (°)' : 'Phase (°)'}</th>{result.mode === 'inversion' && <th>Residual (m)</th>}{config.testCase === 'black_kipp' && <><th>Analytical amp (m)</th><th>Amp error</th><th>Phase error (°)</th></>}</tr></thead>
            <tbody>{result.pairs.map((pair) => <tr key={`${pair.testId}-${pair.observationWellId}`} className="border-t">
              <td>{pair.testName}</td><td>{pair.pumpingWellName} → {pair.observationWellName}</td><td>{pair.predicted.real.toExponential(3)}</td><td>{pair.predicted.imag.toExponential(3)}</td><td>{pair.predicted.amplitude.toExponential(3)}</td><td>{(config.testCase === 'black_kipp' ? pair.numericalPhaseDegrees ?? 0 : pair.predicted.phaseDegrees).toFixed(1)}</td>{result.mode === 'inversion' && <td>{pair.residualAmplitude?.toExponential(3)}</td>}{config.testCase === 'black_kipp' && <><td>{pair.analytical?.amplitude.toExponential(3)}</td><td>{((pair.amplitudeRelativeError ?? 0) * 100).toFixed(1)}%</td><td>{pair.phaseErrorDegrees?.toFixed(1)}</td></>}
            </tr>)}</tbody></table></div>
        </section>
        <p className="text-xs text-[#6B7074]">Results are from the Python solver. The model assumes one horizontal layer with unit thickness and no flow through its top and bottom.</p>
      </div>
    </div>
  </div>;
};
