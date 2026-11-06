import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ModelConfig } from '../../types/aquifer';
import { spatialCameraProjection } from '../../utils/spatial';
import { SpatialFrame } from './SpatialFrame';
import { PlotInspection, formatPlotNumber } from './PlotInspection';
import { PlotProbe } from './PlotProbe';
import { ExpandablePlot } from './ExpandablePlot';
import { useSpatialCamera } from './useSpatialCamera';
import { SpatialViewport } from './SpatialViewport';

/** True orthographic slices through the computed volume, never a 2D field
 * extruded to imply depth. Cell values are not interpolated between layers. */
export function VolumeFieldPlot({
  title,
  values,
  config,
  symmetric = false,
}: {
  title: string;
  values: number[][][];
  config: ModelConfig;
  symmetric?: boolean;
}) {
  const nx = config.gridNx,
    ny = config.gridNy,
    nz = config.gridNz ?? values.length;
  const [ix, setX] = useState(Math.floor(nx / 2)),
    [iy, setY] = useState(Math.floor(ny / 2)),
    [iz, setZ] = useState(Math.floor(nz / 2));
  const controller=useSpatialCamera(600,500,260,245);
  const all = useMemo(() => values.flat(2), [values]);
  const bound = Math.max(...all.map(Math.abs)),
    lo = symmetric ? -bound : Math.min(...all),
    hi = symmetric ? bound : Math.max(...all);
  const minZ = config.minZ ?? -40,
    maxZ = config.maxZ ?? 40,
    dx = (config.maxX - config.minX) / nx,
    dy = (config.maxY - config.minY) / ny,
    dz = (maxZ - minZ) / nz;
  const { project } = spatialCameraProjection(config,controller.camera,460,420,260,245);
  const cells: { x: number; y: number; z: number; axis: number }[] = [];
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) cells.push({ x: ix, y, z, axis: 0 });
  for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) cells.push({ x, y: iy, z, axis: 1 });
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) cells.push({ x, y, z: iz, axis: 2 });
  const polygons = cells
    .map((c) => {
      const x = config.minX + c.x * dx,
        y = config.minY + c.y * dy,
        z = minZ + c.z * dz;
      const center = project(x + dx / 2, y + dy / 2, z + dz / 2);
      const corners =
        c.axis === 0
          ? [
              [x + dx / 2, y, z],
              [x + dx / 2, y + dy, z],
              [x + dx / 2, y + dy, z + dz],
              [x + dx / 2, y, z + dz],
            ]
          : c.axis === 1
            ? [
                [x, y + dy / 2, z],
                [x + dx, y + dy / 2, z],
                [x + dx, y + dy / 2, z + dz],
                [x, y + dy / 2, z + dz],
              ]
            : [
                [x, y, z + dz / 2],
                [x + dx, y, z + dz / 2],
                [x + dx, y + dy, z + dz / 2],
                [x, y + dy, z + dz / 2],
              ];
      const value = values[c.z][c.y][c.x],
        t = (value - lo) / (hi - lo || 1);
      const stops = symmetric
        ? [
            [49, 54, 149],
            [247, 247, 247],
            [165, 0, 38],
          ]
        : [
            [68, 1, 84],
            [33, 145, 140],
            [253, 231, 37],
          ];
      const segment = Math.min(1, Math.floor(t * 2)),
        mix = Math.max(0, Math.min(1, t * 2 - segment));
      const color = `rgb(${stops[segment].map((v, i) => Math.round(v + (stops[segment + 1][i] - v) * mix)).join(',')})`;
      return {
        c,
        center,
        color,
        value,
        points: corners
          .map((p) => {
            const v = project(p[0], p[1], p[2]);
            return `${v.x},${v.y}`;
          })
          .join(' '),
        details: {
          id: `${title}-${c.x}-${c.y}-${c.z}`,
          heading: `${title} · cell (${c.x + 1}, ${c.y + 1}, ${c.z + 1})`,
          rows: [
            ['X center (m)', formatPlotNumber(x + dx / 2)],
            ['Y center (m)', formatPlotNumber(y + dy / 2)],
            ['Z center (m)', formatPlotNumber(z + dz / 2)],
            [title, formatPlotNumber(value)],
          ] as [string, string][],
        },
      };
    })
    .sort((a, b) => b.center.depth - a.center.depth);
  return (
    <section className="rounded-xl bg-[#121212] p-3 text-white space-y-3">
      <h3 className="font-semibold text-sm">{title} · 3D slices</h3>
      <PlotInspection>
        <ExpandablePlot title={`${title} · 3D slices`} showInspection>
          <details className="spatial-slice-controls"><summary><span className="slice-disclosure-label">Slice positions <small>Adjust X, Y, Z</small></span><span className="slice-disclosure-value">X {ix+1} / Y {iy+1} / Z {iz+1}</span><ChevronDown className="slice-disclosure-chevron" size={18} aria-hidden="true"/></summary>      <div className="grid grid-cols-3 gap-2 text-xs">
        {(
          [
            ['X', ix, nx, setX],
            ['Y', iy, ny, setY],
            ['Z', iz, nz, setZ],
          ] as const
        ).map(([label, value, count, setter]) => (
          <label key={label}>
            {label} layer {value + 1}
            <input
              className="block w-full"
              aria-label={`${title} ${label} slice`}
              type="range"
              min={0}
              max={count - 1}
              value={value}
              onChange={(e) => setter(Number(e.target.value))}
            />
          </label>
        ))}
      </div>
</details>
          <SpatialViewport controller={controller} label={`${title} volume`} dark>
          <svg
            viewBox="0 0 600 500"
            data-spatial-scene
            className="w-full rounded-lg bg-[#121212]"
            role="group"
            aria-label={`${title} computed 3D volume slices`}
          >
            <SpatialFrame config={config} camera={controller.camera} width={460} height={420} centerX={260} centerY={245}/>
            {polygons.map((p, i) => (
              <polygon key={i} points={p.points} fill={p.color}>
                <title>
                  {p.details.heading}: {p.value}
                </title>
              </polygon>
            ))}
            {config.wells.map((w) => {
              const p = project(w.x, w.y, w.z ?? 0);
              return (
                <circle key={w.id} cx={p.x} cy={p.y} r="3" fill="white" stroke="black">
                  <title>
                    {w.name}: {w.x}, {w.y}, {w.z} m
                  </title>
                </circle>
              );
            })}
            <PlotProbe
              left={20}
              top={20}
              width={540}
              height={440}
              points={polygons.map((p) => ({ cx: p.center.x, cy: p.center.y, details: p.details }))}
            />
          </svg>
          </SpatialViewport>
          <div className="spatial-field-scale"><div style={{background:symmetric?'linear-gradient(to right,#313695,#f7f7f7,#a50026)':'linear-gradient(to right,#440154,#21918c,#fde725)'}}/><p><span>{formatPlotNumber(lo)}</span><span>{title}</span><span>{formatPlotNumber(hi)}</span></p></div>
        </ExpandablePlot>
      </PlotInspection>
      <p className="text-xs text-slate-300">
        X / Y / Z cell-center slices · equal spatial scale · white points = well ports. Hover or click to
        inspect the nearest projected slice cell.
      </p>
    </section>
  );
}
