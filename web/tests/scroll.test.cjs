const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function setup(reduceMotion = false) {
  const frames = [], calls = [], loaded = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../src/utils/scroll.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { module: loaded, exports: loaded.exports, window: {
      requestAnimationFrame: fn => frames.push(fn), matchMedia: () => ({ matches: reduceMotion }),
    } });
  const element = { scrollIntoView: options => calls.push(['scroll', options]), focus: () => calls.push(['focus']) };
  return { reveal: loaded.exports.revealAfterRender, frames, calls, element };
}

test('plot-tab reveal waits for layout, aligns the section top, and keeps tab focus', () => {
  const fixture = setup();
  fixture.reveal(() => fixture.element, 'start', false);
  assert.equal(fixture.calls.length, 0);
  fixture.frames.shift()();
  assert.equal(fixture.calls.length, 0);
  fixture.frames.shift()();
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.calls[0][1].block, 'start');
  assert.equal(fixture.calls[0][1].behavior, 'smooth');
});

test('scroll reveal respects reduced motion and safely handles unmounted sections', () => {
  const fixture = setup(true);
  fixture.reveal(() => fixture.element, 'start', false);
  fixture.frames.shift()(); fixture.frames.shift()();
  assert.equal(fixture.calls[0][1].behavior, 'auto');
  fixture.reveal(() => null);
  fixture.frames.shift()(); fixture.frames.shift()();
  assert.equal(fixture.calls.length, 1);
});
