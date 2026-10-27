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
    return load(['.ts', '.tsx'].map(ext => base + ext).find(fs.existsSync));
  } });
  return loaded.exports;
}
const root = path.join(__dirname, '../src');
const { periodGroups, addPeriodGroup, testsInPeriod } = load(path.join(root, 'utils/periodGroups.ts'));
const { signalValue, signalRadius, phaseColor } = load(path.join(root, 'utils/signalMap.ts'));
const { createExample } = load(path.join(root, 'utils/experimentWorkflow.ts'));
const { matchesBaselineConfiguration } = load(path.join(root, 'utils/scientificReview.ts'));
const { SignalMap } = load(path.join(root, 'components/steps/SignalMap.tsx'));
const { Step5ExploreResults } = load(path.join(root, 'components/steps/Step5ExploreResults.tsx'));
const { Step2ConfigureModel } = load(path.join(root, 'components/steps/Step2ConfigureModel.tsx'));
const { buildReportData, summaryFor } = load(path.join(root, 'reporting/reportExport.ts'));

test('period groups sort presentation only; exact periods, IDs and setup order are preserved', () => {
  const config = createExample('inversion_10s').config;
  config.tests[0].pumpingPeriod = 20; config.tests[1].pumpingPeriod = 10.0000000001;
  const snapshot = JSON.stringify(config);
  const groups = periodGroups(config);
  assert.equal(groups.length, 3); assert.equal(groups[0].period, 10);
  assert.equal(groups[1].period, 10.0000000001); assert.equal(groups[2].period, 20);
  assert.equal(testsInPeriod(config, '20')[0].id, config.tests[0].id);
  assert.equal(JSON.stringify(config), snapshot);
  assert.equal(new Set(testsInPeriod(config, 'all').map(t => t.id)).size, config.tests.length);
});

test('new groups persist without inventing tests; existing periods do not create duplicates', () => {
  const config = createExample('inversion_10s').config;
  const next = addPeriodGroup(config, 50);
  assert.equal(next.tests.length, config.tests.length);
  assert.equal(periodGroups(next).find(g => g.period === 50).tests.length, 0);
  assert.equal(addPeriodGroup(next, 50), next);
  for (const n of [NaN, Infinity, 0, -1]) assert.throws(() => addPeriodGroup(config, n));
});

test('period drafts stay visible while cleared or moved and invalid periods are never hidden', () => {
  const config = createExample('inversion_10s').config;
  const t = config.tests[0]; t.pumpingPeriod = NaN;
  assert.ok(testsInPeriod(config, '50').some(x => x.id === t.id));
  t.pumpingPeriod = 20;
  assert.ok(testsInPeriod(config, '10', t.id).some(x => x.id === t.id));
  assert.ok(!testsInPeriod(config, '10').some(x => x.id === t.id));
});

test('map uses complex magnitudes and raw signed phase, including wrap and zero edge cases', () => {
  const p = { predicted: { real: 3, imag: -4 }, measured: { real: 0, imag: 0 }, numericalPhaseDegrees: 99 };
  assert.equal(signalValue(p, 'predicted').amplitude, 5);
  assert.ok(Math.abs(signalValue(p, 'predicted').phase + 53.13010235415598) < 1e-10);
  assert.equal(signalValue(p, 'measured').phase, null);
  assert.equal(signalValue({ ...p, measured: null }, 'measured'), null);
  assert.equal(phaseColor(-180), phaseColor(180));
  for (const scale of ['log', 'area']) {
    assert.ok(signalRadius(1e-8, [1e-8, 1e-4], scale) < signalRadius(1e-4, [1e-8, 1e-4], scale));
    assert.ok(Number.isFinite(signalRadius(0, [0], scale)));
    assert.ok(Number.isFinite(signalRadius(1e-4, [1e-4], scale)));
  }
});

test('signal map exposes one pump, unused wells, real inspection targets and full-screen viewer', () => {
  const config = createExample('inversion_10s').config;
  const t = config.tests[0];
  const result = { analysisMode: 'forward', pairs: [{ testId: t.id, observationWellId: t.observationWellIds[0], predicted: { real: 1e-3, imag: -2e-3 }, measured: null }] };
  const html = renderToStaticMarkup(React.createElement(SignalMap, { config, result, scope: 'all' }));
  assert.equal((html.match(/<polygon /g) || []).length, 1);
  assert.match(html, /Enlarge Well signal map/); assert.match(html, /Map pumping test/);
  assert.match(html, /Predicted heads/); assert.doesNotMatch(html, /Imported measurements/);
  assert.match(html, /Not sampled at pumping well|not response-scaled/);
  assert.match(html, /Inspect Test 1/); assert.match(html, /No spatial interpolation/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test('geostatistical selection cannot be mislabeled original checkerboard baseline; reports record realization', () => {
  const config = createExample('inversion_10s').config;
  assert.equal(matchesBaselineConfiguration(config), true);
  config.syntheticField = 'geostatistical'; config.syntheticSeed = 42;
  assert.equal(matchesBaselineConfiguration(config), false);
  const syntheticTruth = { kind: 'geostatistical', seed: 42, meanLnK: -9.2, meanLnSs: -11.2, parameters: { correlationLengthX: 20 } };
  const result = { analysisMode: 'forward', mode: 'forward', syntheticTruth, pairs: [], grid: { nx: 50, ny: 50 }, runtimeSeconds: 1 };
  assert.equal(buildReportData(config, result).experiment.syntheticTruth.seed, 42);
  assert.match(summaryFor(config, result), /seed 42/); assert.match(summaryFor(config, result), /not field measurements/);
});

test('synthetic forward results show generating model metadata, never nonexistent inverse field error', () => {
  const config = createExample('inversion_10s').config;
  const result = { mode: 'forward', analysisMode: 'forward', pairs: [], fields: null, trueFields: { lnK: [[-9.2]], lnSs: [[-11.2]] },
    errorFields: null, sensitivityFields: null, diagnostics: null, runtimeSeconds: 0.1, iterations: 0,
    syntheticTruth: { kind: 'geostatistical', seed: 42, meanLnK: -9.2, meanLnSs: -11.2, parameters: {} } };
  const html = renderToStaticMarkup(React.createElement(Step5ExploreResults, { config, result, onOpenReport() {}, onTransfer() {}, onPrev() {} }));
  assert.match(html, /Generating truth/); assert.match(html, /Generating field/);
  assert.doesNotMatch(html, /ln\(K\) field RMSE|Homogeneous forward-model input/);
});

test('maps default to supplied observations when present and label synthetic data honestly', () => {
  const config = createExample('inversion_10s').config, t = config.tests[0];
  const result = { analysisMode: 'synthetic_demo', pairs: [{ testId: t.id, observationWellId: t.observationWellIds[0], predicted: { real: 1e-3, imag: 0 }, measured: { real: 2e-3, imag: -1e-3 } }] };
  const html = renderToStaticMarkup(React.createElement(SignalMap, { config, result, scope: 'all' }));
  assert.match(html, /Synthetic observations · complex head signals/); assert.doesNotMatch(html, /Imported measurements/);
  assert.match(html, /value="measured" selected/);
});

test('test-role map follows cards only on desktop so it cannot overlay mobile Continue controls', () => {
  const config = createExample('inversion_10s').config;
  const html = renderToStaticMarkup(React.createElement(Step2ConfigureModel, { config, stage: 'tests', onChangeConfig() {}, onNext() {}, onPrev() {} }));
  assert.match(html, /lg:translate-y-\[var\(--test-map-offset\)\]/);
  assert.match(html, /--test-map-offset:0px/);
  assert.doesNotMatch(html, /style="transform:translateY/);
  assert.match(html, /Proceed to Review Inputs/);
});
