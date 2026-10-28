const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  ts = require("typescript"),
  React = require("react");
const root = path.join(__dirname, "../src");
function load(file, overrides = {}) {
  const mod = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText,
    {
      module: mod,
      exports: mod.exports,
      document: { querySelector: () => ({ getClientRects: () => [{}] }) },
      requestAnimationFrame: fn => { fn(); return 1; },
      require: (name) =>
        overrides[name] ??
        (name.startsWith(".")
          ? load(path.resolve(path.dirname(file), name + ".ts"), overrides)
          : require(name)),
    },
  );
  return mod.exports;
}
const { pageTours, tourLayout } = load(path.join(root, "utils/walkthrough.ts"));
test('bottom bar opens the simple overview first and detailed tour remains a separate action', () => {
  let states=[],slot=0,nodes=[],back=null;
  const Detailed=()=>null;
  const hooks={...React,useEffect(){},useRef:()=>({current:null}),useState(init){const i=slot++;if(!(i in states))states[i]=typeof init==='function'?init():init;return[states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];}};
  const {JourneyGuide}=load(path.join(root,'components/layout/JourneyGuide.tsx'),{react:hooks,'./PageWalkthrough':{PageWalkthrough:Detailed}});
  const render=()=>{slot=0;nodes=[];const walk=node=>{if(!React.isValidElement(node))return;nodes.push(node);React.Children.forEach(node.props.children,walk);};walk(JourneyGuide({step:2,disabled:false,onBack:n=>back=n,onTop(){}}));};
  const overview=()=>nodes.find(n=>n.props['aria-label']==='Experiment journey');
  render();assert.equal(overview(),undefined);assert.equal(nodes.some(n=>n.type===Detailed),false);
  nodes.find(n=>n.props['aria-controls']==='journey-overview').props.onClick();render();
  assert.ok(overview());assert.equal(nodes.some(n=>n.type===Detailed),false);
  assert.ok(nodes.find(n=>n.props['aria-current']==='step').props.disabled);
  assert.ok(nodes.filter(n=>n.props.title==='Continue from the current screen after validation').every(n=>n.props.disabled));
  nodes.find(n=>n.props['aria-haspopup']==='dialog').props.onClick();render();
  assert.equal(overview(),undefined);nodes.find(n=>n.type===Detailed).props.onClose();render();assert.ok(overview());
  nodes.find(n=>n.props.title==='Wells & model').props.onClick();assert.equal(back,1);
});
test("every scientific workflow stage has a contextual optional tour", () => {
  for (let stage = 1; stage <= 5; stage++) {
    assert.ok(pageTours[stage].length >= 3);
    assert.equal(
      new Set(pageTours[stage].map((s) => s.selector)).size,
      pageTours[stage].length,
    );
    assert.ok(pageTours[stage].every((s) => s.title && s.text && s.selector));
  }
  assert.ok(pageTours[2].some((s) => s.text.includes("Logarithmic")));
  assert.ok(pageTours[5].some((s) => s.text.includes("joint estimate")));
});
test("tour explanations stay in viewport and do not overlap the spotlight at desktop, mobile and short heights", () => {
  for (const [vw, vh] of [
    [1920, 1080],
    [1111, 720],
    [390, 844],
    [844, 390],
    [320, 568],
  ]) {
    for (const rect of [
      { left: 50, top: 60, width: vw - 80, height: 190 },
      { left: 80, top: -100, width: vw, height: 1200 },
      { left: vw - 120, top: vh - 90, width: 90, height: 60 },
    ]) {
      const { box, card } = tourLayout(rect, vw, vh, 380, 300);
      assert.ok(card.left >= 0 && card.left + card.width <= vw);
      assert.ok(card.top >= 0 && card.top + card.maxHeight <= vh + 1e-8);
      assert.ok(box.top >= 0 && box.left >= 0 && box.left + box.width <= vw);
      const overlap =
        box.left < card.left + card.width &&
        box.left + box.width > card.left &&
        box.top < card.top + card.maxHeight &&
        box.top + box.height > card.top;
      assert.equal(overlap, false);
    }
  }
});
test("walkthrough Next, Back, Skip, Done and dismissal execute actual component handlers", () => {
  let states = [],
    slot = 0,
    closed = 0;
  const hooks = {
    ...React,
    useState(init) {
      const i = slot++;
      if (!(i in states))
        states[i] = typeof init === "function" ? init() : init;
      return [
        states[i],
        (value) => {
          states[i] = typeof value === "function" ? value(states[i]) : value;
        },
      ];
    },
    useRef: () => ({ current: null }),
    useEffect() {},
    useId: () => ":tour:",
  };
  const { PageWalkthrough } = load(
    path.join(root, "components/layout/PageWalkthrough.tsx"),
    { react: hooks },
  );
  let nodes = [];
  const render = () => {
    slot = 0;
    nodes = [];
    const walk = (node) => {
      if (!React.isValidElement(node)) return;
      nodes.push(node);
      React.Children.forEach(node.props.children, walk);
    };
    walk(PageWalkthrough({ step: 1, onClose: () => closed++ }));
  };
  const button = (text) =>
    nodes.find(
      (n) =>
        n.type === "button" &&
        React.Children.toArray(n.props.children).some((v) => v === text),
    );
  const heading = () => nodes.find((n) => n.type === "h2").props.children;
  render();
  assert.equal(heading(), "Place your physical wells");
  assert.equal(button("Back").props.disabled, true);
  button("Next").props.onClick();
  render();
  assert.equal(heading(), "Check the well layout");
  button("Back").props.onClick();
  render();
  assert.equal(heading(), "Place your physical wells");
  button("Skip tour").props.onClick();
  assert.equal(closed, 1);
  for (let i = 0; i < 3; i++) {
    button("Next").props.onClick();
    render();
  }
  assert.equal(heading(), "Starting properties and solver controls");
  button("Done").props.onClick();
  assert.equal(closed, 2);
  nodes
    .find((n) => n.props["aria-label"] === "Close walkthrough")
    .props.onClick();
  assert.equal(closed, 3);
  let prevented = false;
  nodes
    .find((n) => n.type === "dialog")
    .props.onCancel({
      preventDefault() {
        prevented = true;
      },
    });
  assert.equal(prevented, true);
  assert.equal(closed, 4);
});
