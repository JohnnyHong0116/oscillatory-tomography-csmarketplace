const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const loaded = { exports: {} }; cache.set(file, loaded);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, { module: loaded, exports: loaded.exports, structuredClone, require: name => {
    if (!name.startsWith('.')) return require(name);
    const base = path.resolve(path.dirname(file), name);
    return load(['.ts', '.tsx'].map(ext => base + ext).find(candidate => fs.existsSync(candidate)));
  } });
  return loaded.exports;
}
const root = path.join(__dirname, '../src');
const { Step5ExploreResults } = load(path.join(root, 'components/steps/Step5ExploreResults.tsx'));
const { createExperiment } = load(path.join(root, 'utils/experimentWorkflow.ts'));
const { summaryFor, buildReportData } = load(path.join(root, 'reporting/reportExport.ts'));
const config = createExperiment().config;
const field = Array.from({ length: 3 }, () => [-9, -9, -9]);
const base = { mode: 'inversion', analysisMode: 'measured_inversion', observationSource: 'synthetic', pairs: [],
  fields: { lnK: field, lnSs: field }, trueFields: null, errorFields: null, sensitivityFields: { lnK: field, lnSs: field },
  objectiveHistory: [{ iteration: 1, objective: 0 }], iterations: 1, objective: 0, runtimeSeconds: 1,
  diagnostics: { responseRmse: 0, phaseRmseDegrees: 0, meanAmplitudeRelativeError: 0 }, grid: { nx: 3, ny: 3 } };
function render(result) { return renderToStaticMarkup(React.createElement(Step5ExploreResults, { config, result, onOpenReport() {}, onTransfer() {}, onPrev() {} })); }

test('imported inversion shows available diagnostics, not empty truth-error tabs or false baseline labels', () => {
  const markup = render(base);
  assert.match(markup, /Joint estimate/); assert.match(markup, /Sensitivity coverage/);
  assert.doesNotMatch(markup, />Field error</); assert.doesNotMatch(markup, /Original baseline/);
  assert.match(markup, /Phase fit RMSE/); assert.doesNotMatch(markup, /Against labelled synthetic truth/);
});

test('forward results expose direct handoff and meaningful input metrics rather than missing field errors', () => {
  const markup = render({ ...base, mode: 'forward', analysisMode: 'forward', fields: null, sensitivityFields: null, diagnostics: null, objectiveHistory: [] });
  assert.match(markup, /Use these responses for inversion/); assert.match(markup, /Initial conductivity K/);
  assert.match(markup, /aria-label="Forward result actions" class="flex flex-wrap items-center gap-3"/);
  assert.equal((markup.match(/min-h-10 w-full/g) || []).length, 2);
  assert.match(markup, /Forward responses/); assert.doesNotMatch(markup, /Combined joint inversion/);
  assert.doesNotMatch(markup, /LN\(K\) FIELD RMSE/i);
});

test('reports retain both generating and inverse grid provenance with a synthetic-data qualification', () => {
  const result = { ...base, forwardInput: { sourceGrid: { nx: 300, ny: 300 }, inversionGrid: { nx: 60, ny: 60 }, responsePairs: 80 } };
  assert.match(summaryFor(config, result), /not field measurements/);
  assert.match(summaryFor(config, result), /300 x 300 forward grid/);
  assert.match(summaryFor(config, result), /60 x 60 cells/);
  assert.deepEqual(buildReportData(config, result).experiment.forwardInput, result.forwardInput);
});
