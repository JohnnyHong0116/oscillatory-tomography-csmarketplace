const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

// Exercise the actual controlled-input handlers with deterministic hook state.
function harness() {
  const state = [], effects = [], changes = [];
  let slot = 0, effect = 0;
  const hooks = { ...React,
    useState(initial) { const index = slot++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = value; }]; },
    useEffect(fn, dependencies) { const index = effect++; if (!effects[index] || dependencies.some((value, i) => value !== effects[index][i])) { effects[index] = dependencies; fn(); } },
  };
  const loaded = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../src/components/steps/ModelResolution.tsx'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText,
    { module: loaded, exports: loaded.exports, require: name => name === 'react' ? hooks : require(name) });
  const config = { testCase: 'black_kipp', minX: -300, maxX: 300, minY: -300, maxY: 300, gridNx: 300, gridNy: 300,
    boundaries: { west: 'constant_head', east: 'constant_head', south: 'constant_head', north: 'constant_head' } };
  function render() {
    slot = 0; effect = 0;
    const nodes = [];
    function walk(node) { if (!React.isValidElement(node)) return; nodes.push(node); React.Children.forEach(node.props.children, walk); }
    walk(loaded.exports.ModelResolution({ config, onChange: next => changes.push(next) }));
    return { inputs: nodes.filter(node => node.type === 'input'), apply: nodes.find(node => node.type === 'button') };
  }
  return { render, changes, config };
}

test('cell sizes can be cleared and replaced without an injected zero or model mutation', () => {
  const ui = harness();
  let view = ui.render();
  assert.equal(view.inputs[0].props.value, '2');
  for (const index of [0, 1]) {
    view.inputs[index].props.onChange({ target: { value: '' } }); view = ui.render();
    assert.equal(view.inputs[index].props.value, '');
    assert.equal(view.apply.props.disabled, true);
    view.apply.props.onClick(); assert.equal(ui.changes.length, 0);
    view.inputs[index].props.onChange({ target: { value: '10' } }); view = ui.render();
    assert.equal(view.inputs[index].props.value, '10');
  }
  assert.equal(view.apply.props.disabled, false);
  view.apply.props.onClick();
  assert.equal(ui.changes[0].gridNx, 60);
  assert.equal(ui.changes[0].gridNy, 60);
  assert.equal(ui.config.gridNx, 300);
});

test('zero and negative drafts stay editable but cannot be applied', () => {
  const ui = harness();
  for (const value of ['0', '-2', '']) {
    ui.render().inputs[0].props.onChange({ target: { value } });
    const view = ui.render();
    assert.equal(view.inputs[0].props.value, value);
    assert.equal(view.apply.props.disabled, true);
  }
});
