import { AnalysisResult, ComplexObservation, ModelConfig } from '../types/aquifer';

// During local development Parcel runs on 1234 and Python on 8000. A built
// frontend served by FastAPI uses the same origin and needs no special URL.
const apiOrigin = window.location.port === '1234'
  ? `${window.location.protocol}//${window.location.hostname}:8000`
  : '';

export async function runAnalysis(
  config: ModelConfig,
  observations: ComplexObservation[] | null,
  signal: AbortSignal,
): Promise<AnalysisResult> {
  const response = await fetch(`${apiOrigin}/api/v1/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      minX: config.minX,
      maxX: config.maxX,
      minY: config.minY,
      maxY: config.maxY,
      gridNx: config.gridNx,
      gridNy: config.gridNy,
      wells: config.wells.map(({ id, name, x, y }) => ({ id, name, x, y })),
      tests: config.tests.map((test) => ({
        id: test.id,
        name: test.name,
        pumpingWellId: test.pumpingWellId,
        observationWellIds: test.observationWellIds,
        pumpingPeriod: test.pumpingPeriod ?? config.pumpingPeriod,
        pumpingRate: test.pumpingRate ?? config.pumpingRate,
      })),
      boundaries: config.boundaries,
      initialLnK: config.initialLnK,
      initialLnSs: config.initialLnSs,
      dataErrorVar: config.dataErrorVar,
      corrLengthX: config.corrLengthX,
      corrLengthY: config.corrLengthY,
      maxIterations: config.maxIterations,
      observations,
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    const detail = payload.detail;
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  return payload as AnalysisResult;
}

/** Parse a pasted CSV table with a header and one row per test/well pair. */
export function parseObservations(csv: string, config: ModelConfig): ComplexObservation[] | null {
  if (!csv.trim()) return null;
  const lines = csv.trim().split(/\r?\n/).map((line) => line.split(',').map((value) => value.trim()));
  if (lines.shift()?.join(',').toLowerCase() !== 'testid,wellid,real,imag') {
    throw new Error('CSV header must be testId,wellId,real,imag');
  }
  const expected = new Set(config.tests.flatMap((test) => test.observationWellIds.map((wellId) => `${test.id}\u0000${wellId}`)));
  const seen = new Set<string>();
  const observations = lines.map((columns, index) => {
    if (columns.length !== 4 || !columns[0] || !columns[1] || !columns[2] || !columns[3]) {
      throw new Error(`CSV row ${index + 2} must have four values`);
    }
    const key = `${columns[0]}\u0000${columns[1]}`;
    if (!expected.has(key) || seen.has(key)) throw new Error(`Unknown or duplicate test/well pair on row ${index + 2}`);
    seen.add(key);
    const real = Number(columns[2]);
    const imag = Number(columns[3]);
    if (!Number.isFinite(real) || !Number.isFinite(imag)) throw new Error(`Invalid phasor on row ${index + 2}`);
    return { testId: columns[0], wellId: columns[1], real, imag };
  });
  if (seen.size !== expected.size) throw new Error(`Measurements missing: expected ${expected.size} test/well rows, received ${seen.size}`);
  return observations;
}
