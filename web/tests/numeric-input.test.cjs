const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

test('numeric inputs retain empty and exponent drafts, propagate invalid values, and synchronize external values', () => {
  let state, effectDeps, value = 10;
  const changes = [];
  const hooks = { ...React,
    useState(initial) { if (state === undefined) state = initial; return [state, next => { state = typeof next === 'function' ? next(state) : next; }]; },
    useEffect(fn, deps) { if (!effectDeps || !Object.is(effectDeps[0], deps[0])) { effectDeps = deps; fn(); } },
  };
  const loaded = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/components/NumericInput.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { module: loaded, exports: loaded.exports, require: name => name === 'react' ? hooks : require(name) });
  const render = () => loaded.exports.NumericInput({ value, onValueChange: next => { value = next; changes.push(next); } });
  render().props.onChange({ target: { value: '' } });
  assert.equal(render().props.value, ''); assert.ok(Number.isNaN(value));
  render().props.onChange({ target: { value: '0.001' } });
  assert.equal(render().props.value, '0.001'); assert.equal(value, 0.001);
  render().props.onChange({ target: { value: '1e-3' } });
  assert.equal(render().props.value, '1e-3'); assert.equal(value, 0.001);
  value = 25; render(); assert.equal(render().props.value, '25');
  assert.equal(changes.length, 3);
});
