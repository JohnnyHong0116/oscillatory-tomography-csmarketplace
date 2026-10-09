const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Compile the real component in memory; no generated test bundle or extra runner.
const source = fs.readFileSync(path.join(__dirname, '../src/components/steps/PlotInspection.tsx'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} });
const loaded = { exports: {} };
vm.runInNewContext(compiled.outputText, { module: loaded, exports: loaded.exports, require });
const { formatPlotNumber, responseDetails, InspectionPanel, InspectablePoint, PlotLegendButton } = loaded.exports;

const pair = {
  testId: 'test-1', testName: 'P = 10 s', pumpingWellName: 'W1', observationWellId: 'w2', observationWellName: 'W2',
  periodSeconds: 10, distanceMeters: 30,
  predicted: { real: -.01, imag: .002, amplitude: .010198039, phaseDegrees: -168.69 },
  measured: null, residualAmplitude: null,
};

test('formatting preserves zero and tiny values, and identifies unavailable data', () => {
  assert.equal(formatPlotNumber(0), '0.000000');
  assert.equal(formatPlotNumber(1e-28), '1.000000e-28');
  for (const value of [undefined, null, NaN, Infinity]) assert.equal(formatPlotNumber(value), 'N/A');
});

test('forward inspection does not invent measured data or residuals', () => {
  const details = responseDetails(pair);
  assert.equal(details.heading, 'P = 10 s: W1 → W2');
  const rows = Object.fromEntries(details.rows);
  assert.equal(rows['Predicted amplitude (m)'], '0.01019804');
  assert.equal(rows['Phase (°)'], '-168.6900');
  assert.ok(!('Measured real (m)' in rows));
  assert.ok(!('Residual amplitude (m)' in rows));
});

test('comparison inspection preserves solver phase convention and analytical errors', () => {
  const rows = Object.fromEntries(responseDetails({ ...pair, numericalPhaseDegrees: 318.649,
    analytical: { amplitude: .0102, phaseDegrees: 320 }, amplitudeRelativeError: .0627, phaseErrorDegrees: 1.351,
    measured: { real: -.011, imag: .001 }, residualAmplitude: .0014142,
  }).rows);
  assert.equal(rows['Phase (°)'], '318.6490');
  assert.equal(rows['Amplitude error (%)'], '6.270000');
  assert.equal(rows['Circular phase error (°)'], '1.351000');
  assert.equal(rows['Measured real (m)'], '-0.01100000');
});

test('inspection controls expose keyboard targets, enlarged hit areas, and selection state', () => {
  const markup = renderToStaticMarkup(React.createElement(InspectablePoint, {
    cx: 10, cy: 20, details: responseDetails(pair), children: React.createElement('circle', { r: 2 }),
  }));
  assert.match(markup, /role="button"/);
  assert.match(markup, /tabindex="0"/);
  assert.match(markup, /r="9" fill="transparent"/);
  const legend = renderToStaticMarkup(React.createElement(PlotLegendButton, { label: 'W2', color: '#fff', visible: false, onToggle() {} }));
  assert.match(legend, /aria-pressed="false"/);
  const panel = renderToStaticMarkup(React.createElement(InspectionPanel, { inspection: {
    details: responseDetails(pair), pinned: true, clear() {},
  } }));
  assert.match(panel, /Pinned/);
  assert.match(panel, /Clear selection/);
  assert.match(panel, /0.01019804/);
});

test('side-panel inspection keeps values and units in a readable single column', () => {
  const panel = renderToStaticMarkup(React.createElement(InspectionPanel, { compact: true, inspection: {
    details: responseDetails(pair), pinned: true, clear() {},
  } }));
  assert.doesNotMatch(panel, /sm:grid-cols-2/);
  assert.match(panel, /Predicted amplitude \(m\)/);
  assert.match(panel, /0.01019804/);
  assert.match(panel, /Clear selection/);
});
