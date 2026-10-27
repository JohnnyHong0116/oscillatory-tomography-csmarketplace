const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

/** Execute App's actual event handlers with persistent hook slots. Children are
 * named stubs: this tests session ownership/navigation rather than duplicating
 * their implementation or making assertions against source-code strings. */
function appHarness() {
  const states = [], refs = [], cache = new Map();
  let slot = 0, refSlot = 0, approved = true;
  const hooks = { ...React,
    useState(initial) { const i = slot++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useRef(initial) { const i = refSlot++; return refs[i] ??= { current: initial }; },
    useLayoutEffect() {},
  };
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} }; cache.set(file, loaded);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    vm.runInNewContext(source, { module: loaded, exports: loaded.exports, structuredClone,
      requestAnimationFrame: fn => { fn(); return 1; }, cancelAnimationFrame() {}, window: { confirm: () => approved },
      require: name => {
        if (name === 'react') return hooks;
        if (name.includes('/components/')) return new Proxy({}, { get: (_, key) => { const stub = () => null; stub.displayName = key; return stub; } });
        return name.startsWith('.') ? load(path.resolve(path.dirname(file), name + '.ts')) : require(name);
      } });
    return loaded.exports;
  }
  const App = load(path.join(__dirname, '../src/App.tsx')).default;
  let nodes;
  function render() {
    slot = refSlot = 0; nodes = [];
    function walk(node) { if (!React.isValidElement(node)) return; nodes.push(node); React.Children.forEach(node.props.children, walk); }
    walk(App()); return nodes;
  }
  function child(name) { return nodes.find(node => node.type.displayName === name)?.props; }
  render();
  return { render, child, approve(value) { approved = value; }, name() { return nodes.find(node => node.props['aria-label'] === 'Experiment name').props.value; } };
}

test('example browsing and preset loading never replace personal configuration', () => {
  const app = appHarness();
  const editor = app.child('Step2ConfigureModel');
  editor.onChangeConfig({ ...editor.config, wells: [{ id: 'my-well', name: 'My site well', x: 10, y: 20 }] }); app.render();
  app.child('Sidebar').onOpenExamples(); app.render();
  app.child('Step1SelectTestCase').onSelectTestCase('black_kipp'); app.render();
  assert.equal(app.child('Step2ConfigureModel').config.wells.length, 5);
  app.child('Sidebar').onOpenProject(); app.render();
  assert.equal(app.child('Step2ConfigureModel').config.wells[0].name, 'My site well');
});

test('Continue cannot bypass incomplete geometry and guide only navigates backward', () => {
  const app = appHarness();
  app.child('Step2ConfigureModel').onNext(); app.render();
  assert.equal(app.child('Step2ConfigureModel').stage, 'positions');
  app.child('JourneyGuide').onBack(5); app.render();
  assert.equal(app.child('Step2ConfigureModel').stage, 'positions');
  app.child('Sidebar').onOpenExamples(); app.render();
  app.child('Step1SelectTestCase').onSelectTestCase('inversion_10s'); app.render();
  app.child('Step2ConfigureModel').onNext(); app.render();
  assert.equal(app.child('Step2ConfigureModel').stage, 'tests');
  app.child('Step2ConfigureModel').onNext(); app.render();
  const testId = app.child('Step3ReviewInputs').config.tests[5].id;
  app.child('Step3ReviewInputs').onEditTest(testId); app.render();
  assert.equal(app.child('Step2ConfigureModel').focusTestId, testId);
  assert.equal(app.child('Step2ConfigureModel').activeTestId, testId);
});

test('run inputs survive review navigation and solving locks session navigation', () => {
  const app = appHarness();
  app.child('Sidebar').onOpenExamples(); app.render();
  app.child('Step1SelectTestCase').onSelectTestCase('inversion_10s'); app.render();
  app.child('Step2ConfigureModel').onNext(); app.render();
  app.child('Step2ConfigureModel').onNext(); app.render();
  app.child('Step3ReviewInputs').onNext(); app.render();
  const input = { analysisMode: 'measured_inversion', csv: 'testId,wellId,real,imag\ntest-1,w-2,.1,-.2', observationSource: 'field' };
  app.child('Step4RunAnalysis').onChangeInput(input); app.render();
  app.child('Step4RunAnalysis').onPrev(); app.render();
  app.child('Step3ReviewInputs').onNext(); app.render();
  assert.equal(app.child('Step4RunAnalysis').input.csv, input.csv);
  app.child('Step4RunAnalysis').onRunningChange(true); app.render();
  app.child('Sidebar').onOpenProject(); app.render();
  assert.ok(app.child('Step4RunAnalysis'));
  assert.equal(app.child('Sidebar').disabled, true);
  app.child('Header').onReset(); app.render();
  assert.ok(app.child('Step4RunAnalysis'));
});

test('canceling reset leaves the project intact; confirmed reset does not load an example', () => {
  const app = appHarness();
  const editor = app.child('Step2ConfigureModel');
  editor.onChangeConfig({ ...editor.config, wells: [{ id: 'mine', name: 'Mine', x: 0, y: 0 }] }); app.render();
  app.approve(false); app.child('Header').onReset(); app.render();
  assert.equal(app.child('Step2ConfigureModel').config.wells.length, 1);
  app.approve(true); app.child('Header').onReset(); app.render();
  assert.equal(app.child('Step2ConfigureModel').config.wells.length, 0);
  assert.equal(app.child('Step2ConfigureModel').stage, 'positions');
});

test('guide minimization survives switching workspaces and reopening restores the full control', () => {
  const app = appHarness();
  app.child('JourneyGuide').onMinimizedChange(true); app.render();
  assert.equal(app.child('JourneyGuide').minimized, true);
  app.child('Sidebar').onOpenExamples(); app.render();
  app.child('Sidebar').onOpenProject(); app.render();
  assert.equal(app.child('JourneyGuide').minimized, true);
  app.child('JourneyGuide').onMinimizedChange(false); app.render();
  assert.equal(app.child('JourneyGuide').minimized, false);
});

test('changing the checkerboard pathway to Black–Kipp cannot submit a hidden synthetic-demo mode', () => {
  const app = appHarness();
  app.child('Sidebar').onOpenExamples(); app.render();
  app.child('Step1SelectTestCase').onSelectTestCase('inversion_10s'); app.render();
  const editor = app.child('Step2ConfigureModel');
  editor.onChangeConfig({ ...editor.config, testCase: 'black_kipp' }); app.render();
  app.child('Step2ConfigureModel').onNext(); app.render();
  app.child('Step2ConfigureModel').onNext(); app.render();
  app.child('Step3ReviewInputs').onNext(); app.render();
  assert.equal(app.child('Step4RunAnalysis').input.analysisMode, 'forward');
});
