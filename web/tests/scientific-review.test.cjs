const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadSource(file) {
  const loaded = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { module: loaded, exports: loaded.exports,
    require: specifier => specifier.startsWith('.') ? loadSource(path.resolve(path.dirname(file), specifier + '.ts')) : require(specifier) });
  return loaded.exports;
}
const root = path.join(__dirname, '../src');
const { matchesBaselineConfiguration, scientificDesignSummary } = loadSource(path.join(root, 'utils/scientificReview.ts'));
const { DEFAULT_INVERSION_CONFIG, BLACK_KIPP_CONFIG } = loadSource(path.join(root, 'data/presets.ts'));
const clone = config => JSON.parse(JSON.stringify(config));

test('both original numerical presets are recognized without modifying them', () => {
  for (const config of [DEFAULT_INVERSION_CONFIG, BLACK_KIPP_CONFIG]) {
    const snapshot = JSON.stringify(config);
    assert.equal(matchesBaselineConfiguration(config), true);
    scientificDesignSummary(config);
    assert.equal(JSON.stringify(config), snapshot);
  }
});

test('numerical edits distinguish custom runs, while labels and progress do not', () => {
  const custom = clone(DEFAULT_INVERSION_CONFIG);
  custom.maxIterations = 5;
  assert.equal(matchesBaselineConfiguration(custom), false);
  const renamed = clone(DEFAULT_INVERSION_CONFIG);
  renamed.wells[0].name = 'Site A'; renamed.tests[0].name = 'First test'; renamed.tests[0].progressPct = 50;
  assert.equal(matchesBaselineConfiguration(renamed), true);
  renamed.tests[0].observationWellIds.pop();
  assert.equal(matchesBaselineConfiguration(renamed), false);
});

test('scientific summary reports actual pair, period, parameter and grid counts', () => {
  const inversion = scientificDesignSummary(DEFAULT_INVERSION_CONFIG);
  assert.equal(inversion.pairs, 36); assert.equal(inversion.realComponents, 72);
  assert.equal(inversion.unknowns, 5000); assert.equal(inversion.periods, 1);
  assert.equal(inversion.dx, 2); assert.equal(inversion.shortestDistance, 20);
  const comparison = scientificDesignSummary(BLACK_KIPP_CONFIG);
  assert.equal(comparison.periods, 20); assert.equal(comparison.pairs, 80);
});

test('geometry advisories flag co-location and sub-cell separation without changing geometry', () => {
  const custom = clone(DEFAULT_INVERSION_CONFIG);
  custom.wells[1].x = custom.wells[0].x; custom.wells[1].y = custom.wells[0].y;
  assert.equal(scientificDesignSummary(custom).coincidentPair, true);
  custom.wells[1].y += 0.5;
  assert.equal(scientificDesignSummary(custom).subcellSpacing, true);
  assert.equal(custom.wells[1].y, -19.5);
});
