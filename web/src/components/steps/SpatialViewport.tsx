import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Home, Maximize, Minus, Plus } from 'lucide-react';
import { cameraViewName, orientPoint, poseToward, StandardView, STANDARD_VIEWS } from '../../utils/spatialCamera';
import { SpatialCameraController } from './useSpatialCamera';

/** Lightweight, orthographic orientation cube: faces, 12 edges and 8 corners
 * choose real camera poses. It depicts orientation only, never aquifer data. */
function ViewCube({controller:c}:{controller:SpatialCameraController}) {
  const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!open)return;
    const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false);root.current?.querySelector<HTMLButtonElement>('button[aria-expanded]')?.focus();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape,true);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape,true);};
  },[open]);
  const {yaw,pitch,roll}=c.camera;
  const p=(v:number[])=>{const q=orientPoint(v[0],v[1],v[2],yaw,pitch,roll);return{x:70+q.x*24,y:66+q.y*24,depth:q.depth};};
  const corners=[-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>[x,y,z])));
  const faces=([
    ['Right',[1,0,0],[[1,-1,-1],[1,1,-1],[1,1,1],[1,-1,1]]],
    ['Left',[-1,0,0],[[-1,1,-1],[-1,-1,-1],[-1,-1,1],[-1,1,1]]],
    ['Front',[0,-1,0],[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]]],
    ['Back',[0,1,0],[[1,1,-1],[-1,1,-1],[-1,1,1],[1,1,1]]],
    ['Top',[0,0,1],[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]],
    ['Bottom',[0,0,-1],[[-1,1,-1],[1,1,-1],[1,-1,-1],[-1,-1,-1]]],
  ] as [StandardView,number[],number[][]][]).filter(([,normal])=>orientPoint(...normal as [number,number,number],yaw,pitch,roll).depth<-.001);
  const choose=(v:number[])=>c.setCamera(old=>({...old,...poseToward(v[0],v[1],v[2])}));
  const key=(action:()=>void)=>(e:React.KeyboardEvent<SVGGElement>)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();action();}};
  const describe=(v:number[])=>[v[2]>0?'Top':v[2]<0?'Bottom':'',v[1]<0?'Front':v[1]>0?'Back':'',v[0]>0?'Right':v[0]<0?'Left':''].filter(Boolean).join(' ');
  return <div ref={root} className="spatial-view-cube" data-camera-control>
    <svg viewBox="0 0 140 132" aria-label="View cube · Z up" className="orientation-cube">
      {faces.map(([name,normal,vertices])=>{const center=p(normal);return <g key={name} role="button" tabIndex={0} aria-label={`View ${name}`} onClick={()=>c.view(name)} onKeyDown={key(()=>c.view(name))} className="cube-face">
        <polygon points={vertices.map(v=>{const q=p(v);return `${q.x},${q.y}`;}).join(' ')}/>
        <text x={center.x} y={center.y+4} textAnchor="middle">{name}</text>
      </g>;})}
      {corners.flatMap((a,i)=>corners.filter((b,j)=>j>i&&a.filter((v,k)=>v!==b[k]).length===1).map(b=>({a,b,normal:a.map((v,k)=>(v+b[k])/2)}))).filter(({normal})=>orientPoint(...normal as [number,number,number],yaw,pitch,roll).depth<-.001).map(({a,b,normal},i)=>{const u=p(a),v=p(b);return <g key={i} role="button" tabIndex={0} aria-label={`View ${describe(normal)} edge`} onClick={()=>choose(normal)} onKeyDown={key(()=>choose(normal))} className="cube-edge"><line x1={u.x} y1={u.y} x2={v.x} y2={v.y}/></g>;})}
      {corners.filter(v=>orientPoint(...v as [number,number,number],yaw,pitch,roll).depth<0).map((v,i)=>{const q=p(v);return <g key={i} role="button" tabIndex={0} aria-label={`View ${describe(v)} corner`} onClick={()=>choose(v)} onKeyDown={key(()=>choose(v))} className="cube-corner"><circle cx={q.x} cy={q.y} r="4"/></g>;})}
      {/* Fixed-length triad uses the same camera; letters identify axes without relying on color. */}
      {([[1,0,0,'X','#e16666'],[0,1,0,'Y','#66ba8a'],[0,0,1,'Z','#719deb']] as const).map(([x,y,z,label,color])=>{const q=orientPoint(x,y,z,yaw,pitch,roll);return <g key={label} pointerEvents="none"><line x1="24" y1="111" x2={24+q.x*16} y2={111+q.y*16} stroke={color} strokeWidth="1.8"/><text x={24+q.x*23} y={114+q.y*23} fill={color} fontSize="9">{label}</text></g>;})}
      {([[-1,0,8,66,'Rotate left'],[1,0,132,66,'Rotate right'],[0,1,70,8,'Tilt up'],[0,-1,70,124,'Tilt down']] as const).map(([dx,dy,x,y,label])=><g key={label} role="button" tabIndex={0} aria-label={label} className="cube-arrow" onClick={e=>{const step=e.ctrlKey?5:e.shiftKey?90:15;c.turn(dx*step,-dy*step);}} onKeyDown={key(()=>c.turn(dx*15,-dy*15))}><circle cx={x} cy={y} r="9" fill="transparent"/><path d={`M ${x+(dx===-1?-4:dx===1?4:0)} ${y+(dy===1?-4:dy===-1?4:0)} l ${dx? -dx*5:-4} ${dx?-4:-dy*5} l ${dx?0:8} ${dx?8:0} Z`}/></g>)}
      {([-1,1] as const).map(direction=><g key={direction} role="button" tabIndex={0} aria-label={direction<0?'Roll counterclockwise 90 degrees':'Roll clockwise 90 degrees'} className="cube-arrow" onClick={()=>c.turn(0,0,direction*90)} onKeyDown={key(()=>c.turn(0,0,direction*90))}><circle cx={direction<0?22:118} cy="18" r="11" fill="transparent"/><text x={direction<0?22:118} y="24" textAnchor="middle" fontSize="21">{direction<0?'↶':'↷'}</text></g>)}
    </svg>
    <div className="cube-actions">
      <button type="button" onClick={c.home} aria-label="Home isometric view" title="Home view"><Home size={14}/></button>
      <button type="button" aria-expanded={open} onClick={()=>setOpen(!open)} className="cube-menu-trigger">Views <ChevronDown size={12}/></button>
    </div>
    {open&&<div className="cube-view-menu" aria-label="Standard views">
      <p>Standard views <span>Z up</span></p>
      {(Object.keys(STANDARD_VIEWS) as StandardView[]).map(name=><button type="button" key={name} aria-pressed={cameraViewName(c.camera)===name} onClick={()=>{c.view(name);setOpen(false);}}>{name}<span>{name==='Top'||name==='Bottom'?'XY':name==='Front'||name==='Back'?'XZ':name==='Left'||name==='Right'?'YZ':'3D'}</span></button>)}
      <button type="button" onClick={()=>{c.fit();setOpen(false);}}>Fit to view <span>F</span></button>
    </div>}
  </div>;
}

export function SpatialViewport({controller,label,children,dark=false}:{controller:SpatialCameraController;label:string;children:React.ReactNode;dark?:boolean}) {
  const helpId=useId();
  return <div className="spatial-viewport" data-theme={dark?'dark':'light'}>
    <div ref={controller.ref} {...controller.handlers} className="spatial-scene" tabIndex={0} role="group" aria-label={`${label} camera controls`} aria-describedby={helpId} data-camera-dragging={controller.dragging} data-yaw={controller.camera.yaw.toFixed(3)} data-pitch={controller.camera.pitch.toFixed(3)} data-zoom={controller.camera.zoom.toFixed(3)} style={{cursor:controller.dragging?'grabbing':'grab'}}>
      {children}<ViewCube controller={controller}/>
    </div>
    <div className="spatial-navigation" data-camera-control>
      <span className="spatial-view-name">{cameraViewName(controller.camera)}</span>
      <div className="spatial-nav-actions"><button type="button" onClick={controller.fit} aria-label={`Fit ${label}`} title="Fit to view (F)"><Maximize size={15}/><span>Fit</span></button><button type="button" onClick={()=>controller.zoom(1/1.2)} aria-label={`Zoom out ${label}`}><Minus size={15}/></button><button type="button" onClick={()=>controller.zoom(1.2)} aria-label={`Zoom in ${label}`}><Plus size={15}/></button></div>
    </div>
    <p id={helpId} className="spatial-gesture-hint">Drag to orbit · Ctrl / Shift-drag to pan · Scroll to zoom<span className="sr-only">. Middle-drag also pans. Right-drag also orbits. Two fingers pan and pinch to zoom. Focus the canvas and use arrow keys to orbit, F to fit, Home to reset. Click the cube faces, edges or corners for standard views.</span></p>
  </div>;
}
