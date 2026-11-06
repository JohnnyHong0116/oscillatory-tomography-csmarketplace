import { ExperimentSession, testIssues } from './experimentWorkflow';
import { spatialIssues } from './spatial';
import { parseObservations } from '../api/analysis';

export const ARCHIVE_LIMIT = 32 * 1024 * 1024;
const FORMAT = 'aquifer-experiment';
const VERSION = 1;
const manifest = () => ({
  format: FORMAT,
  version: VERSION,
  appVersion: '1.5.2',
  solver: 'oscillatory-tomography-python',
  exportedAt: new Date().toISOString(),
});
type Archive = { format: string; version: number; exportedAt: string; session: ExperimentSession };
const sections = ['name', 'config', 'runInput', 'result', 'forwardSource', 'selectedTestId'] as const;

/** One section per RFC-4180 CSV record. JSON cells retain nested volumes,
 * Unicode labels and IEEE-754 values without lossy spreadsheet flattening. */
export function experimentCsv(session: ExperimentSession) {
  const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [
    ['section', 'value'],
    ['manifest', JSON.stringify(manifest())],
    ...sections.map((k) => [k, JSON.stringify(session[k] ?? null)]),
  ];
  return rows.map((r) => r.map(quote).join(',')).join('\r\n');
}

function csvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = '',
    quoted = false;
  const text = input.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n' || c === '\r')) {
      row.push(field);
      field = '';
      if (c !== ',') {
        if (row.some(Boolean)) rows.push(row);
        row = [];
        if (c === '\r' && text[i + 1] === '\n') i++;
      }
    } else field += c;
  }
  if (quoted) throw new Error('Incomplete quoted CSV record. Use the original experiment export.');
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Validate before committing any imported state. Imported data is never code,
 * and links never cause a network fetch or automatically run the solver. */
export function validateArchive(value: unknown): ExperimentSession {
  const a = value as Archive;
  if (!a || a.format !== FORMAT || a.version !== VERSION)
    throw new Error('Unsupported experiment format or version.');
  const s = a.session;
  if (
    !s ||
    typeof s.name !== 'string' ||
    s.name.length > 300 ||
    !s.config ||
    !Array.isArray(s.config.wells) ||
    !Array.isArray(s.config.tests) ||
    !s.config.boundaries
  )
    throw new Error('Experiment is missing its name, wells, tests or model configuration.');
  const c = s.config;
  if (c.syntheticRealization !== undefined && !['numpy','matlab_reference'].includes(c.syntheticRealization))
    throw new Error('Unknown synthetic realization source.');
  if (c.examplePreset !== undefined && !['matlab_3d','matlab_3d_quick'].includes(c.examplePreset))
    throw new Error('Unrecognized example provenance.');
  if(c.siteContext && (
    typeof c.siteContext!=='object' || Array.isArray(c.siteContext) ||
    (c.siteContext.verticalDatum!==undefined && (typeof c.siteContext.verticalDatum!=='string' || c.siteContext.verticalDatum.length>80)) ||
    ['groundSurfaceZ','waterTableZ'].some(k=>c.siteContext![k as 'groundSurfaceZ'|'waterTableZ']!==undefined && !Number.isFinite(c.siteContext![k as 'groundSurfaceZ'|'waterTableZ']))
  )) throw new Error('Site annotations require a datum label and finite elevations in meters.');
  if (
    !['inversion_10s', 'black_kipp'].includes(c.testCase) ||
    ![2, 3].includes(c.dimension ?? 2) ||
    c.wells.some((w) => !w || typeof w.id !== 'string' || typeof w.name !== 'string') ||
    c.tests.some(
      (t) =>
        !t || typeof t.id !== 'string' || typeof t.name !== 'string' || !Array.isArray(t.observationWellIds),
    ) ||
    ['west', 'east', 'north', 'south', 'top', 'bottom'].some(
      (k) => !['constant_head', 'no_flow'].includes(c.boundaries[k as keyof typeof c.boundaries]),
    )
  )
    throw new Error('Experiment contains invalid geometry, test records or boundary settings.');
  const problems = testIssues(c);
  if (problems.length) throw new Error(problems.join(' '));
  if (
    !s.runInput ||
    !['forward', 'synthetic_demo', 'measured_inversion'].includes(s.runInput.analysisMode) ||
    typeof s.runInput.csv !== 'string' ||
    !['field', 'synthetic'].includes(s.runInput.observationSource)
  )
    throw new Error('Experiment run mode or observation source is invalid.');
  if (s.runInput.analysisMode === 'measured_inversion' && !parseObservations(s.runInput.csv, c))
    throw new Error('Measured inversion is missing observations.');
  if (c.testCase === 'black_kipp' && s.runInput.analysisMode !== 'forward')
    throw new Error('Black–Kipp requires forward mode.');
  // Validate numeric payload recursively: NaN/Infinity cannot be rerun faithfully.
  function finite(v: unknown): void {
    if (typeof v === 'number' && !Number.isFinite(v))
      throw new Error('Experiment contains non-finite numbers.');
    if (Array.isArray(v)) v.forEach(finite);
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) {
        if (['__proto__', 'constructor', 'prototype'].includes(k))
          throw new Error('Unsupported experiment key.');
        finite(x);
      }
  }
  finite(s);
  const spatial = spatialIssues(c, s.runInput.analysisMode !== 'forward');
  if (spatial.length) throw new Error(spatial.join(' '));
  if (s.result) {
    const r = s.result;
    const expected = new Set(c.tests.flatMap((t) => t.observationWellIds.map((id) => `${t.id}\0${id}`)));
    if (
      !Array.isArray(r.pairs) ||
      !Array.isArray(r.objectiveHistory) ||
      !r.grid ||
      r.grid.nx !== c.gridNx ||
      r.grid.ny !== c.gridNy ||
      (c.dimension === 3 && r.grid.nz !== c.gridNz) ||
      r.pairs.length !== expected.size
    )
      throw new Error('Saved results do not match the experiment grid or test count.');
    for (const p of r.pairs) {
      const k = `${p.testId}\0${p.observationWellId}`,
        t = c.tests.find((t) => t.id === p.testId);
      if (
        !expected.delete(k) ||
        !t ||
        p.pumpingWellId !== t.pumpingWellId ||
        p.periodSeconds !== (t.pumpingPeriod ?? c.pumpingPeriod) ||
        p.pumpingRateM3PerSecond !== (t.pumpingRate ?? c.pumpingRate) ||
        !p.predicted ||
        ![p.predicted.real, p.predicted.imag, p.predicted.amplitude, p.predicted.phaseDegrees].every(
          Number.isFinite,
        )
      )
        throw new Error('Saved response identities or numerical values are invalid.');
    }
    for (const group of ['fields', 'trueFields', 'errorFields', 'sensitivityFields'] as const) {
      const f = r[group];
      if (f)
        for (const prop of ['lnK', 'lnSs'] as const)
          if (
            !Array.isArray(f[prop]) ||
            f[prop].length !== c.gridNy ||
            f[prop].some(
              (row) => !Array.isArray(row) || row.length !== c.gridNx || !row.every(Number.isFinite),
            )
          )
            throw new Error('Invalid saved field shape.');
      const v = r.volumeFields?.[group];
      if (v)
        for (const prop of ['lnK', 'lnSs'] as const)
          if (
            !Array.isArray(v[prop]) ||
            v[prop].length !== c.gridNz ||
            v[prop].some(
              (layer) =>
                layer.length !== c.gridNy ||
                layer.some((row) => row.length !== c.gridNx || !row.every(Number.isFinite)),
            )
          )
            throw new Error('Invalid saved volume shape.');
    }
  }
  if (s.forwardSource)
    validateArchive({
      format: FORMAT,
      version: VERSION,
      session: {
        ...s,
        config: s.forwardSource.config,
        result: s.forwardSource.result,
        forwardSource: null,
        runInput: { analysisMode: 'forward', csv: '', observationSource: 'synthetic' },
      },
    });
  return {
    ...structuredClone(s),
    step: 3,
    selectedTestId: c.tests.some((t) => t.id === s.selectedTestId) ? s.selectedTestId : c.tests[0].id,
  };
}

export function parseExperimentCsv(text: string) {
  if (text.length > ARCHIVE_LIMIT) throw new Error('Experiment exceeds the 32 MB import limit.');
  const rows = csvRows(text);
  if (rows.shift()?.join(',') !== 'section,value')
    throw new Error('Choose a whole-experiment CSV, not a response-only CSV.');
  const records = new Map<string, unknown>();
  for (const row of rows) {
    if (row.length !== 2 || records.has(row[0]))
      throw new Error('Invalid or duplicate experiment CSV section.');
    records.set(row[0], JSON.parse(row[1]));
  }
  const manifest = records.get('manifest') as Record<string, unknown>;
  if (!manifest) throw new Error('Experiment manifest is missing.');
  return validateArchive({
    ...manifest,
    session: Object.fromEntries(sections.map((k) => [k, records.get(k)])),
  });
}

export async function experimentLink(session: ExperimentSession, base: string) {
  const bytes = new TextEncoder().encode(JSON.stringify({ ...manifest(), session }));
  const compressed = new Uint8Array(
    await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer(),
  );
  let binary = '';
  for (const b of compressed) binary += String.fromCharCode(b);
  const payload = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  if (payload.length > 60000)
    throw new Error(
      'This experiment is too large for a reliable share link. Export its complete CSV instead.',
    );
  return `${base.split('#')[0]}#experiment=${payload}`;
}

export async function parseExperimentLink(input: string) {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('Paste the complete experiment link.');
  }
  const payload = new URLSearchParams(url.hash.slice(1)).get('experiment');
  if (!payload || payload.length > 60000) throw new Error('Missing or oversized experiment link payload.');
  const binary = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  const stream = new Blob([Uint8Array.from(binary, (c) => c.charCodeAt(0))])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  const reader = stream.getReader(),
    chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > ARCHIVE_LIMIT) throw new Error('Expanded experiment exceeds 32 MB.');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return validateArchive(JSON.parse(await new Blob(chunks as BlobPart[]).text()));
}

export function downloadExperiment(session: ExperimentSession) {
  const url = URL.createObjectURL(new Blob([experimentCsv(session)], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${session.name.replace(/[^a-z0-9_-]/gi, '-').slice(0, 80) || 'experiment'}.experiment.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
