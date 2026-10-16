import React, { useEffect, useState } from 'react';
import { BoundaryCondition, ModelConfig } from '../../types/aquifer';

/** Physical cell-size input translates to the existing uniform-grid cell counts. */
export function ModelResolution({ config, onChange }: { config: ModelConfig; onChange: (config: ModelConfig) => void }) {
  const width = config.maxX - config.minX, height = config.maxY - config.minY;
  // Keep raw text while editing: Number('') is 0 and would immediately refill
  // a cleared controlled input, preventing ordinary backspace-and-replace edits.
  const [dxDraft, setDxDraft] = useState(String(width / config.gridNx));
  const [dyDraft, setDyDraft] = useState(String(height / config.gridNy));
  useEffect(() => { setDxDraft(String(width / config.gridNx)); setDyDraft(String(height / config.gridNy)); }, [width, height, config.gridNx, config.gridNy]);
  const dx = dxDraft.trim() === '' ? NaN : Number(dxDraft);
  const dy = dyDraft.trim() === '' ? NaN : Number(dyDraft);
  const maximum = config.testCase === 'black_kipp' ? 300 : 60;
  const nx = Math.ceil(width / dx), ny = Math.ceil(height / dy);
  const valid = [width, height, dx, dy].every(value => Number.isFinite(value) && value > 0) && nx >= 3 && ny >= 3 && nx <= maximum && ny <= maximum;
  return <section className="rounded-xl border border-slate-300 bg-white p-4 space-y-4 text-xs" aria-label="Cell size and boundary conditions">
    <div><h3 className="font-bold text-sm">Level of discretization · cell size</h3><p className="mt-1 text-slate-600">The domain is divided into uniform cells. Smaller cells describe more spatial detail but cost more computation; finer does not automatically mean more accurate. Compare resolutions and domain sizes to check numerical effects.</p></div>
    <div className="grid sm:grid-cols-2 gap-3">
      <label>Target cell width Δx (m)<input type="number" min="0" step="any" value={dxDraft} onChange={event => setDxDraft(event.target.value)} className="mt-1 w-full border rounded p-2 focus-ring" /></label>
      <label>Target cell height Δy (m)<input type="number" min="0" step="any" value={dyDraft} onChange={event => setDyDraft(event.target.value)} className="mt-1 w-full border rounded p-2 focus-ring" /></label>
    </div>
    <p className={valid ? 'text-slate-600' : 'text-red-800'}>{valid ? `Will use ${nx} × ${ny} cells; actual Δx = ${(width / nx).toPrecision(5)} m, Δy = ${(height / ny).toPrecision(5)} m. Counts round up to fit the domain.` : `Choose sizes giving 3–${maximum} cells per axis within a valid domain.`}</p>
    <button type="button" disabled={!valid} onClick={() => { if (valid) onChange({ ...config, gridNx: nx, gridNy: ny }); }} className="border rounded px-3 py-2 font-semibold disabled:opacity-40 focus-ring">Apply cell size</button>
    <div className="border-t pt-4 space-y-2"><h3 className="font-bold text-sm">Domain boundary conditions</h3>
      <p className="text-slate-600">Constant head holds the oscillatory head perturbation at zero at that edge (not zero aquifer elevation). No flow blocks flux across the edge. These are modeling assumptions: choose them from site knowledge and test their effect.</p>
      <div className="grid sm:grid-cols-2 gap-3">{(['west', 'east', 'south', 'north'] as const).map(side => <label key={side} className="capitalize">{side} edge<select value={config.boundaries[side]} onChange={event => onChange({ ...config, boundaries: { ...config.boundaries, [side]: event.target.value as BoundaryCondition } })} className="mt-1 w-full border rounded p-2 bg-white focus-ring"><option value="constant_head">Constant head perturbation (h′ = 0)</option><option value="no_flow">No flow (normal flux = 0)</option></select></label>)}</div>
      <p className="text-slate-600">Top and bottom: no flow (fixed by the one-layer, unit-thickness 2-D model). This implementation requires at least one horizontal constant-head edge.</p>
      {config.testCase === 'black_kipp' && <p className="rounded bg-amber-50 p-2 text-amber-900">Black–Kipp assumes a homogeneous, laterally infinite aquifer; this numerical model has finite edges. Longer periods can be more affected by those edges. Changing geometry or boundaries creates a customized comparison, not exact baseline parity.</p>}
    </div>
  </section>;
}
