const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
function loader(react=React){const cache=new Map();return function load(file){if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{module:m,exports:m.exports,structuredClone,require:n=>{if(n==='react')return react;if(!n.startsWith('.'))return require(n);const base=path.resolve(path.dirname(file),n);return load(['.ts','.tsx'].map(e=>base+e).find(fs.existsSync));}});return m.exports;};}
const root=path.join(__dirname,'../src'),load=loader();
const {HOME_CAMERA,STANDARD_VIEWS,orientPoint,poseToward,zoomAt}=load(path.join(root,'utils/spatialCamera.ts'));
const {spatialCameraProjection}=load(path.join(root,'utils/spatial.ts'));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} versus ${b}`);
test('standard faces and all edge/corner poses look along the selected world normal; Z stays elevation',()=>{
 const normals={Front:[0,-1,0],Back:[0,1,0],Left:[-1,0,0],Right:[1,0,0],Top:[0,0,1],Bottom:[0,0,-1]};
 for(const [name,n] of Object.entries(normals)){const [yaw,pitch]=STANDARD_VIEWS[name],p=orientPoint(...n,yaw,pitch);near(p.x,0);near(p.y,0);near(p.depth,-1);}
 for(const x of [-1,0,1])for(const y of [-1,0,1])for(const z of [-1,0,1]){if(!x&&!y&&!z)continue;const c=poseToward(x,y,z),p=orientPoint(x,y,z,c.yaw,c.pitch,c.roll);near(p.x,0);near(p.y,0);near(p.depth,-Math.hypot(x,y,z));}
 const p=orientPoint(1,2,3,-35,25),q=orientPoint(1,2,3,-35,25,90);near(q.x,-p.y);near(q.y,p.x);near(q.depth,p.depth);
});
test('cursor anchored zoom, clipping limits and camera changes never alter world data',()=>{
 const c={...HOME_CAMERA,panX:20,panY:-10},q=zoomAt(c,2,60,70);near((60-q.panX)/q.zoom,(60-c.panX)/c.zoom);near((70-q.panY)/q.zoom,(70-c.panY)/c.zoom);assert.equal(zoomAt(c,100).zoom,5);assert.equal(zoomAt(c,.001).zoom,.4);
 const config={minX:-40,maxX:40,minY:-40,maxY:40,minZ:-40,maxZ:40},before=JSON.stringify(config);const p=spatialCameraProjection(config,c).project(10,20,30),r=spatialCameraProjection(config,{...c,zoom:2,panX:30,panY:0}).project(10,20,30);near(r.x,220+(p.x-220-c.panX)*2+30);assert.equal(JSON.stringify(config),before);
});
function harness(){let slots=[],cursor=0,effects=[],initialized=false;const fake={...React,useState(init){const i=cursor++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},useRef(init){const i=cursor++;return slots[i]??(slots[i]={current:init});},useEffect(fn){if(!initialized)effects.push(fn);}};
 const fn=loader(fake)(path.join(root,'components/steps/useSpatialCamera.ts')).useSpatialCamera;
 const captures=new Set(),listeners={};const element={clientWidth:600,querySelector(){return {getScreenCTM(){return{a:1,inverse(){return{};}};},createSVGPoint(){return{x:0,y:0,matrixTransform(){return{x:this.x,y:this.y};}};}};},hasPointerCapture:i=>captures.has(i),setPointerCapture:i=>captures.add(i),releasePointerCapture:i=>captures.delete(i),addEventListener:(n,f)=>listeners[n]=f,removeEventListener:n=>delete listeners[n]};
 let c;const render=()=>{cursor=0;c=fn(600,500,260,245);c.ref.current=element;return c;};render();const cleanup=effects.map(f=>f());initialized=true;
 const event=(extra={})=>({pointerId:1,clientX:100,clientY:100,button:0,buttons:1,pointerType:'mouse',target:{closest:()=>null},currentTarget:element,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...extra});
 return{render,event,listeners,cleanup,get c(){return c;}};
}
test('orbit has a click threshold, suppresses drag clicks and preserves ordinary selection clicks',()=>{
 const h=harness();h.c.handlers.onPointerDownCapture(h.event());h.c.handlers.onPointerMoveCapture(h.event({clientX:102}));assert.equal(h.render().dragging,false);h.c.handlers.onPointerUpCapture(h.event());let click=h.event();h.c.handlers.onClickCapture(click);assert.equal(click.stopped,false);
 h.c.handlers.onPointerDownCapture(h.event({button:2,buttons:2}));h.c.handlers.onPointerMoveCapture(h.event({clientX:160,clientY:120,buttons:2}));assert.equal(h.render().dragging,true);near(h.c.camera.yaw,HOME_CAMERA.yaw+27);near(h.c.camera.pitch,HOME_CAMERA.pitch+9);h.c.handlers.onPointerUpCapture(h.event());click=h.event();h.c.handlers.onClickCapture(click);assert.equal(click.stopped,true);assert.equal(h.render().dragging,false);
 h.c.handlers.onPointerDownCapture(h.event());h.c.handlers.onPointerUpCapture(h.event());click=h.event();h.c.handlers.onClickCapture(click);assert.equal(click.stopped,false);
});
test('Ctrl-left/middle/shift/Ctrl-right pan, wheel anchor, fit, keyboard and cancel work without affecting model state',()=>{
 for(const extra of [{button:0,ctrlKey:true},{button:1},{shiftKey:true},{button:2,ctrlKey:true}]){const h=harness();h.c.handlers.onPointerDownCapture(h.event(extra));h.c.handlers.onPointerMoveCapture(h.event({clientX:130,clientY:120}));h.render();near(h.c.camera.panX,30);near(h.c.camera.panY,20);near(h.c.camera.yaw,HOME_CAMERA.yaw);h.c.handlers.onPointerCancelCapture(h.event());assert.equal(h.render().dragging,false);}
 const h=harness();const wheel=h.event({clientX:320,clientY:280,deltaY:-100,deltaMode:0});h.listeners.wheel(wheel);h.render();assert.equal(wheel.prevented,true);assert.ok(h.c.camera.zoom>1);near((60-h.c.camera.panX)/h.c.camera.zoom,60);
 h.c.handlers.onKeyDown(h.event({target:h.c.ref.current,key:'f'}));h.render();near(h.c.camera.zoom,1);near(h.c.camera.panX,0);
 h.c.handlers.onKeyDown(h.event({target:h.c.ref.current,key:'ArrowRight'}));h.render();near(h.c.camera.yaw,HOME_CAMERA.yaw+15);h.c.view('Top');h.render();near(h.c.camera.pitch,90);h.c.home();h.render();near(h.c.camera.pitch,25);
 h.cleanup.forEach(f=>f&&f());assert.equal(Object.keys(h.listeners).length,0);
});
test('two-finger pinch/pan and cancellation recover to a fresh single-pointer gesture',()=>{
 const h=harness();h.c.handlers.onPointerDownCapture(h.event({pointerType:'touch',clientX:100}));h.c.handlers.onPointerDownCapture(h.event({pointerType:'touch',pointerId:2,clientX:200}));h.c.handlers.onPointerMoveCapture(h.event({pointerType:'touch',pointerId:2,clientX:250,buttons:0}));h.render();near(h.c.camera.zoom,1.5);near(h.c.camera.panX,25);
 h.c.handlers.onPointerCancelCapture(h.event({pointerType:'touch'}));h.render();h.c.handlers.onPointerDownCapture(h.event());h.c.handlers.onPointerMoveCapture(h.event({clientX:120}));h.render();near(h.c.camera.zoom,1.5);near(h.c.camera.yaw,HOME_CAMERA.yaw+9);
});
test('3D setup has one directly interactive dark map, cube targets and no camera sliders',()=>{
 const {SpatialWellMap}=load(path.join(root,'components/steps/SpatialWellMap.tsx'));
 const config={dimension:3,minX:-40,maxX:40,minY:-40,maxY:40,minZ:-40,maxZ:40,wells:[{id:'a',name:'W1',x:0,y:0,z:5}]};
 const html=renderToStaticMarkup(React.createElement(SpatialWellMap,{config,label:'Well positions map',selectedWellId:'a',onSelectWell(){},onEditWell(){}}));
 assert.match(html,/Well positions map camera controls/);assert.match(html,/data-theme="dark"/);assert.match(html,/View Top Front Right corner/);assert.match(html,/View Top Front edge/);assert.match(html,/Home isometric view/);assert.match(html,/Select well W1/);assert.match(html,/Edit coordinates/);assert.doesNotMatch(html,/type="range"/);assert.match(html,/Z 5 m/);
});

test('vertical orbit follows the grabbed front surface for mouse/touch and keyboard, with tilt limits',()=>{
 for(const pointerType of ['mouse','touch'])for(const dy of [-30,30]){
  const h=harness();h.c.view('Front');h.render();
  h.c.handlers.onPointerDownCapture(h.event({pointerType}));
  h.c.handlers.onPointerMoveCapture(h.event({pointerType,clientY:100+dy}));h.render();
  near(h.c.camera.pitch,dy*.45);
  // A point on the visible front face must move in the drag's screen direction.
  const p=orientPoint(0,-1,0,h.c.camera.yaw,h.c.camera.pitch);
  assert.equal(Math.sign(p.y),Math.sign(dy));
 }
 for(const [key,expected] of [['ArrowUp',-15],['ArrowDown',15]]){
  const h=harness();h.c.view('Front');h.render();h.c.handlers.onKeyDown(h.event({target:h.c.ref.current,key}));h.render();near(h.c.camera.pitch,expected);
 }
 const h=harness();h.c.handlers.onPointerDownCapture(h.event());h.c.handlers.onPointerMoveCapture(h.event({clientY:1000}));h.render();near(h.c.camera.pitch,90);
});

test('domain shading stays behind wells for every view, including underside and rolled orientations',()=>{
 const {spatialBackdropFaces}=load(path.join(root,'utils/spatialBackdrop.ts'));
 const config={minX:-100,maxX:100,minY:-80,maxY:80,minZ:-40,maxZ:40,wells:[{id:'a',name:'W1',x:0,y:0,z:0}]};
 const before=JSON.stringify(config);
 for(const [yaw,pitch] of [...Object.values(STANDARD_VIEWS),[-35,25],[120,-50]])for(const roll of [0,90]){
  const faces=spatialBackdropFaces(config,{yaw,pitch,roll});assert.ok(faces.length>=1&&faces.length<=3);
  for(const f of faces){assert.ok(f.depth>0);const normal=[0,0,0];normal[f.axis]=f.side?1:-1;assert.ok(orientPoint(...normal,yaw,pitch,roll).depth>0);assert.equal(f.lines.length,6);assert.ok(f.corners.every(p=>p[f.axis]===f.corners[0][f.axis]));}
 }
 const above=spatialBackdropFaces(config,{yaw:-35,pitch:25,roll:0}),below=spatialBackdropFaces(config,{yaw:-35,pitch:-25,roll:0});assert.equal(above.find(f=>f.axis===2).side,0);assert.equal(below.find(f=>f.axis===2).side,1);
 const {SpatialWellMap}=load(path.join(root,'components/steps/SpatialWellMap.tsx'));
 const html=renderToStaticMarkup(React.createElement(SpatialWellMap,{config}));
 assert.ok(html.indexOf('data-domain-backdrop')<html.indexOf('data-well-id="a"'));assert.match(html,/aria-hidden="true" pointer-events="none" data-domain-backdrop/);assert.equal(JSON.stringify(config),before);
});

test('volume slices expose an obvious keyboard-native XYZ disclosure with all three sliders',()=>{
 const {VolumeFieldPlot}=load(path.join(root,'components/steps/VolumeFieldPlot.tsx'));
 const config={gridNx:3,gridNy:3,gridNz:3,minX:-3,maxX:3,minY:-3,maxY:3,minZ:-3,maxZ:3,wells:[]};
 const values=Array.from({length:3},()=>Array.from({length:3},()=>[-10,-9,-8]));
 const html=renderToStaticMarkup(React.createElement(VolumeFieldPlot,{title:'True ln(K)',values,config}));
 assert.match(html,/<details class="spatial-slice-controls"><summary>/);assert.match(html,/Adjust X, Y, Z/);assert.match(html,/slice-disclosure-chevron/);
 for(const axis of ['X','Y','Z'])assert.ok(html.includes(`aria-label="True ln(K) ${axis} slice"`));
 assert.match(html,/Ctrl \/ Shift-drag to pan/);
});
