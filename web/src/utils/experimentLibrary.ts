import type { ExperimentSession } from './experimentWorkflow';

export interface ExperimentFolder {
  id: string;
  name: string;
}

export interface SavedExperiment {
  id: string;
  name: string;
  folderId: string;
  tags: string[];
  favorite: boolean;
  updatedAt: number;
  dimension: number;
  wellCount: number;
  testCount: number;
  hasResults: boolean;
}

const databaseName = 'aquifer-imaging-experiments';
type Store = 'folders' | 'entries' | 'sessions';

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('folders', { keyPath: 'id' });
      request.result.createObjectStore('entries', { keyPath: 'id' });
      request.result.createObjectStore('sessions');
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close older experiment tabs to check browser saves.'));
    request.onsuccess = () => resolve(request.result);
  });
}

async function transaction<T>(
  stores: Store[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction, deliver: (result: T) => void) => void,
): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      let result: T;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(tx.error ?? new Error('The storage operation was cancelled.'));
      try {
        work(tx, value => { result = value; });
      } catch (error) {
        tx.abort();
        reject(error);
      }
    });
  } finally {
    db.close();
  }
}

function browserListExperimentLibrary() {
  return transaction<{ folders: ExperimentFolder[]; entries: SavedExperiment[] }>(
    ['folders', 'entries'], 'readonly', (tx, deliver) => {
      const folders = tx.objectStore('folders').getAll();
      const entries = tx.objectStore('entries').getAll();
      entries.onsuccess = () => deliver({ folders: folders.result, entries: entries.result });
    },
  );
}

function browserReadLibraryExperiment(id: string) {
  return transaction<ExperimentSession | undefined>(['sessions'], 'readonly', (tx, deliver) => {
    const request = tx.objectStore('sessions').get(id);
    request.onsuccess = () => deliver(request.result);
  });
}

type LibraryContents = { folders: ExperimentFolder[]; entries: SavedExperiment[]; recoveryMessage?: string };

function endpoint() {
  const location = window.location;
  const origin = location.port === '1234' ? `${location.protocol}//${location.hostname}:8000` : '';
  return `${origin}/api/v1/library`;
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${endpoint()}${path}`, body === undefined ? undefined : {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Could not reach the saved experiment library. Check that the Python server is running.');
  }
  if (response.status === 404 && path === '') {
    throw new Error('Restart the Python server to enable persistent Folders storage.');
  }
  if (!response.ok) {
    throw new Error('Could not read or save the experiment library. Check the Python server and available disk space.');
  }
  return response.json();
}

let migration: Promise<string | undefined> | undefined;

async function migrateBrowserLibrary(): Promise<string | undefined> {
  let legacy: LibraryContents;
  try {
    if (typeof indexedDB === 'undefined') return;
    legacy = await browserListExperimentLibrary();
  } catch {
    return 'Browser storage could not be checked for older saves. Reopen the browser and address used to save them to recover any previous experiments.';
  }
  if (!legacy.folders.length && !legacy.entries.length) return;
  const imported = await request<{ folders: string[]; experiments: string[] }>('/browser-imports');
  const folderIds = new Set(imported.folders);
  const experimentIds = new Set(imported.experiments);
  legacy = {
    folders: legacy.folders.filter(folder => !folderIds.has(folder.id)),
    entries: legacy.entries.filter(entry => !experimentIds.has(entry.id)),
  };
  if (!legacy.folders.length && !legacy.entries.length) return;
  // Read all sessions before saving anything. A partial browser read remains
  // recoverable, and the backend transaction makes repeated migration safe.
  const experiments = await Promise.all(legacy.entries.map(async details => {
    const session = await browserReadLibraryExperiment(details.id);
    if (!session) throw new Error('An older browser save is missing its session. Keep this browser data and import a complete experiment backup.');
    return { details, session };
  }));
  await request('/import-browser', { folders: legacy.folders, experiments });
  return 'Recovered previous browser saves into persistent Folders storage.';
}

export async function listExperimentLibrary(): Promise<LibraryContents> {
  // Check the backend first. An unavailable server must never resemble an empty library.
  await request<LibraryContents>('');
  migration ??= migrateBrowserLibrary().catch(error => {
    migration = undefined;
    throw error;
  });
  const recoveryMessage = await migration;
  return { ...await request<LibraryContents>(''), recoveryMessage };
}

export function saveExperimentFolder(folder: ExperimentFolder) {
  return request<void>('/folders', folder);
}

export function removeExperimentFolder(id: string) {
  return request<void>(`/folders/${encodeURIComponent(id)}/remove`, {});
}

export function saveLibraryExperiment(
  details: Pick<SavedExperiment, 'id' | 'name' | 'folderId' | 'tags' | 'favorite'>,
  session: ExperimentSession,
) {
  return request<void>('/experiments', { details, session });
}

export function organizeLibraryExperiment(
  id: string,
  changes: Pick<SavedExperiment, 'name' | 'folderId' | 'tags'>,
) {
  return request<void>(`/experiments/${encodeURIComponent(id)}/organize`, changes);
}

export function readLibraryExperiment(id: string) {
  return request<ExperimentSession>(`/experiments/${encodeURIComponent(id)}`);
}

export function setExperimentFavorite(id: string, favorite: boolean) {
  return request<void>(`/experiments/${encodeURIComponent(id)}/favorite`, { favorite });
}

export function removeLibraryExperiment(id: string) {
  return request<void>(`/experiments/${encodeURIComponent(id)}/remove`, {});
}
