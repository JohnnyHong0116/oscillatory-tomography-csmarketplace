import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ModelConfig } from '../../types/aquifer';
import { InspectionPanel, PlotDetails, formatPlotNumber, usePlotInspection } from './PlotInspection';
import { fieldCellAt } from '../../utils/fieldInspection';
import { ExpandablePlot } from './ExpandablePlot';

type Palette = 'viridis' | 'plasma' | 'diverging';

interface Props {
  title: string;
  subtitle?: string;
  values: number[][];
  config: ModelConfig;
  palette?: Palette;
  symmetric?: boolean;
}

const stops: Record<Palette, [number, number, number][]> = {
  viridis: [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]],
  plasma: [[13, 8, 135], [126, 3, 168], [204, 71, 120], [248, 149, 64], [240, 249, 33]],
  diverging: [[49, 54, 149], [116, 173, 209], [247, 247, 247], [244, 109, 67], [165, 0, 38]],
};

function color(value: number, palette: Palette) {
  const normalized = Math.max(0, Math.min(1, value));
  const scaled = normalized * (stops[palette].length - 1);
  const left = Math.min(Math.floor(scaled), stops[palette].length - 2);
  const mix = scaled - left;
  const rgb = stops[palette][left].map((channel, index) => Math.round(channel + mix * (stops[palette][left + 1][index] - channel)));
  return `rgb(${rgb.join(',')})`;
}

/** Canvas rendering keeps the original 50×50 solver grid crisp and lightweight. */
export const FieldHeatmap: React.FC<Props> = ({ title, subtitle, values, config, palette = 'viridis', symmetric = false }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const inspection = usePlotInspection();
  const [cell, setCell] = useState({ column: 0, row: 0 });
  const nx = values[0].length, ny = values.length;
  const cellDetails = (column: number, row: number): PlotDetails => ({
    id: `${column}-${row}`, heading: `${title} · cell (${column + 1}, ${row + 1})`,
    rows: [['X center (m)', formatPlotNumber(config.minX + (column + .5) * (config.maxX - config.minX) / nx)],
      ['Y center (m)', formatPlotNumber(config.minY + (row + .5) * (config.maxY - config.minY) / ny)],
      [title, formatPlotNumber(values[row][column])]],
  });
  const wellDetails = (well: ModelConfig['wells'][number]): PlotDetails => {
    const sample = fieldCellAt(well.x, well.y, nx, ny, config);
    return { id: `well:${well.id}`, heading: `${title} · ${well.name}`, rows: [
      ['Well X (m)', formatPlotNumber(well.x)], ['Well Y (m)', formatPlotNumber(well.y)],
      ['Containing cell (column, row)', `${sample.column + 1}, ${sample.row + 1}`],
      [`${title} (containing cell, not interpolated)`, formatPlotNumber(values[sample.row][sample.column])],
    ] };
  };
  // Use screen-space distance so marker hit targets stay usable at every plot size.
  const detailsAtPointer = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const candidates = config.wells.map(well => ({ well, distance: Math.hypot(
      event.clientX - rect.left - rect.width * (well.x - config.minX) / (config.maxX - config.minX),
      event.clientY - rect.top - rect.height * (config.maxY - well.y) / (config.maxY - config.minY)) }));
    const nearest = candidates.sort((a, b) => a.distance - b.distance)[0];
    if (nearest && nearest.distance <= Math.max(10, rect.width * .017)) return wellDetails(nearest.well);
    const next = cellAtPointer(event);
    return cellDetails(next.column, next.row);
  };
  // Rows are stored south-to-north, while screen coordinates run top-to-bottom.
  const cellAtPointer = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { column: Math.max(0, Math.min(nx - 1, Math.floor((event.clientX - rect.left) / rect.width * nx))),
      row: Math.max(0, Math.min(ny - 1, ny - 1 - Math.floor((event.clientY - rect.top) / rect.height * ny))) };
  };
  const flattened = useMemo(() => values.flat(), [values]);
  let minimum = Math.min(...flattened), maximum = Math.max(...flattened);
  if (symmetric) { const bound = Math.max(Math.abs(minimum), Math.abs(maximum)); minimum = -bound; maximum = bound; }

  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    const image = context.createImageData(values[0].length, values.length);
    values.forEach((row, y) => row.forEach((value, x) => {
      const sample = color((value - minimum) / (maximum - minimum || 1), palette).match(/\d+/g)!.map(Number);
      const offset = 4 * ((values.length - y - 1) * values[0].length + x);
      image.data.set([sample[0], sample[1], sample[2], 255], offset);
    }));
    context.putImageData(image, 0, 0);
  }, [values, minimum, maximum, palette]);

  return <ExpandablePlot title={title} square inspectionPanel={expanded => <InspectionPanel inspection={inspection} compact={expanded} />}><figure className="min-w-0 bg-[#111] p-2 rounded-lg" onKeyDown={event => { if (event.key === 'Escape') inspection.clear(); }}>
    <figcaption className="mb-2"><strong className="block text-xs text-white">{title}</strong>{subtitle && <span className="text-[10px] text-slate-300">{subtitle}</span>}</figcaption>
    <div className="relative aspect-square bg-[#111] border border-[#333] shadow-inner cursor-crosshair focus-ring" tabIndex={0} role="group"
      aria-label={`${title} interactive field. Use arrow keys to inspect cells, Enter to pin, Escape to clear.`}
      onMouseMove={event => { const next = cellAtPointer(event); setCell(next); inspection.hover(detailsAtPointer(event)); }}
      onMouseLeave={() => inspection.hover(null)}
      onClick={event => { const next = cellAtPointer(event); setCell(next); inspection.pin(detailsAtPointer(event)); }}
      onFocus={() => inspection.hover(cellDetails(cell.column, cell.row))}
      onBlur={() => inspection.hover(null)}
      onKeyDown={event => {
        if (event.key === 'Escape') { inspection.clear(); return; }
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inspection.pin(cellDetails(cell.column, cell.row)); return; }
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        const next = { column: Math.max(0, Math.min(nx - 1, cell.column + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0))),
          row: Math.max(0, Math.min(ny - 1, cell.row + (event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0))) };
        setCell(next); inspection.hover(cellDetails(next.column, next.row));
      }}>
      <canvas ref={canvas} width={values[0].length} height={values.length} className="absolute inset-0 h-full w-full [image-rendering:auto]" aria-label={`${title} heatmap`} />
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">{config.wells.map((well) => {
        const x = 100 * (well.x - config.minX) / (config.maxX - config.minX);
        const y = 100 * (config.maxY - well.y) / (config.maxY - config.minY);
        const selected = inspection.details?.id === `well:${well.id}`;
        return <g key={well.id} role="button" tabIndex={0} aria-label={`Inspect ${well.name} on ${title}`}
          aria-pressed={selected && inspection.pinned} className="cursor-pointer outline-none"
          onMouseMove={event => { event.stopPropagation(); inspection.hover(wellDetails(well)); }}
          onClick={event => { event.stopPropagation(); inspection.pin(wellDetails(well)); }}
          onFocus={event => { event.stopPropagation(); inspection.hover(wellDetails(well)); }}
          onBlur={() => inspection.hover(null)}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); inspection.pin(wellDetails(well)); }
          }}>
          {selected && <circle cx={x} cy={y} r="2" fill="none" stroke="#FBBF24" strokeWidth=".55" pointerEvents="none" />}
          <circle cx={x} cy={y} r="1.25" fill="white" stroke="#111" strokeWidth=".45" />
          <text x={x + 1.8} y={y - 1.8} fontSize="2.5" fill="white" stroke="#111" strokeWidth=".45" paintOrder="stroke">{well.name}</text>
          <circle cx={x} cy={y} r="2" fill="transparent" />
        </g>;
      })}</svg>
      {inspection.details && !inspection.details.id.startsWith('well:') && <div className="absolute pointer-events-none border-2 border-amber-400" style={{ left: `${100 * Number(inspection.details.id.split('-')[0]) / nx}%`, top: `${100 * (ny - 1 - Number(inspection.details.id.split('-')[1])) / ny}%`, width: `${100 / nx}%`, height: `${100 / ny}%` }} />}
    </div>
    <div className="h-2 mt-2 rounded-sm" style={{ background: `linear-gradient(to right, ${stops[palette].map((_, index) => color(index / (stops[palette].length - 1), palette)).join(',')})` }} />
    <div className="flex justify-between mt-1 text-[10px] font-mono text-[#5F6368]"><span>{minimum.toFixed(3)}</span><span>{values[0].length} × {values.length}</span><span>{maximum.toFixed(3)}</span></div>
  </figure></ExpandablePlot>;
};
