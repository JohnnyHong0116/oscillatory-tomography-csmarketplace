import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2, Play } from 'lucide-react';
import { AnalysisResult, ModelConfig } from '../../types/aquifer';
import { parseObservations, runAnalysis } from '../../api/analysis';

interface Props {
  config: ModelConfig;
  onResult: (result: AnalysisResult) => void;
  onPrev: () => void;
}

export const Step4RunAnalysis: React.FC<Props> = ({ config, onResult, onPrev }) => {
  const [csv, setCsv] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const pairs = config.tests.flatMap((test) => test.observationWellIds.map((wellId) => ({ test, wellId })));

  useEffect(() => () => controller.current?.abort(), []);

  const run = async () => {
    setError(null);
    try {
      const observations = parseObservations(csv, config);
      controller.current = new AbortController();
      setRunning(true);
      const result = await runAnalysis(config, observations, controller.current.signal);
      onResult(result);
    } catch (cause) {
      if ((cause as Error).name !== 'AbortError') {
        setError(cause instanceof Error ? cause.message : 'Analysis failed');
      }
    } finally {
      setRunning(false);
      controller.current = null;
    }
  };

  return <div className="max-w-5xl mx-auto space-y-5 py-2">
    <div className="bg-white border border-[#D6DADD] rounded-xl p-6">
      <div className="text-xs font-semibold text-[#C5050C] mb-2">Step 4 · Python solver</div>
      <h2 className="text-xl font-bold">Run analysis</h2>
      <p className="text-sm text-[#4B4F52] mt-2">
        Run the periodic groundwater model for {config.tests.length} {config.tests.length === 1 ? 'test' : 'tests'} and {pairs.length} {pairs.length === 1 ? 'pumping/observation pair' : 'pumping/observation pairs'}.
        {' '}Supply measured complex phasors to estimate ln(K) and ln(Ss) with geostatistical inversion.
      </p>
    </div>
    <div className="bg-white border border-[#D6DADD] rounded-xl p-6 space-y-4">
      <div><h3 className="font-bold">Optional measured phasors</h3>
        <p className="text-xs text-[#4B4F52] mt-1">Paste one real and imaginary response for every test/observation pair. Leave empty for forward predictions only. Values are complex head responses in meters.</p>
      </div>
      <textarea aria-label="Measured phasors CSV" className="w-full min-h-36 border border-[#A7ADB1] rounded-md p-3 font-mono text-xs focus-ring"
        placeholder={'testId,wellId,real,imag\ntest-1,w-2,0.001,-0.002'} value={csv} onChange={(event) => setCsv(event.target.value)} disabled={running} />
      <details className="text-xs text-[#4B4F52]"><summary className="cursor-pointer font-semibold">Required pairs for this configuration</summary>
        <div className="mt-2 max-h-48 overflow-y-auto font-mono">{pairs.map(({ test, wellId }) => <div key={`${test.id}-${wellId}`}>{test.id},{wellId},real,imag</div>)}</div>
      </details>
      {error && <p role="alert" className="text-sm text-[#9B0000] bg-[#FEF2F2] p-3 rounded-md">{error}</p>}
      <div className="flex justify-between gap-3">
        <button onClick={onPrev} disabled={running} className="flex items-center gap-2 px-4 py-2 border rounded-md text-sm disabled:opacity-50"><ArrowLeft size={16} /> Back to review</button>
        <button onClick={run} disabled={running} className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#C5050C] text-white font-semibold text-sm disabled:opacity-50">
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}{running ? 'Solving…' : csv.trim() ? 'Run inversion' : 'Run forward model'}{!running && <ArrowRight size={16} />}
        </button>
      </div>
    </div>
  </div>;
};
