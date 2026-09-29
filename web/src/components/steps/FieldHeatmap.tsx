import React, { useEffect, useMemo, useRef } from 'react';
import { ModelConfig } from '../../types/aquifer';

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

  return <figure className="min-w-0">
    <figcaption className="mb-2"><strong className="block text-xs">{title}</strong>{subtitle && <span className="text-[10px] text-[#6B7074]">{subtitle}</span>}</figcaption>
    <div className="relative aspect-square bg-[#111] border border-[#333] shadow-inner">
      <canvas ref={canvas} width={values[0].length} height={values.length} className="absolute inset-0 h-full w-full [image-rendering:auto]" aria-label={`${title} heatmap`} />
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">{config.wells.map((well) => {
        const x = 100 * (well.x - config.minX) / (config.maxX - config.minX);
        const y = 100 * (config.maxY - well.y) / (config.maxY - config.minY);
        return <g key={well.id}><circle cx={x} cy={y} r="1.25" fill="white" stroke="#111" strokeWidth=".45" /><text x={x + 1.8} y={y - 1.8} fontSize="2.5" fill="white" stroke="#111" strokeWidth=".45" paintOrder="stroke">{well.name}</text></g>;
      })}</svg>
    </div>
    <div className="h-2 mt-2 rounded-sm" style={{ background: `linear-gradient(to right, ${stops[palette].map((_, index) => color(index / (stops[palette].length - 1), palette)).join(',')})` }} />
    <div className="flex justify-between mt-1 text-[10px] font-mono text-[#5F6368]"><span>{minimum.toFixed(3)}</span><span>{values[0].length} × {values.length}</span><span>{maximum.toFixed(3)}</span></div>
  </figure>;
};
