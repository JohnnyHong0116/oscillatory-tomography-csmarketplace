const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function loader(overrides = {}) {
  const cache = new Map();
  return function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} };
    cache.set(file, mod);
    const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText;
    vm.runInNewContext(output, {
      module: mod,
      exports: mod.exports,
      structuredClone,
      require: (name) => {
        if (overrides[name]) return overrides[name];
        if (!name.startsWith(".")) return require(name);
        const base = path.resolve(path.dirname(file), name);
        return load(
          [".ts", ".tsx"].map((ext) => base + ext).find(fs.existsSync),
        );
      },
    });
    return mod.exports;
  };
}
const root = path.join(__dirname, "../src");
const load = loader();
const { nearestPlotPoint } = load(path.join(root, "utils/plotProbe.ts"));
const { visibleResponses, responseCsv } = load(
  path.join(root, "utils/responseData.ts"),
);
const { createExample } = load(path.join(root, "utils/experimentWorkflow.ts"));

test("probe chooses visible screen distance, handles invalid coordinates and preserves raw data", () => {
  const points = [
    { cx: 20, cy: 10, details: { raw: 1e-12 } },
    { cx: 21, cy: 90, details: { raw: 10000 } },
    { cx: NaN, cy: 0 },
  ];
  assert.equal(nearestPlotPoint(points, 21, 11), points[0]);
  assert.equal(nearestPlotPoint(points, 20, 85), points[1]);
  assert.equal(nearestPlotPoint(points, NaN, 1), null);
  assert.equal(nearestPlotPoint([], 1, 1), null);
  assert.equal(points[0].details.raw, 1e-12);
});

const pair = (testName, observer, amplitude, period = 10) => ({
  testId: testName,
  testName,
  pumpingWellName: "W1",
  observationWellName: observer,
  periodSeconds: period,
  distanceMeters: amplitude * 100,
  predicted: {
    real: -0.000127574312345678,
    imag: 0.12345678901234567,
    amplitude,
    phaseDegrees: -120.6499,
  },
  measured: { real: 0, imag: -0.0000001 },
});

test("response search keeps numbered test names together; sorting never mutates solver order", () => {
  const pairs = [
    pair("Test 9", "W2", 0.4, 50),
    pair("Test 2", "W9", 0.2),
    pair("Test 9", "W3", 0.1),
  ];
  assert.equal(visibleResponses(pairs, "Test 9 W2", "original").length, 1);
  assert.equal(visibleResponses(pairs, "test 9", "original").length, 2);
  assert.equal(visibleResponses(pairs, "missing", "distance").length, 0);
  assert.equal(visibleResponses(pairs, '"Test 9" W3', "original")[0], pairs[2]);
  assert.equal(visibleResponses(pairs, "", "amplitude-desc")[0], pairs[0]);
  assert.equal(visibleResponses(pairs, "", "amplitude-asc")[0], pairs[2]);
  assert.equal(visibleResponses(pairs, "", "period")[0], pairs[1]);
  assert.deepEqual(
    pairs.map((p) => p.observationWellName),
    ["W2", "W9", "W3"],
  );
});

test("visible-row CSV retains phasor precision, negative numbers and safely quotes user labels", () => {
  const p = pair('=formula,"quoted"', "@W2", 0.12345678901234567);
  const csv = responseCsv([p]);
  assert.ok(csv.includes('"-0.000127574312345678"'));
  assert.ok(
    csv.includes('"0.12345678901234566"') ||
      csv.includes('"0.12345678901234567"'),
  );
  assert.ok(csv.includes('"\'=formula,""quoted"""'));
  assert.ok(csv.includes('"\'@W2"'));
  assert.ok(csv.includes('"0","-1e-7"'));
  assert.equal(responseCsv([]).split("\r\n").length, 1);
});

test("periods are directly selectable pressed-state tiles with an explicit add-test action", () => {
  const { PeriodGroupControls } = load(
    path.join(root, "components/steps/PeriodGroupControls.tsx"),
  );
  const html = renderToStaticMarkup(
    React.createElement(PeriodGroupControls, {
      config: createExample("inversion_10s").config,
      selected: "10",
      onSelect() {},
      onChange() {},
      onAddTest() {},
    }),
  );
  assert.match(
    html,
    /aria-label="Period 10 seconds, 8 tests" aria-pressed="true"/,
  );
  assert.ok(html.includes("Add test at 10 s"));
  assert.ok(!html.includes("<select"));
  assert.ok(html.includes("1 period"));
});

test("full-area probe supports keyboard browsing, pinning, limits and Escape without data edits", () => {
  const details = [0, 1, 2].map((i) => ({
    id: String(i),
    heading: `Point ${i}`,
    rows: [["Raw", String(i)]],
  }));
  const state = {
    details: null,
    pinned: false,
    hover(d) {
      this.details = d;
    },
    pin(d) {
      this.details = d;
      this.pinned = true;
    },
    clear() {
      this.details = null;
      this.pinned = false;
    },
  };
  const probeLoad = loader({
    react: {
      ...React,
      useEffect() {},
      useRef() {
        return { current: null };
      },
    },
    "./PlotInspection": { useInspectionContext: () => state },
  });
  const { PlotProbe } = probeLoad(
    path.join(root, "components/steps/PlotProbe.tsx"),
  );
  const props = {
    points: details.map((d, i) => ({ cx: i * 20, cy: i * 10, details: d })),
    left: 0,
    top: 0,
    width: 100,
    height: 100,
  };
  const rect = () => React.Children.toArray(PlotProbe(props).props.children)[0];
  const key = (value) =>
    rect().props.onKeyDown({ key: value, preventDefault() {} });
  rect().props.onFocus();
  assert.equal(state.details.id, "0");
  key("ArrowRight");
  assert.equal(state.details.id, "1");
  key("Enter");
  assert.equal(state.pinned, true);
  key("End");
  assert.equal(state.details.id, "2");
  key("ArrowRight");
  assert.equal(state.details.id, "2");
  assert.equal(state.pinned, true);
  key("Home");
  assert.equal(state.details.id, "0");
  key("Escape");
  assert.equal(state.details, null);
  assert.equal(PlotProbe({ ...props, points: [] }), null);
});
