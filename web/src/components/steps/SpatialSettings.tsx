import React from 'react';
import { ModelConfig } from '../../types/aquifer';
import { NumericInput } from '../NumericInput';
import { spatialIssues, suggestedSpatialGrid } from '../../utils/spatial';

export function SpatialSettings({
  config: c,
  onChange,
}: {
  config: ModelConfig;
  onChange: (c: ModelConfig) => void;
}) {
  const issues = spatialIssues(c);
  const suggested = suggestedSpatialGrid(c);
  const cellCount = c.gridNx * c.gridNy * (c.gridNz ?? 10);
  return (
    <section className="studio-panel space-y-3" aria-label="Spatial model dimensions">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">Model dimensions</h3>
          <p className="text-xs text-slate-600">
            2D horizontal layer or a 3D volume with point pumping / observation ports.
          </p>
        </div>
        <select
          aria-label="Model dimensions"
          value={c.dimension ?? 2}
          onChange={(e) => {
            const d = Number(e.target.value) as 2 | 3;
            if (
              d === 2 &&
              c.dimension === 3 &&
              !window.confirm(
                `Switch to 2D? Z coordinates will be retained but excluded from the one-layer solve.${c.syntheticRealization==='matlab_reference'?' The fixed 3D MATLAB truth will be replaced by a custom NumPy realization.':''}`,
              )
            )
              return;
            onChange({
              ...c,
              dimension: d,
              ...(d === 3
                ? {
                    testCase: 'inversion_10s',
                    minZ: c.minZ ?? -40,
                    maxZ: c.maxZ ?? 40,
                    gridNz: c.gridNz ?? 10,
                    corrLengthZ: c.corrLengthZ ?? 5,
                    wells: c.wells.map((w) => ({ ...w, z: w.z ?? 0 })),
                  }
                : { syntheticRealization: 'numpy', boundaries: { ...c.boundaries, top: 'no_flow', bottom: 'no_flow' } }),
            });
          }}
          className="rounded-lg border bg-white p-2 focus-ring"
        >
          <option value={2}>2D · horizontal layer</option>
          <option value={3}>3D · spatial volume</option>
        </select>
      </div>
      {c.dimension === 3 && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(
              [
                ['Minimum Z (m)', 'minZ', -40],
                ['Maximum Z (m)', 'maxZ', 40],
                ['Z cells (Nz)', 'gridNz', 10],
                ['Vertical correlation length (m)', 'corrLengthZ', 5],
              ] as const
            ).map(([label, key, fallback]) => (
              <label key={key} className="text-xs font-semibold">
                {label}
                <NumericInput
                  aria-label={label}
                  value={c[key] ?? fallback}
                  onValueChange={(n) => onChange({ ...c, [key]: n })}
                  className="mt-1 w-full rounded-lg border p-2"
                />
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-600">
            Local Cartesian Z is elevation, positive upward. Use a consistent datum. Δz ={' '}
            {(((c.maxZ ?? 40) - (c.minZ ?? -40)) / (c.gridNz ?? 10)).toPrecision(4)} m ·{' '}
            {c.gridNx * c.gridNy * (c.gridNz ?? 10)} total cells. Limits: 8,000 cells forward; 3,600
            inversion. Ports are points, not screened intervals. All six boundaries are editable below;
            constant head means h = 0.
          </p>
          <p className="text-xs text-slate-600">
            3D synthetic fields follow upstream MATLAB: 15 m checker lengths; geostatistical correlation
            lengths 20 / 20 / 4 m. Inversion uses your X / Y / Z prior lengths.
            {c.syntheticRealization==='matlab_reference' ? ' This preset uses the saved MATLAB-generated truth (legacy seed 0), retaining identical field values on its fixed mesh.' : ' Custom fields use NumPy; its seed does not reproduce MATLAB random draws.'}
          </p>
          {c.syntheticRealization==='matlab_reference' && <button type="button" className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold min-h-11 focus-ring" onClick={()=>onChange({...c,syntheticRealization:'numpy'})}>Switch to a custom NumPy realization</button>}
          {issues.length > 0 && (
            <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 space-y-2">
              <p className="font-semibold">Before continuing</p>
              <ul className="list-disc pl-4 space-y-1">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>
            </div>
          )}
          {cellCount > 3600 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-2">
              <p>
                {cellCount > 8000 ? 'This mesh blocks Continue to Tests.' : 'This mesh supports forward prediction; inversion requires at most 3,600 cells.'}
                {' '}You can edit grid counts below or apply this smaller starting mesh. Check cell sizes and port positions afterward; resolution affects the numerical result.
              </p>
              <button type="button" onClick={() => onChange({ ...c, ...suggested })}
                className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold hover:bg-slate-100 focus-ring">
                Use {suggested.gridNx} × {suggested.gridNy} × {suggested.gridNz} grid ({suggested.gridNx * suggested.gridNy * suggested.gridNz} cells)
              </button>
              <p>Applies grid counts only. Your well coordinates and domain extents are preserved.</p>
            </div>
          )}
          <details className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            <summary className="cursor-pointer font-semibold focus-ring">
              Site context (optional, for plots)
            </summary>
            <p className="mt-2 text-slate-600">
              Use the same elevation datum as the port coordinates. These annotations do not change the mesh
              or impose water-table boundary physics. Leave unknown values blank; only planes inside the model
              domain are displayed.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label>
                Vertical datum
                <input
                  aria-label="Vertical datum"
                  value={c.siteContext?.verticalDatum ?? ''}
                  placeholder="e.g. local datum or AMSL"
                  maxLength={80}
                  onChange={(e) =>
                    onChange({ ...c, siteContext: { ...c.siteContext, verticalDatum: e.target.value } })
                  }
                  className="mt-1 block min-h-11 w-full rounded border bg-white p-2"
                />
              </label>
              {(
                [
                  ['Ground surface elevation (m)', 'groundSurfaceZ'],
                  ['Water table elevation (m)', 'waterTableZ'],
                ] as const
              ).map(([label, key]) => (
                <label key={key}>
                  {label}
                  <NumericInput
                    step="any"
                    aria-label={label}
                    value={c.siteContext?.[key] ?? NaN}
                    placeholder="Unknown"
                    onValueChange={(n) =>
                      onChange({
                        ...c,
                        siteContext: {
                          ...c.siteContext,
                          [key]: Number.isFinite(n) ? n : undefined,
                        },
                      })
                    }
                    className="mt-1 block min-h-11 w-full rounded border bg-white p-2"
                  />
                </label>
              ))}
            </div>
          </details>
        </>
      )}
    </section>
  );
}
