const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const loaded = { exports: {} };
const source = fs.readFileSync(path.join(__dirname, '../src/utils/fieldInspection.ts'), 'utf8');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
  { module: loaded, exports: loaded.exports });
const { fieldCellAt } = loaded.exports;
const domain = { minX: -50, maxX: 50, minY: -50, maxY: 50 };

test('well coordinates on grid boundaries select the containing cell without shifting the well', () => {
  const well = { x: -20, y: 0 };
  const sample = fieldCellAt(well.x, well.y, 50, 50, domain);
  assert.equal(sample.column, 15);
  assert.equal(sample.row, 25);
  assert.deepEqual(well, { x: -20, y: 0 });
});

test('field inspection clamps domain edges and preserves south-to-north row order', () => {
  assert.equal(fieldCellAt(-50, -50, 50, 50, domain).row, 0);
  const topRight = fieldCellAt(50, 50, 50, 50, domain);
  assert.equal(topRight.row, 49);
  assert.equal(topRight.column, 49);
  assert.equal(fieldCellAt(-100, -100, 50, 50, domain).column, 0);
});
