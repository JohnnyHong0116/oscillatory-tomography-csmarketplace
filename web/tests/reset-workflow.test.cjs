const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Execute the actual reset handler with state setters recorded, without mounting the app.
const source = fs.readFileSync(path.join(__dirname, '../src/App.tsx'), 'utf8');
const tree = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let body;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'handleResetWorkflow') body = node.initializer.body.getText(tree);
  ts.forEachChild(node, visit);
}
visit(tree);

function executeReset(approved) {
  const calls = [];
  const context = { DEFAULT_INVERSION_CONFIG: { tests: [{ id: 'test-1' }] }, window: {
    confirm(message) { calls.push(['confirm', message]); return approved; },
  } };
  for (const name of ['navigateToStep', 'setConfig', 'setTestCase', 'setConfigureSubTab', 'setConfigureFocusTestId', 'setSelectedTestId', 'setResult']) {
    context[name] = value => calls.push([name, value]);
  }
  vm.runInNewContext(`(() => ${body})()`, context);
  return calls;
}

test('canceling reset preserves all configuration, results, and navigation state', () => {
  const calls = executeReset(false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'confirm');
  assert.match(calls[0][1], /configuration and results/);
});

test('confirming reset restores the default workflow only after approval', () => {
  const calls = executeReset(true);
  assert.equal(calls[0][0], 'confirm');
  assert.deepEqual(calls[1], ['navigateToStep', 1]);
  assert.deepEqual(calls.at(-1), ['setResult', null]);
  assert.equal(calls.length, 8);
});
