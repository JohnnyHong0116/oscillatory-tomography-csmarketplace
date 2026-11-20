import React, { useEffect, useState } from 'react';
import { Download, Folder, FolderPlus, FlaskConical, Search, Star } from 'lucide-react';
import { ImportExperiment } from './ExperimentExchange';
import type { ExperimentSession } from '../utils/experimentWorkflow';
import { downloadExperiment } from '../utils/experimentArchive';
import {
  listExperimentLibrary, organizeLibraryExperiment, readLibraryExperiment, removeExperimentFolder, removeLibraryExperiment,
  saveExperimentFolder, saveLibraryExperiment, setExperimentFavorite,
} from '../utils/experimentLibrary';
import type { SavedExperiment, ExperimentFolder } from '../utils/experimentLibrary';

const button = 'studio-button studio-button-secondary focus-ring';

export function ExperimentLibrary({ session, activeId, startSaving, onSaved, onOpen }: {
  session: ExperimentSession;
  activeId: string | null;
  startSaving: boolean;
  onSaved: (id: string, name: string) => void;
  onOpen: (id: string, saved: ExperimentSession) => void;
}) {
  const [library, setLibrary] = useState<{ folders: ExperimentFolder[]; entries: SavedExperiment[] }>({
    folders: [], entries: [],
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [scope, setScope] = useState('all');
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [importFolderId, setImportFolderId] = useState<string | null>(null);
  const [folderForm, setFolderForm] = useState<ExperimentFolder | null>(null);
  const [editor, setEditor] = useState<{ id: string; name: string; folderId: string; tags: string; current: boolean } | null>(null);

  useEffect(() => {
    let live = true;
    listExperimentLibrary().then(data => {
      if (live) {
        setLibrary(data);
        if (data.recoveryMessage) setStatus(data.recoveryMessage);
      }
    }).catch(cause => {
      if (live) setError(cause instanceof Error ? cause.message : 'Could not open the saved experiment library.');
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  const beginSave = () => {
    const existing = library.entries.find(entry => entry.id === activeId);
    setEditor({
      id: existing?.id ?? '', name: session.name,
      folderId: existing?.folderId ?? (library.folders.some(folder => folder.id === scope) ? scope : ''),
      tags: existing?.tags.join(', ') ?? '', current: true,
    });
  };

  useEffect(() => {
    if (startSaving && !loading && !error) beginSave();
  }, [startSaving, loading]);

  const act = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await work();
      setLibrary(await listExperimentLibrary());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not access the experiment library.');
    } finally {
      setBusy(false);
    }
  };
  const getSession = async (entry: SavedExperiment) => {
    const saved = await readLibraryExperiment(entry.id);
    if (!saved) throw new Error('This saved experiment is no longer available.');
    return { ...saved, name: entry.name };
  };
  const { folders, entries } = library;
  const tags = [...new Set(entries.flatMap(entry => entry.tags))].sort();
  const visible = entries.filter(entry => (
    (scope === 'all' || (scope === 'favorites' ? entry.favorite : entry.folderId === scope)) &&
    (!tag || entry.tags.includes(tag)) &&
    [entry.name, ...entry.tags].join(' ').toLowerCase().includes(query.trim().toLowerCase())
  )).sort((a, b) => b.updatedAt - a.updatedAt);
  const currentFolder = folders.find(folder => folder.id === scope);

  const importExperiment = async (imported: ExperimentSession) => {
    const folderId = folders.find(folder => folder.id === importFolderId)?.id ?? '';
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await saveLibraryExperiment({
        id: crypto.randomUUID(), name: imported.name, folderId, tags: [], favorite: false,
      }, imported);
      setImportFolderId(null);
      setScope(folderId);
      setTag('');
      setQuery('');
      setStatus(`Imported ${imported.name}.`);
      try {
        setLibrary(await listExperimentLibrary());
      } catch {
        setError('The experiment was saved. Reopen Folders to refresh the list.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <header className="studio-panel workspace-page-heading">
        <div><h2 className="workspace-title">Folders</h2><p className="workspace-description">Save experiments to this computer and organize them by project.</p></div>
        <div className="workspace-actions">
          <button type="button" className={button} disabled={loading || busy}
            aria-expanded={importFolderId !== null}
            onClick={() => setImportFolderId(importFolderId === null ? currentFolder?.id ?? '' : null)}>
            {importFolderId === null ? 'Import experiment' : 'Close import'}
          </button>
          <button className="studio-button studio-button-primary focus-ring" disabled={loading || busy} onClick={beginSave}>Save current experiment</button>
        </div>
      </header>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      {status && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{status}</p>}
      {importFolderId !== null && (
        <ImportExperiment onImport={importExperiment} destination={{
          folders, folderId: importFolderId, onChange: setImportFolderId,
        }} />
      )}
      <div className="library-layout">
        <nav className="studio-panel library-nav" aria-label="Experiment folders">
          <button className={button} disabled={loading || busy} onClick={() => setFolderForm({ id: '', name: '' })}><FolderPlus size={16}/>New folder</button>
          {[{ id: 'all', name: 'All experiments' }, { id: 'favorites', name: 'Favorites' },
            { id: '', name: 'Unfiled' }, ...[...folders].sort((a,b) => a.name.localeCompare(b.name))].map(folder => (
            <button key={folder.id} type="button" aria-current={scope === folder.id ? 'page' : undefined}
              className="library-folder focus-ring" onClick={() => { setScope(folder.id); setTag(''); }}>
              {folder.id === 'favorites' ? <Star size={16}/> : <Folder size={16}/>}<span>{folder.name}</span>
              <small>{entries.filter(entry => folder.id === 'all' || (folder.id === 'favorites' ? entry.favorite : entry.folderId === folder.id)).length}</small>
            </button>
          ))}
        </nav>
        <section className="studio-panel min-w-0 space-y-4" aria-label="Saved experiments">
          <div className="workspace-page-heading">
            <h3 className="workspace-section-title">{currentFolder?.name ?? (scope === 'favorites' ? 'Favorites' : scope === '' ? 'Unfiled' : 'All experiments')}</h3>
            {currentFolder && <div className="workspace-actions">
              <button className={button} disabled={busy} onClick={() => setFolderForm(currentFolder)}>Rename folder</button>
              <button className={button} disabled={busy} onClick={() => {
                if (!window.confirm('Remove this folder? Its experiments will move to Unfiled.')) return;
                void act(async () => { await removeExperimentFolder(currentFolder.id); setScope(''); });
              }}>Remove folder</button>
            </div>}
          </div>
          {folderForm && <form className="library-form" aria-label="Folder details" onSubmit={event => {
            event.preventDefault();
            const name = folderForm.name.trim();
            if (!name || folders.some(folder => folder.id !== folderForm.id && folder.name.toLowerCase() === name.toLowerCase())) {
              setError('Enter a unique folder name.'); return;
            }
            void act(async () => {
              const id = folderForm.id || crypto.randomUUID();
              await saveExperimentFolder({ id, name });
              setScope(id); setTag(''); setQuery(''); setFolderForm(null);
              setEditor(previous => previous?.current ? { ...previous, folderId: id } : previous);
            });
          }}>
            <label>Folder name<input className="studio-input" value={folderForm.name} maxLength={80} required onChange={event => setFolderForm({ ...folderForm, name: event.target.value })}/></label>
            <button className="studio-button studio-button-primary focus-ring" disabled={busy}>Save folder</button>
            <button type="button" className={button} onClick={() => setFolderForm(null)}>Cancel</button>
          </form>}
          {editor && <form className="library-form" aria-label={editor.current ? 'Save current experiment' : 'Organize experiment'} onSubmit={event => {
            event.preventDefault();
            const name = editor.name.trim();
            if (!name) { setError('Enter an experiment name.'); return; }
            void act(async () => {
              const existing = entries.find(entry => entry.id === editor.id);
              const id = existing?.id ?? crypto.randomUUID();
              const changes = {
                name, folderId: editor.folderId,
                tags: [...new Set(editor.tags.split(',').map(value => value.trim()).filter(Boolean))],
              };
              if (editor.current) {
                await saveLibraryExperiment({ ...changes, id, favorite: existing?.favorite ?? false }, session);
                onSaved(id, name);
              } else {
                await organizeLibraryExperiment(editor.id, changes);
                if (editor.id === activeId) onSaved(editor.id, name);
              }
              setEditor(null); setScope(editor.folderId); setTag(''); setQuery('');
              setStatus(`Saved ${name}.`);
            });
          }}>
            <label>Experiment name<input className="studio-input" value={editor.name} required maxLength={160} onChange={event => setEditor({ ...editor, name: event.target.value })}/></label>
            <label>Folder<select className="studio-input" value={editor.folderId} onChange={event => setEditor({ ...editor, folderId: event.target.value })}>
              <option value="">Unfiled</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
            </select></label>
            <label>Tags, separated by commas<input className="studio-input" value={editor.tags} maxLength={250} placeholder="e.g. calibration, field survey" onChange={event => setEditor({ ...editor, tags: event.target.value })}/></label>
            <button className="studio-button studio-button-primary focus-ring" disabled={busy}>{editor.current ? 'Save experiment' : 'Apply changes'}</button>
            <button type="button" className={button} onClick={() => setEditor(null)}>Cancel</button>
          </form>}
          <div className="library-filters">
            <label><Search size={16}/><input className="studio-input" type="search" aria-label="Search experiments" placeholder="Search by name or tag" value={query} onChange={event => setQuery(event.target.value)}/></label>
            {!!tags.length && <select className="studio-input" aria-label="Filter by tag" value={tag} onChange={event => setTag(event.target.value)}><option value="">All tags</option>{tags.map(value => <option key={value}>{value}</option>)}</select>}
          </div>
          {loading ? <p role="status" className="workspace-description">Loading experiments…</p> : error && !entries.length ? (
            <p className="workspace-description">The saved library could not be loaded. Check the message above and reopen Folders.</p>
          ) : visible.length === 0 ? (
            <p className="library-empty">{entries.length ? 'No experiments match this view.' : 'No saved experiments yet. Save your current experiment to get started.'}</p>
          ) : <ul className="library-entries">{visible.map(entry => (
            <li key={entry.id} className="library-entry">
              <FlaskConical size={19} className="shrink-0 text-[#C5050C]"/>
              <div className="min-w-0 flex-1">
                <button className="library-entry-name focus-ring" disabled={busy} onClick={() => void act(async () => onOpen(entry.id, await getSession(entry)))}>{entry.name}</button>
                <p className="workspace-description">{entry.dimension}D · {entry.wellCount} wells · {entry.testCount} tests · {entry.hasResults ? 'Results saved' : 'Setup'} · {new Date(entry.updatedAt).toLocaleDateString()}</p>
                {!!entry.tags.length && <div className="library-tags">{entry.tags.map(value => <button key={value} className="focus-ring" onClick={() => setTag(value)}>{value}</button>)}</div>}
              </div>
              <div className="workspace-actions">
                <button className={button} aria-label={`Favorite ${entry.name}`} aria-pressed={entry.favorite} disabled={busy} onClick={() => void act(() => setExperimentFavorite(entry.id, !entry.favorite))}><Star size={16} fill={entry.favorite ? 'currentColor' : 'none'}/></button>
                <button className={button} disabled={busy} onClick={() => setEditor({ ...entry, tags: entry.tags.join(', '), current: false })}>Organize</button>
                <button className={button} aria-label={`Export ${entry.name}`} disabled={busy} onClick={() => void act(async () => downloadExperiment(await getSession(entry)))}><Download size={16}/></button>
                <button className={button} disabled={busy} onClick={() => {
                  if (!window.confirm(`Delete the saved copy of “${entry.name}”?`)) return;
                  void act(() => removeLibraryExperiment(entry.id));
                }}>Delete</button>
              </div>
            </li>
          ))}</ul>}
        </section>
      </div>
    </div>
  );
}
