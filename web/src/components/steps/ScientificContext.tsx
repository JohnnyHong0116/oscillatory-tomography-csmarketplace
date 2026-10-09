import React from 'react';
import { AnalysisResult, ModelConfig } from '../../types/aquifer';
import { matchesBaselineConfiguration, scientificDesignSummary } from '../../utils/scientificReview';

export function ScientificSetupSummary({ config }: { config: ModelConfig }) {
  const summary = scientificDesignSummary(config);
  const baseline = matchesBaselineConfiguration(config);
  return <aside className="rounded-xl border border-slate-300 bg-slate-50 p-4 text-xs text-slate-800 space-y-2" aria-label="Scientific setup summary">
    <h3 className="font-bold text-sm">Scientific setup check</h3>
    <p><strong>{baseline ? 'Original baseline inputs' : 'Customized experiment'}</strong> · {baseline ? 'Numerical settings match the supplied preset; result parity still requires numerical comparison.' : 'One or more numerical settings differ from the supplied preset. This is a custom run, not an exact baseline reproduction.'}</p>
    <dl className="grid sm:grid-cols-3 gap-2"><div><dt>Period sampling</dt><dd className="font-semibold">{summary.periods} distinct period{summary.periods === 1 ? '' : 's'}</dd></div><div><dt>Data components</dt><dd className="font-semibold">{summary.pairs} pairs · {summary.realComponents} real/imaginary components</dd></div><div><dt>Cell resolution</dt><dd className="font-semibold">{summary.dx.toPrecision(4)} × {summary.dy.toPrecision(4)} m</dd></div></dl>
    {config.testCase !== 'black_kipp' && <p>Joint inversion estimates {summary.unknowns.toLocaleString()} ln(K)/ln(Ss) cell parameters. Data coverage and the covariance priors both influence the reconstruction; response count alone does not establish identifiability.</p>}
    {summary.coincidentPair && <p className="text-amber-900">A pump and an observer share coordinates. Verify that these represent the intended physical geometry before running.</p>}
    {summary.subcellSpacing && <p className="text-amber-900">The shortest pump–observer spacing is smaller than a grid-cell width. Review discretization and geometry; this advisory does not change the mesh.</p>}
    <p>Initial homogeneous properties: K = {Math.exp(config.initialLnK).toExponential(3)} m/s; Ss = {Math.exp(config.initialLnSs).toExponential(3)} 1/m. These are initial model inputs, not recovered field averages.</p>
    <p className="text-slate-600">Model scope: one horizontal layer with unit thickness; no-flow top/bottom. Coordinates are local Cartesian x/y in meters, not latitude/longitude. Phasor heads use meters; pumping rate uses m³/s.</p>
  </aside>;
}

export function ScientificResultGuidance({ config, result }: { config: ModelConfig; result: AnalysisResult }) {
  const comparison = config.testCase === 'black_kipp';
  return <aside aria-label="Scientific interpretation guidance" className="rounded-xl border border-slate-300 bg-slate-50 p-4 text-xs text-slate-800 space-y-2">
    <h3 className="font-bold text-sm">How to interpret this run</h3>
    <p><strong>{comparison ? 'Analytical benchmark' : result.analysisMode === 'synthetic_demo' ? 'Synthetic experiment — not field measurements' : result.analysisMode === 'measured_inversion' ? 'Measured-data joint inversion' : 'Forward prediction — no calibration'}</strong> · {matchesBaselineConfiguration(config) ? 'Baseline inputs retained.' : 'Customized numerical inputs.'}</p>
    {comparison ? <><p>The numerical solution uses your finite domain and grid; the analytical reference has different domain assumptions. Agreement is a benchmark check, not a field validation.</p><p>Phase delays retain the baseline wrapping convention. Jumps across the phase boundary and spikes in derived effective T/S/D can be ambiguous; do not interpret those spikes alone as aquifer heterogeneity.</p></>
      : <><p>{result.analysisMode === 'synthetic_demo' ? 'Field RMSE compares the estimate with known synthetic truth. It is a reconstruction diagnostic, not an uncertainty interval.' : result.analysisMode === 'measured_inversion' ? 'There is no known field truth for this run. Assess the measured-versus-predicted fit and the modeling assumptions together.' : 'No observations were used to fit this model. Missing fit metrics are expected, not zero error.'}</p><p>Sensitivity coverage is the final Jacobian column norm, not posterior variance or a confidence map. A low response residual does not by itself establish a unique hydraulic-conductivity/storage field.</p>{result.mode === 'inversion' && result.iterations >= config.maxIterations && <p className="text-amber-900">The run reached its iteration budget ({config.maxIterations}). Review the objective history before treating it as converged; an iteration count alone is not a convergence certificate.</p>}</>}
    <p className="text-slate-600">Field labels use natural logarithms (ln), not log10. Individual test scope filters response diagnostics; it does not recompute a separate inversion.</p>
  </aside>;
}
