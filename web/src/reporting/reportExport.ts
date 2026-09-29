import { AnalysisResult, ModelConfig } from '../types/aquifer';

export type ReportFormat = 'pdf' | 'docx' | 'md' | 'html' | 'txt' | 'json';

export const REPORT_FORMATS: { value: ReportFormat; label: string; description: string }[] = [
  { value: 'pdf', label: 'PDF document (.pdf)', description: 'Polished, paginated report for submission or sharing.' },
  { value: 'docx', label: 'Microsoft Word (.docx)', description: 'Editable report for revisions and collaboration.' },
  { value: 'md', label: 'Markdown (.md)', description: 'Portable structured text for GitHub and documentation.' },
  { value: 'html', label: 'Web page (.html)', description: 'Standalone styled report that opens in a browser.' },
  { value: 'txt', label: 'Plain text (.txt)', description: 'Universal human-readable report without formatting.' },
  { value: 'json', label: 'Structured data (.json)', description: 'Machine-readable configuration and complete solver output.' },
];

const titleFor = (config: ModelConfig) => config.testCase === 'black_kipp'
  ? 'Black-Kipp Analytical Comparison'
  : 'Oscillatory Tomography Analysis';

const summaryFor = (config: ModelConfig, result: AnalysisResult) => config.testCase === 'black_kipp'
  ? 'Full 300 x 300, 20-period finite-difference baseline compared with the Cardiff-corrected Black-Kipp analytical solution.'
  : result.analysisMode === 'synthetic_demo'
  ? 'Original P=10 checkerboard synthetic experiment and joint geostatistical inversion.'
  : result.mode === 'inversion'
    ? 'Joint geostatistical inversion of supplied complex observations.'
    : 'Forward predictions from the configured initial ln(K) and ln(Ss) fields.';

const responseHeader = (config: ModelConfig) => config.testCase === 'black_kipp'
  ? ['Test', 'Pump', 'Observe', 'Distance (m)', 'Period (s)', 'Real (m)', 'Imag (m)', 'Numerical amp. (m)', 'Numerical phase (deg)', 'Analytical amp. (m)', 'Analytical phase (deg)', 'Amp. error (%)', 'Phase error (deg)', 'Effective D (m2/s)', 'Effective T (m2/s)', 'Effective S']
  : ['Test', 'Pump', 'Observe', 'Period (s)', 'Real (m)', 'Imag (m)', 'Amplitude (m)', 'Phase (deg)', 'Residual (m)'];

const responseRows = (config: ModelConfig, result: AnalysisResult) => result.pairs.map((pair) => config.testCase === 'black_kipp'
  ? [pair.testName, pair.pumpingWellName, pair.observationWellName, pair.distanceMeters, pair.periodSeconds,
    pair.predicted.real.toExponential(5), pair.predicted.imag.toExponential(5), pair.predicted.amplitude.toExponential(5),
    (pair.numericalPhaseDegrees ?? 0).toFixed(3), pair.analytical?.amplitude.toExponential(5) ?? '',
    pair.analytical?.phaseDegrees.toFixed(3) ?? '', ((pair.amplitudeRelativeError ?? 0) * 100).toFixed(5),
    pair.phaseErrorDegrees?.toFixed(5) ?? '', pair.effectiveProperties?.diffusivityM2PerSecond.toExponential(5) ?? '',
    pair.effectiveProperties?.transmissivityM2PerSecond.toExponential(5) ?? '', pair.effectiveProperties?.storativity.toExponential(5) ?? '']
  : [pair.testName, pair.pumpingWellName, pair.observationWellName, pair.periodSeconds,
    pair.predicted.real.toExponential(5), pair.predicted.imag.toExponential(5), pair.predicted.amplitude.toExponential(5),
    pair.predicted.phaseDegrees.toFixed(3), pair.residualAmplitude?.toExponential(5) ?? '']);

const blackKippMetrics = (result: AnalysisResult) => ({
  meanAmplitudeErrorPercent: 100 * result.pairs.reduce((sum, pair) => sum + (pair.amplitudeRelativeError ?? 0), 0) / Math.max(1, result.pairs.length),
  meanPhaseErrorDegrees: result.pairs.reduce((sum, pair) => sum + (pair.phaseErrorDegrees ?? 0), 0) / Math.max(1, result.pairs.length),
});

/** Build one canonical report object so every export format contains the same facts. */
export function buildReportData(config: ModelConfig, result: AnalysisResult) {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    title: titleFor(config),
    summary: summaryFor(config, result),
    experiment: {
      testCase: config.testCase,
      analysisMode: result.analysisMode,
      domainMeters: { minX: config.minX, maxX: config.maxX, minY: config.minY, maxY: config.maxY },
      grid: { nx: config.gridNx, ny: config.gridNy, cells: config.gridNx * config.gridNy },
      initialLnK: config.initialLnK,
      initialLnSs: config.initialLnSs,
      dataErrorVariance: config.dataErrorVar,
      correlationLengthMeters: { x: config.corrLengthX, y: config.corrLengthY },
      boundaries: config.boundaries,
      wells: config.wells,
      tests: config.tests,
    },
    solver: {
      runtimeSeconds: result.runtimeSeconds,
      iterations: result.iterations,
      objective: result.objective,
      diagnostics: result.diagnostics,
      objectiveHistory: result.objectiveHistory,
    },
    responses: result.pairs,
    fields: {
      true: result.trueFields,
      estimated: result.fields,
      error: result.errorFields,
      logSensitivityCoverage: result.sensitivityFields,
    },
    assumptions: ['One horizontal layer with unit thickness.', 'No flow through the top and bottom boundaries.'],
  };
}

function markdown(config: ModelConfig, result: AnalysisResult) {
  const data = buildReportData(config, result);
  const diagnostics = result.diagnostics;
  const comparison = config.testCase === 'black_kipp' ? blackKippMetrics(result) : null;
  const headers = responseHeader(config);
  const lines = [
    `# ${data.title}`,
    '', data.summary, '', `Generated: ${data.generatedAt}`, '',
    '## Experiment summary', '',
    `- Analysis mode: ${result.analysisMode}`,
    `- Domain: x ${config.minX} to ${config.maxX} m; y ${config.minY} to ${config.maxY} m`,
    `- Grid: ${config.gridNx} x ${config.gridNy} (${config.gridNx * config.gridNy} cells)`,
    `- Wells: ${config.wells.length}`, `- Tests: ${config.tests.length}`, `- Response pairs: ${result.pairs.length}`,
    `- Solver runtime: ${result.runtimeSeconds.toFixed(3)} s`,
    `- Outer inversion iterations: ${result.iterations}`,
    `- Final objective: ${result.objective?.toPrecision(7) ?? 'N/A'}`, '',
    '## Diagnostics', '',
    `- Complex response RMSE: ${diagnostics?.responseRmse.toExponential(5) ?? 'N/A (no measured observations)'}`,
    `- ${comparison ? 'Mean absolute phase error' : 'Phase RMSE'}: ${comparison?.meanPhaseErrorDegrees.toFixed(5) ?? diagnostics?.phaseRmseDegrees.toFixed(5) ?? 'N/A'} deg`,
    `- Mean relative amplitude error: ${comparison ? `${comparison.meanAmplitudeErrorPercent.toFixed(5)}%` : diagnostics ? `${(100 * diagnostics.meanAmplitudeRelativeError).toFixed(5)}%` : 'N/A'}`,
    `- ln(K) field RMSE: ${diagnostics?.lnKFieldRmse?.toFixed(6) ?? 'N/A'}`,
    `- ln(Ss) field RMSE: ${diagnostics?.lnSsFieldRmse?.toFixed(6) ?? 'N/A'}`, '',
    '## Test configuration', '',
    ...config.tests.map((test) => `- **${test.name}:** pump ${config.wells.find((well) => well.id === test.pumpingWellId)?.name}; observe ${test.observationWellIds.map((id) => config.wells.find((well) => well.id === id)?.name).join(', ')}; period ${test.pumpingPeriod ?? config.pumpingPeriod} s; rate ${test.pumpingRate ?? config.pumpingRate} m^3/s.`),
    '', '## Computed complex responses', '',
    `| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`,
    ...responseRows(config, result).map((row) => `| ${row.join(' | ')} |`), '',
    '## Assumptions', '', ...data.assumptions.map((item) => `- ${item}`), '',
    '_All numerical values in this report come from the Python solver result returned for this run._',
  ];
  return lines.join('\n');
}

const plainText = (config: ModelConfig, result: AnalysisResult) => markdown(config, result)
  .replace(/^#{1,6}\s+/gm, '').replace(/\*\*/g, '').replace(/^\|/gm, '').replace(/\|$/gm, '').replace(/\|/g, '  ');

const escapeHtml = (value: unknown) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

function html(config: ModelConfig, result: AnalysisResult) {
  const data = buildReportData(config, result);
  const comparison = config.testCase === 'black_kipp' ? blackKippMetrics(result) : null;
  const comparisonHtml = comparison ? `<h2>Comparison diagnostics</h2><dl><dt>Mean relative amplitude error</dt><dd>${comparison.meanAmplitudeErrorPercent.toFixed(5)}%</dd><dt>Mean absolute phase error</dt><dd>${comparison.meanPhaseErrorDegrees.toFixed(5)} deg</dd></dl>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(data.title)}</title><style>body{font:14px/1.5 Inter,Arial,sans-serif;color:#171717;max-width:1100px;margin:40px auto;padding:0 24px}h1{border-bottom:4px solid #c5050c;padding-bottom:12px}h2{margin-top:30px}dl{display:grid;grid-template-columns:220px 1fr;gap:6px 18px;background:#f5f5f5;padding:18px}dt{font-weight:700}dd{margin:0}.table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:10px}th,td{border:1px solid #ddd;padding:5px;text-align:left;white-space:nowrap}th{background:#171717;color:white}tr:nth-child(even){background:#f7f7f7}.note{color:#555}@media print{body{margin:0}.page-break{break-before:page}}</style></head><body><h1>${escapeHtml(data.title)}</h1><p>${escapeHtml(data.summary)}</p><p class="note">Generated ${escapeHtml(data.generatedAt)}</p><h2>Experiment summary</h2><dl><dt>Analysis mode</dt><dd>${escapeHtml(result.analysisMode)}</dd><dt>Domain</dt><dd>x ${config.minX} to ${config.maxX} m; y ${config.minY} to ${config.maxY} m</dd><dt>Grid</dt><dd>${config.gridNx} x ${config.gridNy}</dd><dt>Wells / tests / responses</dt><dd>${config.wells.length} / ${config.tests.length} / ${result.pairs.length}</dd><dt>Runtime</dt><dd>${result.runtimeSeconds.toFixed(3)} s</dd><dt>Iterations / objective</dt><dd>${result.iterations} / ${result.objective?.toPrecision(7) ?? 'N/A'}</dd></dl>${comparisonHtml}<h2>Test configuration</h2><ul>${config.tests.map((test) => `<li><strong>${escapeHtml(test.name)}</strong>: pump ${escapeHtml(config.wells.find((well) => well.id === test.pumpingWellId)?.name)}; observe ${escapeHtml(test.observationWellIds.map((id) => config.wells.find((well) => well.id === id)?.name).join(', '))}; period ${test.pumpingPeriod ?? config.pumpingPeriod} s.</li>`).join('')}</ul><h2 class="page-break">Computed complex responses</h2><div class="table-wrap"><table><thead><tr>${responseHeader(config).map((item) => `<th>${escapeHtml(item)}</th>`).join('')}</tr></thead><tbody>${responseRows(config, result).map((row) => `<tr>${row.map((item) => `<td>${escapeHtml(item)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><h2>Assumptions</h2><ul>${data.assumptions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><p class="note">All numerical values come from the Python solver result returned for this run.</p></body></html>`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function pdf(config: ModelConfig, result: AnalysisResult, basename: string) {
  // Keep the sizeable PDF engine out of the initial application bundle. It is
  // downloaded only after the user explicitly selects PDF export.
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  document.setProperties({ title: titleFor(config), subject: summaryFor(config, result), creator: 'Aquifer Imaging Studio' });
  document.setFillColor(197, 5, 12); document.rect(0, 0, 297, 18, 'F');
  document.setTextColor(255, 255, 255); document.setFontSize(17); document.text(titleFor(config), 14, 12);
  document.setTextColor(30, 30, 30); document.setFontSize(10); document.text(summaryFor(config, result), 14, 27);
  const details = [
    ['Analysis mode', result.analysisMode], ['Domain', `x ${config.minX} to ${config.maxX} m; y ${config.minY} to ${config.maxY} m`],
    ['Grid', `${config.gridNx} x ${config.gridNy}`], ['Wells / tests / responses', `${config.wells.length} / ${config.tests.length} / ${result.pairs.length}`],
    ['Runtime', `${result.runtimeSeconds.toFixed(3)} s`], ['Iterations / objective', `${result.iterations} / ${result.objective?.toPrecision(7) ?? 'N/A'}`],
  ];
  if (config.testCase === 'black_kipp') {
    const comparison = blackKippMetrics(result);
    details.push(['Mean amplitude / phase error', `${comparison.meanAmplitudeErrorPercent.toFixed(5)}% / ${comparison.meanPhaseErrorDegrees.toFixed(5)} deg`]);
  }
  autoTable(document, { startY: 34, body: details, theme: 'grid', styles: { fontSize: 9, cellPadding: 2 }, columnStyles: { 0: { fontStyle: 'bold', fillColor: [245, 245, 245] } }, tableWidth: 150 });
  autoTable(document, { startY: 76, head: [responseHeader(config)], body: responseRows(config, result), theme: 'striped', styles: { fontSize: config.testCase === 'black_kipp' ? 4.8 : 6.8, cellPadding: 1.2 }, headStyles: { fillColor: [25, 25, 25] }, margin: { left: 8, right: 8 }, didDrawPage: ({ pageNumber }) => { document.setFontSize(8); document.setTextColor(100); document.text(`Aquifer Imaging Studio - page ${pageNumber}`, 14, 204); } });
  document.save(`${basename}.pdf`);
}

async function docx(config: ModelConfig, result: AnalysisResult, basename: string) {
  // Word generation is likewise loaded on demand so opening the explorer stays fast.
  const { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = await import('docx');
  const rows = [responseHeader(config), ...responseRows(config, result)].map((row, rowIndex) => new TableRow({ children: row.map((value) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(value), bold: rowIndex === 0 })] })] })) }));
  const document = new Document({ sections: [{ children: [
    new Paragraph({ text: titleFor(config), heading: HeadingLevel.TITLE }), new Paragraph(summaryFor(config, result)),
    new Paragraph({ text: 'Experiment summary', heading: HeadingLevel.HEADING_1 }),
    new Paragraph(`Analysis mode: ${result.analysisMode}`), new Paragraph(`Domain: x ${config.minX} to ${config.maxX} m; y ${config.minY} to ${config.maxY} m`),
    new Paragraph(`Grid: ${config.gridNx} x ${config.gridNy}; wells: ${config.wells.length}; tests: ${config.tests.length}; responses: ${result.pairs.length}`),
    new Paragraph(`Solver runtime: ${result.runtimeSeconds.toFixed(3)} s; iterations: ${result.iterations}; objective: ${result.objective?.toPrecision(7) ?? 'N/A'}`),
    ...(config.testCase === 'black_kipp' ? [new Paragraph(`Mean relative amplitude error: ${blackKippMetrics(result).meanAmplitudeErrorPercent.toFixed(5)}%; mean absolute phase error: ${blackKippMetrics(result).meanPhaseErrorDegrees.toFixed(5)} degrees.`)] : []),
    new Paragraph({ text: 'Test configuration', heading: HeadingLevel.HEADING_1 }),
    ...config.tests.map((test) => new Paragraph({ text: `${test.name}: pump ${config.wells.find((well) => well.id === test.pumpingWellId)?.name}; observe ${test.observationWellIds.map((id) => config.wells.find((well) => well.id === id)?.name).join(', ')}; period ${test.pumpingPeriod ?? config.pumpingPeriod} s.`, bullet: { level: 0 } })),
    new Paragraph({ text: 'Computed complex responses', heading: HeadingLevel.HEADING_1 }),
    new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }),
    new Paragraph({ text: 'Assumptions', heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: 'One horizontal layer with unit thickness.', bullet: { level: 0 } }), new Paragraph({ text: 'No flow through the top and bottom boundaries.', bullet: { level: 0 } }),
  ] }] });
  downloadBlob(await Packer.toBlob(document), `${basename}.docx`);
}

export async function exportReport(format: ReportFormat, config: ModelConfig, result: AnalysisResult) {
  const basename = `oscillatory-tomography-${config.testCase}-${new Date().toISOString().slice(0, 10)}`;
  if (format === 'pdf') return pdf(config, result, basename);
  if (format === 'docx') return docx(config, result, basename);
  const content = format === 'md' ? markdown(config, result) : format === 'txt' ? plainText(config, result) : format === 'html' ? html(config, result) : JSON.stringify(buildReportData(config, result), null, 2);
  const mime = format === 'html' ? 'text/html;charset=utf-8' : format === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8';
  downloadBlob(new Blob([content], { type: mime }), `${basename}.${format}`);
}
