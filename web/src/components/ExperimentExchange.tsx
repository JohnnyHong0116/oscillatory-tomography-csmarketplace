import React, { useEffect, useState } from 'react';
import { Download, Upload, Link, Copy } from 'lucide-react';
import { ExperimentSession } from '../utils/experimentWorkflow';
import {
  ARCHIVE_LIMIT,
  downloadExperiment,
  experimentLink,
  parseExperimentCsv,
  parseExperimentLink,
} from '../utils/experimentArchive';

export function ExportExperiment({ session }: { session: ExperimentSession }) {
  const [open, setOpen] = useState(false),
    [link, setLink] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <section className="studio-panel space-y-3" aria-label="Save whole experiment">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">Save & share experiment</h3>
          <p className="text-xs text-slate-600">
            Wells, settings, tests, observations, results and source provenance — ready to import and reuse.
          </p>
        </div>
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="rounded-lg border px-4 py-2 text-sm font-semibold focus-ring"
        >
          Export experiment
        </button>
      </div>
      {open && (
        <div className="space-y-3 border-t pt-3">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => downloadExperiment(session)}
              className="flex items-center gap-2 rounded-lg bg-[#C5050C] px-4 py-2 text-sm font-semibold text-white focus-ring"
            >
              <Download size={16} /> Complete experiment CSV
            </button>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setMessage('');
                try {
                  setLink(await experimentLink(session, window.location.href));
                } catch (e) {
                  setMessage((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
              className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm focus-ring"
            >
              <Link size={16} />
              {busy ? 'Preparing…' : 'Create share link'}
            </button>
          </div>
          <p className="text-xs text-slate-600">
            The CSV contains structured sections, including full precision results. Share links contain the
            same data; anyone with the link can read it. Links open in this app and may require your local
            server to be running.
          </p>
          {link && (
            <label className="block text-xs font-semibold">
              Experiment link
              <div className="mt-1 flex gap-2">
                <input
                  readOnly
                  aria-label="Experiment share link"
                  value={link}
                  className="min-w-0 flex-1 rounded border p-2"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  aria-label="Copy experiment link"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(link);
                      setMessage('Link copied.');
                    } catch {
                      setMessage('Select and copy the link above.');
                    }
                  }}
                  className="rounded border p-2 focus-ring"
                >
                  <Copy size={16} />
                </button>
              </div>
            </label>
          )}
          {message && (
            <p role="status" className="text-sm text-slate-700">
              {message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export function ImportExperiment({ onImport }: { onImport: (s: ExperimentSession) => void }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [input, setInput] = useState(''),
    [pending, setPending] = useState<ExperimentSession | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function load(task: () => Promise<ExperimentSession>) {
    setBusy(true);
    setError('');
    setPending(null);
    try {
      setPending(await task());
    } catch (e) {
      setError((e as Error).message || 'Could not read experiment.');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (new URLSearchParams(window.location.hash.slice(1)).has('experiment')) {
      setLinkOpen(true);
      setInput(window.location.href);
      void load(() => parseExperimentLink(window.location.href));
    }
  }, []);
  return (
    <section className="experiment-import" aria-label="Import experiment">
      <div className="experiment-import-heading">
        <div><h3><Upload size={17} /> Open saved experiment</h3><p>Restore wells, settings and observations. Review before running.</p></div>
        <div className="experiment-import-actions">
          <label className="experiment-file-button"><Upload size={15}/> Choose CSV
          <input
            aria-label="Import experiment CSV"
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            className="experiment-file-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f)
                void load(async () => {
                  if (f.size > ARCHIVE_LIMIT) throw new Error('Maximum experiment file size is 32 MB.');
                  return parseExperimentCsv(await f.text());
                });
              e.target.value = '';
            }}
          />
          </label>
          <button type="button" aria-expanded={linkOpen} aria-controls="experiment-link-input" onClick={()=>setLinkOpen(!linkOpen)} className="experiment-link-toggle"><Link size={15}/> Paste link</button>
        </div>
      </div>
      {linkOpen && <div id="experiment-link-input" className="experiment-link-row">
        <label>Experiment share link<input aria-label="Paste experiment link" value={input} onChange={e=>setInput(e.target.value)} placeholder="https://…/#experiment=…" /></label>
        <button type="button" disabled={busy || !input.trim()} onClick={()=>void load(()=>parseExperimentLink(input))}>{busy?'Reading…':'Read link'}</button>
      </div>}
      {error && (
        <p role="alert" className="text-sm text-[#9B0000]">
          {error}
        </p>
      )}
      {pending && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
          <strong>{pending.name}</strong>
          <p className="text-xs">
            {pending.config.dimension ?? 2}D · {pending.config.wells.length} wells ·{' '}
            {pending.config.tests.length} tests ·{' '}
            {pending.result ? 'saved results included' : 'configuration and observations'}.
          </p>
          <button
            onClick={() => onImport(pending)}
            className="rounded-lg bg-[#C5050C] px-4 py-2 text-sm font-semibold text-white focus-ring"
          >
            Import & review inputs →
          </button>
          <p className="text-xs text-slate-600">
            Replaces Your experiment after confirmation. Examples remain separate.
          </p>
        </div>
      )}
    </section>
  );
}
