const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const componentCache = new Map();
function loadComponent(name) {
  if (componentCache.has(name)) return componentCache.get(name);
  const filename = path.join(__dirname, '../src/components/steps', `${name}.tsx`);
  const loaded = { exports: {} };
  componentCache.set(name, loaded.exports);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } });
  vm.runInNewContext(compiled.outputText, { module: loaded, exports: loaded.exports,
    require: name => name.startsWith('./') ? loadComponent(name.slice(2)) : require(name) });
  return loaded.exports;
}

test('tomography plots share one collapsed index and retain interactive point targets', () => {
  const { ResponsePlots } = loadComponent('ResponsePlots');
  const pairs = Array.from({ length: 36 }, (_, index) => ({
    testId: `test-${index}`, testName: `Test ${index + 1}`, pumpingWellName: 'W1',
    observationWellId: 'w2', observationWellName: 'W2', periodSeconds: 10, distanceMeters: 30,
    predicted: { amplitude: .001 + index * .001, phaseDegrees: index, real: .001, imag: 0 },
  }));
  const markup = renderToStaticMarkup(React.createElement(ResponsePlots, { config: { testCase: 'p10' }, pairs }));
  assert.equal((markup.match(/<details/g) || []).length, 1);
  assert.doesNotMatch(markup, /<details open/);
  assert.match(markup, /Response pair index \(36\)/);
  assert.equal((markup.match(/>Response pair<\/text>/g) || []).length, 2);
  assert.equal((markup.match(/aria-label="Inspect /g) || []).length, 72);
  assert.equal((markup.match(/aria-label="Enlarge /g) || []).length, 2);
  assert.equal((markup.match(/Test 36: W1 → W2<\/li>/g) || []).length, 1);
});

test('property and convergence charts expose an accessible enlargement control without changing data', () => {
  const { SeriesPlot } = loadComponent('SeriesPlot');
  const x = [1, 2, 3];
  const series = [{ label: 'Objective', values: [100, 10, 1], color: '#C5050C' }];
  const before = JSON.stringify({ x, series });
  const markup = renderToStaticMarkup(React.createElement(SeriesPlot, {
    title: 'Convergence', x, series, xLabel: 'Iteration', yLabel: 'Objective', logarithmicY: true,
  }));
  assert.match(markup, /aria-label="Enlarge Convergence"/);
  assert.match(markup, /group-focus-within:opacity-100/);
  assert.match(markup, /hover:none/);
  assert.equal((markup.match(/aria-label="Inspect /g) || []).length, 3);
  assert.equal(JSON.stringify({ x, series }), before);
});
