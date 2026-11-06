import React from 'react';
import { ModelConfig } from '../../types/aquifer';
import { spatialProjection, spatialCameraProjection } from '../../utils/spatial';
import { SpatialBackdrop } from './SpatialBackdrop';
import { SpatialCamera } from '../../utils/spatialCamera';

export function SpatialFrame({ config, yaw=-35, pitch=25, camera, width=440, height=410, centerX=width/2, centerY=height/2 }: { config: ModelConfig; yaw?: number; pitch?: number; camera?:SpatialCamera; width?:number;height?:number;centerX?:number;centerY?:number }) {
  const { corners, project } = camera ? spatialCameraProjection(config,camera,width,height,centerX,centerY) : spatialProjection(config, yaw, pitch,width,height);
  return (
    <g>
      <SpatialBackdrop config={config} camera={camera??{yaw,pitch,roll:0,zoom:1,panX:0,panY:0}} project={project}/>
      {corners.flatMap((p, i) =>
        corners
          .map((q, j) => ({ q, j }))
          .filter(
            ({ q, j }) => j > i && Number(p.x !== q.x) + Number(p.y !== q.y) + Number(p.z !== q.z) === 1,
          )
          .map(({ q, j }) => {
            const a = project(p.x, p.y, p.z),
              b = project(q.x, q.y, q.z);
            return (
              <line key={`${i}-${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#687582" strokeWidth="1" />
            );
          }),
      )}
      {corners
        .filter((_, i) => [0, 1, 2, 4].includes(i))
        .map((p, i) => {
          const a = project(p.x, p.y, p.z);
          return (
            <text key={i} x={a.x} y={a.y + 18} fill="#DDE3EA" fontSize="11" textAnchor="middle">
              {i === 0 ? `(${p.x}, ${p.y}, ${p.z})` : i === 1 ? `Z ${p.z} m` : i === 2 ? `Y ${p.y} m` : `X ${p.x} m`}
            </text>
          );
        })}
    </g>
  );
}
