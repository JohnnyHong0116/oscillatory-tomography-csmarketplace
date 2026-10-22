const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file) {
  const loaded = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { module: loaded, exports: loaded.exports, structuredClone, require: name => name.startsWith('.') ? load(path.resolve(path.dirname(file), name + '.ts')) : require(name) });
  return loaded.exports;
}
const { createExperiment, createExample, modelIssues, testIssues, prepareInversion } = load(path.join(__dirname, '../src/utils/experimentWorkflow.ts'));
function forward(type = 'black_kipp') {
  const session = createExample(type);
  session.result = { analysisMode: 'forward', mode: 'forward', grid: { nx: session.config.gridNx, ny: session.config.gridNy },
    pairs: session.config.tests.flatMap(t => t.observationWellIds.map((id, index) => ({ testId: t.id, pumpingWellId: t.pumpingWellId, observationWellId: id,
      periodSeconds: t.pumpingPeriod ?? session.config.pumpingPeriod, pumpingRateM3PerSecond: t.pumpingRate ?? session.config.pumpingRate,
      predicted: { real: 1.234567890123456e-12 * (index + 1), imag: -0.0001234567890123456 } }))) };
  return session;
}

test('personal experiments have no invented wells, test roles or demo inversion', () => {
  const a = createExperiment(), b = createExperiment();
  assert.equal(a.config.wells.length, 0); assert.equal(a.config.tests.length, 0);
  assert.equal(a.runInput.analysisMode, 'forward'); assert.equal(a.config.maxIterations, 30);
  a.config.boundaries.west = 'no_flow'; assert.equal(b.config.boundaries.west, 'constant_head');
  assert.match(modelIssues(a.config).join(' '), /2–30 physical wells/);
});

test('examples remain isolated clones of the untouched numerical baselines', () => {
  const a = createExample('black_kipp'), b = createExample('black_kipp');
  assert.equal(a.config.gridNx, 300); assert.equal(a.config.tests.length, 20);
  assert.equal(testIssues(a.config).length, 0);
  a.config.wells[0].x = 20; assert.equal(b.config.wells[0].x, 0);
  const p = createExample('inversion_10s');
  assert.equal(p.runInput.analysisMode, 'synthetic_demo'); assert.equal(p.config.tests.length, 8);
  assert.equal(p.config.tests.reduce((n, t) => n + t.observationWellIds.length, 0), 36);
  assert.equal(testIssues(p.config).length, 0);
});

test('Black–Kipp forward handoff retains all 80 full-precision observations and explicit source grid', () => {
  const source = forward(), snapshot = JSON.stringify(source);
  const target = prepareInversion(source, 60, 60);
  assert.equal(target.config.testCase, 'inversion_10s'); assert.equal(target.step, 3);
  assert.equal(target.config.gridNx, 60); assert.equal(target.forwardSource.config.gridNx, 300);
  assert.equal(target.runInput.observationSource, 'synthetic'); assert.equal(target.runInput.analysisMode, 'measured_inversion');
  assert.equal(target.result, null);
  assert.equal(target.runInput.csv.split('\r\n').length, 81);
  const first = target.runInput.csv.split('\r\n')[1].split(',');
  assert.equal(Number(first[2]), source.result.pairs[0].predicted.real);
  assert.equal(Number(first[3]), source.result.pairs[0].predicted.imag);
  assert.equal(JSON.stringify(target.config.tests), JSON.stringify(source.config.tests));
  assert.equal(JSON.stringify(target.config.wells), JSON.stringify(source.config.wells));
  assert.equal(JSON.stringify(target.config.boundaries), JSON.stringify(source.config.boundaries));
  assert.equal(JSON.stringify(source), snapshot);
  target.forwardSource.config.wells[0].x = 10; assert.equal(source.config.wells[0].x, 0);
});

test('handoff rejects stale, duplicate, missing and non-finite phasors', () => {
  for (const mutate of [
    s => s.result.pairs.pop(), s => s.result.pairs.push(s.result.pairs[0]),
    s => s.result.pairs[0].predicted.real = NaN, s => s.config.tests[0].pumpingRate *= 2,
    s => s.config.tests[0].observationWellIds.pop(), s => s.result.grid.nx = 60,
    s => s.result.analysisMode = 'synthetic_demo',
  ]) { const source = forward(); mutate(source); assert.throws(() => prepareInversion(source, 60, 60)); }
  for (const count of [0, 2, 61, 12.5, NaN]) assert.throws(() => prepareInversion(forward(), count, 60));
});

test('same-grid forward handoff works and coarse grids may not exclude physical wells', () => {
  const source = forward('inversion_10s');
  assert.equal(prepareInversion(source, 50, 50).forwardSource.config.gridNx, 50);
  source.config.wells[0].x = -48;
  assert.throws(() => prepareInversion(source, 3, 3), /outer cell centers/);
});

test('model and test gates reject invalid inputs before run without changing them', () => {
  const s = createExample('inversion_10s');
  s.config.tests[0].pumpingPeriod = 0; s.config.tests[0].observationWellIds.push(s.config.tests[0].pumpingWellId);
  s.config.gridNx = 2.5; s.config.minY = NaN;
  const problems = testIssues(s.config).join(' ');
  assert.match(problems, /domain extents/); assert.match(problems, /whole grid counts/); assert.match(problems, /positive/); assert.match(problems, /one pump/);
  assert.equal(s.config.tests[0].pumpingPeriod, 0);
});
