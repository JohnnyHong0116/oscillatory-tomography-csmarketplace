import React from 'react';

interface Series { label: string; values: number[]; color: string }
interface Props { title: string; x: number[]; series: Series[]; xLabel: string; yLabel: string; logarithmicX?: boolean; logarithmicY?: boolean }

export const SeriesPlot: React.FC<Props> = ({ title, x, series, xLabel, yLabel, logarithmicX, logarithmicY }) => {
  const transformX = (value: number) => logarithmicX ? Math.log10(Math.max(value, 1e-30)) : value;
  const transformY = (value: number) => logarithmicY ? Math.log10(Math.max(value, 1e-30)) : value;
  const xs = x.map(transformX); const ys = series.flatMap((item) => item.values.map(transformY));
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const px = (value: number) => 48 + 452 * (transformX(value) - minX) / (maxX - minX || 1);
  const py = (value: number) => 18 + 202 * (1 - (transformY(value) - minY) / (maxY - minY || 1));
  const yTick = (transformed: number) => logarithmicY ? Math.pow(10, transformed).toExponential(1) : transformed.toPrecision(3);
  return <figure className="bg-white border border-[#D6DADD] rounded-lg p-3 min-w-0"><figcaption className="font-bold text-xs mb-2">{title}</figcaption>
    <svg viewBox="0 0 530 260" className="w-full" role="img" aria-label={title}><rect x="48" y="18" width="452" height="202" fill="#FAFAFA" />
      {[0, .25, .5, .75, 1].map((tick) => <g key={tick}><line x1="48" x2="500" y1={18 + 202 * tick} y2={18 + 202 * tick} stroke="#E5E7EB" /><text x="43" y={22 + 202 * tick} textAnchor="end" fontSize="9" fill="#666">{yTick(maxY - (maxY - minY) * tick)}</text></g>)}
      {series.map((item) => { const points = item.values.map((value, index) => `${px(x[index])},${py(value)}`).join(' '); return <g key={item.label}><polyline points={points} fill="none" stroke={item.color} strokeWidth="2" />{item.values.map((value, index) => <circle key={index} cx={px(x[index])} cy={py(value)} r="2.4" fill={item.color} />)}</g>; })}
      <line x1="48" y1="220" x2="500" y2="220" stroke="#333" /><line x1="48" y1="18" x2="48" y2="220" stroke="#333" /><text x="274" y="252" textAnchor="middle" fontSize="10">{xLabel}</text><text x="12" y="120" textAnchor="middle" fontSize="10" transform="rotate(-90 12 120)">{yLabel}</text></svg>
    <div className="flex flex-wrap gap-3 justify-center text-[10px]">{series.map((item) => <span key={item.label} className="flex items-center gap-1"><i className="w-3 h-0.5" style={{ background: item.color }} />{item.label}</span>)}</div>
  </figure>;
};
