import React, { useId } from 'react';
import { ModelConfig } from '../../types/aquifer';
import { SpatialCamera } from '../../utils/spatialCamera';
import { spatialBackdropFaces } from '../../utils/spatialBackdrop';

/** Quiet depth cues, painted before every well/field. Non-interactive and never
 * placed on a near wall, so navigation and scientific inspection remain clear. */
export function SpatialBackdrop({config,camera,project,dark=true}:{
  config:ModelConfig;camera:SpatialCamera;dark?:boolean;
  project:(x:number,y:number,z:number)=>{x:number;y:number};
}) {
  const id=`domain-shade-${useId().replace(/[^a-z0-9]/gi,'')}`;
  const tones=dark?['#718498','#52697D','#8394A4']:['#D9E3EC','#CAD7E3','#E2E9F0'];
  return <g aria-hidden="true" pointerEvents="none" data-domain-backdrop>
    <defs>{tones.map((tone,axis)=><linearGradient key={axis} id={`${id}-${axis}`} x1="0" y1="0" x2={axis===1?'1':'0'} y2="1"><stop offset="0" stopColor={tone} stopOpacity={dark?'.16':'.40'}/><stop offset="1" stopColor={tone} stopOpacity={dark?'.32':'.75'}/></linearGradient>)}</defs>
    {spatialBackdropFaces(config,camera).map(face=><g key={`${face.axis}-${face.side}`} data-domain-face={`${'XYZ'[face.axis]}-${face.side?'max':'min'}`}>
      <polygon points={face.corners.map(p=>{const q=project(...p);return `${q.x},${q.y}`;}).join(' ')} fill={`url(#${id}-${face.axis})`} stroke={dark?'#8D9EAE':'#94A5B5'} strokeOpacity=".22" strokeWidth=".7" vectorEffect="non-scaling-stroke"/>
      {face.lines.map(([a,b],i)=>{const p=project(...a as [number,number,number]),q=project(...b as [number,number,number]);return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={dark?'#A1B2C3':'#899CAF'} strokeOpacity={dark?'.16':'.24'} strokeWidth=".65" vectorEffect="non-scaling-stroke"/>;})}
    </g>)}
  </g>;
}
