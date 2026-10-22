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

function executeReset(approved, key = 'project', running = false) {
  const calls = [];
  const previous = { project: { changed: true }, example: { config: { testCase: 'black_kipp' } } };
  const context = { key, running, view: key, createExperiment: () => ({ blank: true }), createExample: type => ({ practice: type }), requestAnimationFrame: fn => fn(), window: {
    confirm(message) { calls.push(['confirm', message]); return approved; },
  } };
  context.setSessions = update => calls.push(['setSessions', update(previous)]);
  for (const name of ['setFocusTestId', 'setNotice', 'resetWorkspaceScroll']) {
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

test('confirming reset creates a blank personal project and preserves practice', () => {
  const calls = executeReset(true);
  assert.equal(calls[0][0], 'confirm');
  assert.equal(calls[1][0], 'setSessions');
  assert.equal(calls[1][1].project.blank, true);
  assert.equal(calls[1][1].example.config.testCase, 'black_kipp');
  assert.equal(calls.filter(call => call[0] === 'resetWorkspaceScroll').length, 2);
});

test('practice reset preserves personal work and reset is blocked while solving', () => {
  const calls = executeReset(true, 'example');
  assert.equal(calls[1][1].project.changed, true);
  assert.equal(calls[1][1].example.practice, 'black_kipp');
  assert.equal(executeReset(true, 'project', true).length, 0);
});
