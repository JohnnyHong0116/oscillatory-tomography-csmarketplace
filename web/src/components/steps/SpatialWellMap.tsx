import React from 'react';
import { ModelConfig, TomographyTest, Well } from '../../types/aquifer';
import { spatialCameraProjection } from '../../utils/spatial';
import { SpatialFrame } from './SpatialFrame';
import { useSpatialCamera } from './useSpatialCamera';
import { SpatialViewport } from './SpatialViewport';

/** Shared setup/review/execution geometry viewer. Drags change only the camera.
 * Screen clicks cannot invent an elevation; coordinates remain explicit inputs. */
export function SpatialWellMap({config,test,label='3D well locations',selectedWellId,onSelectWell,onEditWell,draft}:{
  config:ModelConfig;test?:TomographyTest;label?:string;selectedWellId?:string|null;
  onSelectWell?:(id:string)=>void;onEditWell?:(well:Well)=>void;
  draft?:{x:number;y:number;z:number;name:string};
}) {
  const controller=useSpatialCamera(600,500,260,245);
  const {camera}=controller;
  const {project}=spatialCameraProjection(config,camera,460,420,260,245);
  const selected=config.wells.find(w=>w.id===selectedWellId);
  const ports=[...config.wells].sort((a,b)=>project(b.x,b.y,b.z??0).depth-project(a.x,a.y,a.z??0).depth);
  const validDraft=draft&&[draft.x,draft.y,draft.z].every(Number.isFinite)&&draft.x>=config.minX&&draft.x<=config.maxX&&draft.y>=config.minY&&draft.y<=config.maxY&&draft.z>=(config.minZ??-40)&&draft.z<=(config.maxZ??40);
  return <div className="spatial-well-map">
    <SpatialViewport controller={controller} label={label} dark>
      <svg viewBox="0 0 600 500" data-spatial-scene role="group" aria-label={label} className="w-full rounded-lg bg-[#121212]">
        <SpatialFrame config={config} camera={camera} width={460} height={420} centerX={260} centerY={245}/>
        {ports.map(w=>{
          const p=project(w.x,w.y,w.z??0),pump=w.id===test?.pumpingWellId,observe=test?.observationWellIds.includes(w.id),active=w.id===selectedWellId;
          return <g key={w.id} role={onSelectWell?'button':undefined} tabIndex={onSelectWell?0:undefined} aria-label={onSelectWell?`Select well ${w.name}`:undefined} aria-pressed={onSelectWell?active:undefined} data-well-id={w.id}
            onClick={onSelectWell?()=>onSelectWell(w.id):undefined} onDoubleClick={onEditWell?e=>{e.stopPropagation();onEditWell(w);}:undefined}
            onKeyDown={onSelectWell?e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelectWell(w.id);}}:undefined} className={onSelectWell?'well-camera-port focus-ring':''}>
            <title>{`${w.name}: X ${w.x}, Y ${w.y}, Z ${w.z??0} m${pump?' · Pump':observe?' · Observer':''}`}</title>
            {active&&<circle cx={p.x} cy={p.y} r="12" fill="none" stroke="#f5be55" strokeWidth="2"/>}
            <circle cx={p.x} cy={p.y} r="12" fill="transparent"/>
            {pump?<rect x={p.x-6} y={p.y-6} width="12" height="12" fill="#C5050C" stroke="white" strokeWidth="2"/>:<circle cx={p.x} cy={p.y} r={active?6:5} fill={active?'#C5050C':observe?'#78A3F1':'#DCE5EE'} stroke="white" strokeWidth="1.5"/>}
            {(config.wells.length<=12||active||pump)&&<text x={p.x+10} y={p.y-7} fill="white" stroke="#121212" strokeWidth="3" paintOrder="stroke" fontSize="13">{w.name}</text>}
          </g>;
        })}
        {validDraft&&(()=>{const p=project(draft.x,draft.y,draft.z);return <g pointerEvents="none"><circle cx={p.x} cy={p.y} r="7" fill="#C5050C44" stroke="#ff9da3" strokeDasharray="3 2"/><text x={p.x+10} y={p.y+5} fill="#ffb1b7" fontSize="12">{draft.name} · draft</text></g>;})()}
      </svg>
    </SpatialViewport>
    {selected&&<div className="spatial-well-selection"><strong>{selected.name}</strong><span className="font-mono">X {selected.x} · Y {selected.y} · Z {selected.z??0} m</span>{onEditWell&&<button type="button" onClick={()=>onEditWell(selected)} className="focus-ring">Edit coordinates</button>}</div>}
    <p className="text-xs text-slate-400 mt-3">{config.wells.length} physical ports · Z is elevation (m). {onSelectWell?'Click a port to select; double-click to edit its coordinates.':'Square = pump · blue = observer.'}</p>
  </div>;
}
