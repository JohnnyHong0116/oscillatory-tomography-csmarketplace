const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { publishBuild } = require('../scripts/build.cjs');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aquifer-build-test-'));
  const old = path.join(root, 'dist'), stage = path.join(root, 'staging');
  fs.mkdirSync(old); fs.mkdirSync(stage);
  fs.writeFileSync(path.join(old, 'index.html'), '<script src="old.js"></script>');
  fs.writeFileSync(path.join(old, 'old.js'), 'old entry');
  fs.writeFileSync(path.join(old, 'report-chunk.js'), 'old lazy report');
  return { root, old, stage };
}
test('fresh publishing replaces index, retains lazy assets and preserves a recoverable previous release', () => {
  const { root, old, stage } = fixture();
  fs.writeFileSync(path.join(stage, 'index.html'), '<script type=module src=new.js></script>');
  fs.writeFileSync(path.join(stage, 'new.js'), 'new entry');
  const { backup } = publishBuild(root, stage);
  assert.match(fs.readFileSync(path.join(old, 'index.html'), 'utf8'), /new.js/);
  assert.equal(fs.readFileSync(path.join(old, 'report-chunk.js'), 'utf8'), 'old lazy report');
  assert.match(fs.readFileSync(path.join(backup, 'index.html'), 'utf8'), /old.js/);
});
test('an incomplete build cannot replace the working release', () => {
  const { root, old, stage } = fixture();
  fs.writeFileSync(path.join(stage, 'index.html'), '<script src="missing.js"></script>');
  assert.throws(() => publishBuild(root, stage), /Missing build entry/);
  assert.match(fs.readFileSync(path.join(old, 'index.html'), 'utf8'), /old.js/);
});
