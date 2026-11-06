import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { HOME_CAMERA, SpatialCamera, StandardView, STANDARD_VIEWS, wrapAngle, zoomAt } from '../../utils/spatialCamera';

/** One gesture contract for geometry, signals and field slices. Pointer capture
 * keeps an orbit alive outside the canvas; a movement threshold distinguishes
 * clicks from drags so navigation never pins a scientific value by accident. */
export function useSpatialCamera(width=440,height=410,centerX=width/2,centerY=height/2) {
  const [camera,setCamera]=useState<SpatialCamera>({...HOME_CAMERA});
  const [dragging,setDragging]=useState(false);
  const ref=useRef<HTMLDivElement>(null), latest=useRef(camera);
  latest.current=camera;
  const pointers=useRef(new Map<number,{x:number;y:number}>());
  const gesture=useRef<{camera:SpatialCamera;x:number;y:number;distance:number;pan:boolean;scale:number;moved:boolean}|null>(null);
  const suppress=useRef(false);
  const localScale=()=>ref.current?.querySelector<SVGSVGElement>('svg[data-spatial-scene]')?.getScreenCTM()?.a || (ref.current?.clientWidth??width)/width;
  const begin=()=>{
    const p=[...pointers.current.values()];
    if(!p.length){gesture.current=null;return;}
    const old=gesture.current;
    gesture.current={camera:{...latest.current},x:p.reduce((s,v)=>s+v.x,0)/p.length,y:p.reduce((s,v)=>s+v.y,0)/p.length,distance:p.length>1?Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y):0,pan:old?.pan??false,scale:localScale(),moved:old?.moved??false};
  };
  const fit=()=>setCamera(c=>({...c,zoom:1,panX:0,panY:0}));
  const home=()=>setCamera({...HOME_CAMERA});
  const view=(name:StandardView)=>setCamera(c=>({...c,yaw:STANDARD_VIEWS[name][0],pitch:STANDARD_VIEWS[name][1],roll:0}));
  const turn=(yaw=0,pitch=0,roll=0)=>setCamera(c=>({...c,yaw:wrapAngle(c.yaw+yaw),pitch:Math.max(-90,Math.min(90,c.pitch+pitch)),roll:wrapAngle(c.roll+roll)}));
  useEffect(()=>{
    const element=ref.current;
    if(!element)return;
    // React's delegated wheel listener can be passive. A local non-passive
    // listener prevents page scrolling only while the pointer is over this plot.
    const wheel=(e:WheelEvent)=>{
      if((e.target as Element).closest('[data-camera-control]'))return;
      e.preventDefault();
      const svg=element.querySelector<SVGSVGElement>('svg[data-spatial-scene]'),m=svg?.getScreenCTM();
      if(!svg||!m)return;
      const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;
      const local=p.matrixTransform(m.inverse()),delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?height:1);
      setCamera(c=>zoomAt(c,Math.exp(-Math.max(-300,Math.min(300,delta))*.002),local.x-centerX,local.y-centerY));
    };
    element.addEventListener('wheel',wheel,{passive:false});
    return()=>element.removeEventListener('wheel',wheel);
  },[width,height,centerX,centerY]);
  const handlers={
    onPointerDownCapture(e:React.PointerEvent<HTMLDivElement>){
      if((e.target as Element).closest('[data-camera-control]')||e.button>2)return;
      // Prevent native text selection on SVG labels without disabling selection
      // in the numerical inspector or anywhere else in the application.
      e.preventDefault();suppress.current=false;
      pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pointers.current.size===1)gesture.current=null;
      begin();
      if(gesture.current)gesture.current.pan=e.button===1||e.shiftKey||e.ctrlKey;
    },
    onPointerMoveCapture(e:React.PointerEvent<HTMLDivElement>){
      if(!pointers.current.has(e.pointerId)||!gesture.current)return;
      if(e.pointerType!=='touch'&&e.buttons===0){pointers.current.clear();gesture.current=null;setDragging(false);return;}
      pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
      const g=gesture.current,p=[...pointers.current.values()];
      const x=p.reduce((s,v)=>s+v.x,0)/p.length,y=p.reduce((s,v)=>s+v.y,0)/p.length,dx=x-g.x,dy=y-g.y;
      if(!g.moved&&Math.hypot(dx,dy)<4&&p.length===1)return;
      if(!e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.setPointerCapture(e.pointerId);
      g.moved=true;suppress.current=true;setDragging(true);
      if(p.length>1){
        const distance=Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y);
        const zoomed=zoomAt(g.camera,g.distance>0?distance/g.distance:1);
        setCamera({...zoomed,panX:zoomed.panX+dx/g.scale,panY:zoomed.panY+dy/g.scale});
      }else if(g.pan)setCamera({...g.camera,panX:g.camera.panX+dx/g.scale,panY:g.camera.panY+dy/g.scale});
      // Follow the grabbed front surface: dragging down increases pitch.
      else setCamera({...g.camera,yaw:wrapAngle(g.camera.yaw+dx*.45),pitch:Math.max(-90,Math.min(90,g.camera.pitch+dy*.45))});
    },
    onPointerUpCapture(e:React.PointerEvent<HTMLDivElement>){
      pointers.current.delete(e.pointerId);
      if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
      if(pointers.current.size)begin();else{gesture.current=null;setDragging(false);}
    },
    onPointerCancelCapture(e:React.PointerEvent<HTMLDivElement>){pointers.current.clear();gesture.current=null;setDragging(false);suppress.current=true;},
    onLostPointerCapture(){if(!pointers.current.size){gesture.current=null;setDragging(false);}},
    onClickCapture(e:React.MouseEvent<HTMLDivElement>){if(suppress.current&&!(e.target as Element).closest('[data-camera-control]')){e.preventDefault();e.stopPropagation();suppress.current=false;}},
    onContextMenu(e:React.MouseEvent<HTMLDivElement>){if(!(e.target as Element).closest('[data-camera-control]'))e.preventDefault();},
    onDoubleClick(e:React.MouseEvent<HTMLDivElement>){if(!(e.target as Element).closest('[role="button"],[data-camera-control]'))fit();},
    onKeyDown(e:React.KeyboardEvent<HTMLDivElement>){
      if(e.target!==e.currentTarget)return; // data probes retain their arrow-key inspection
      const step=e.ctrlKey?5:e.shiftKey?90:15;
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
        e.preventDefault();const x=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0,y=e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0;
        if(e.ctrlKey&&e.shiftKey)setCamera(c=>({...c,panX:c.panX+x*15,panY:c.panY+y*15}));else turn(x*step,y*step);
      }else if(e.key.toLowerCase()==='f'){e.preventDefault();fit();}
      else if(e.key==='Home'){e.preventDefault();home();}
      else if(e.key.toLowerCase()==='z'||['+','=','-'].includes(e.key)){e.preventDefault();setCamera(c=>zoomAt(c,e.key==='-'||(e.key.toLowerCase()==='z'&&!e.shiftKey)?1/1.2:1.2));}
    },
  };
  return {camera,setCamera,dragging,ref,handlers,fit,home,view,turn,zoom:(factor:number)=>setCamera(c=>zoomAt(c,factor))};
}
export type SpatialCameraController=ReturnType<typeof useSpatialCamera>;
