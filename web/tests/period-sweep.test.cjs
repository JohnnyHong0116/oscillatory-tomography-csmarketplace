const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(relative, extras = {}) {
  const loaded = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../src', relative), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { module: loaded, exports: loaded.exports, require, ...extras });
  return loaded.exports;
}
const { makePeriods, wellSetups, sweepTests } = load('utils/periodSweep.ts');
const { DEFAULT_INVERSION_CONFIG: inversion, BLACK_KIPP_CONFIG: black } = load('data/presets.ts');
const { syntheticObservationCsv } = load('utils/syntheticObservations.ts');
const { parseObservations } = load('api/analysis.ts', { window: { location: { port: '8000' } } });

test('log sweep reproduces original Black-Kipp periods without changing the baseline', () => {
  const before = JSON.stringify(black);
  const periods = makePeriods('logarithmic', 10, 10000, 10, 20, '');
  assert.equal(periods.length, 20);
  periods.forEach((period, index) => assert.ok(Math.abs(period / black.tests[index].pumpingPeriod - 1) < 1e-14));
  const setups = wellSetups(black.tests);
  assert.equal(setups.length, 1);
  const tests = sweepTests(black, setups, periods, .001, 'rate', 'run');
  assert.equal(tests.length, 20);
  tests.forEach(item => { assert.equal(item.pumpingRate, .001); assert.deepEqual(Array.from(item.observationWellIds), ['w-2', 'w-3', 'w-4', 'w-5']); });
  assert.equal(JSON.stringify(black), before);
});

test('linear sweeps include the endpoint and explicit lists are sorted and deduplicated', () => {
  assert.deepEqual(Array.from(makePeriods('linear', 10, 35, 10, 0, '')), [10, 20, 30, 35]);
  assert.deepEqual(Array.from(makePeriods('list', 0, 0, 0, 0, '50, 10; 10 20')), [10, 20, 50]);
  for (const args of [['linear', 10, 20, 0, 0, ''], ['logarithmic', 10, 100, 0, 100, ''], ['list', 0, 0, 0, 0, ''], ['list', 0, 0, 0, 0, 'NaN,10'], ['linear', 10, 1e12, 1, 0, '']]) assert.throws(() => makePeriods(...args));
});

test('multi-period tomography retains all eight geometries and the MATLAB volume-to-rate rule', () => {
  const before = JSON.stringify(inversion);
  const tests = sweepTests(inversion, wellSetups(inversion.tests), [10, 50], .01, 'volume', 'run');
  assert.equal(tests.length, 16);
  assert.equal(tests.reduce((sum, item) => sum + item.observationWellIds.length, 0), 72);
  assert.equal(new Set(tests.map(item => item.id)).size, 16);
  assert.equal(tests[0].pumpingRate, Math.PI * .01 / 10);
  assert.equal(tests[8].pumpingRate, Math.PI * .01 / 50);
  assert.equal(tests[8].pumpingWellId, inversion.tests[0].pumpingWellId);
  assert.equal(JSON.stringify(inversion), before);
});

test('sweep capacity checks reject excessive work and allow fewer selected setups', () => {
  assert.throws(() => sweepTests(inversion, wellSetups(inversion.tests), [10, 20, 50], .001, 'rate', 'run'), /108 response pairs/);
  assert.equal(sweepTests(inversion, [inversion.tests[0]], [10, 20, 50], .001, 'rate', 'run').length, 3);
  assert.throws(() => sweepTests(inversion, [], [10], .001, 'rate', 'run'));
  assert.throws(() => sweepTests(inversion, [inversion.tests[0]], [10], 0, 'rate', 'run'));
});

test('forward CSV round-trips through the real inversion-input parser at full precision', () => {
  const config = { tests: [{ id: 't1', observationWellIds: ['w2'] }] };
  const result = { analysisMode: 'forward', pairs: [{ testId: 't1', observationWellId: 'w2', predicted: { real: 1.234567890123e-9, imag: -.00234567890123 } }] };
  const before = JSON.stringify(result);
  const rows = parseObservations(syntheticObservationCsv(result), config);
  assert.equal(rows[0].real, result.pairs[0].predicted.real);
  assert.equal(rows[0].imag, result.pairs[0].predicted.imag);
  assert.equal(JSON.stringify(result), before);
  assert.throws(() => syntheticObservationCsv({ ...result, analysisMode: 'measured_inversion' }));
});
