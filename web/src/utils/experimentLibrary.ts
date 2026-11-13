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

export function listExperimentLibrary() {
  return transaction<{ folders: ExperimentFolder[]; entries: SavedExperiment[] }>(
    ['folders', 'entries'], 'readonly', (tx, deliver) => {
      const folders = tx.objectStore('folders').getAll();
      const entries = tx.objectStore('entries').getAll();
      entries.onsuccess = () => deliver({ folders: folders.result, entries: entries.result });
    },
  );
}

export function saveExperimentFolder(folder: ExperimentFolder) {
  return transaction<void>(['folders'], 'readwrite', tx => {
    tx.objectStore('folders').put(folder);
  });
}

export function removeExperimentFolder(id: string) {
  return transaction<void>(['folders', 'entries'], 'readwrite', tx => {
    const request = tx.objectStore('entries').openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (cursor.value.folderId === id) cursor.update({ ...cursor.value, folderId: '' });
      cursor.continue();
    };
    tx.objectStore('folders').delete(id);
  });
}

export function saveLibraryExperiment(
  details: Pick<SavedExperiment, 'id' | 'name' | 'folderId' | 'tags' | 'favorite'>,
  session: ExperimentSession,
) {
  const entry: SavedExperiment = {
    ...details,
    updatedAt: Date.now(),
    dimension: session.config.dimension ?? 2,
    wellCount: session.config.wells.length,
    testCount: session.config.tests.length,
    hasResults: session.result !== null,
  };
  return transaction<void>(['entries', 'sessions', 'folders'], 'readwrite', tx => {
    const save = () => {
      tx.objectStore('entries').put(entry);
      tx.objectStore('sessions').put({ ...session, name: entry.name }, entry.id);
    };
    if (entry.folderId) {
      const folder = tx.objectStore('folders').get(entry.folderId);
      folder.onsuccess = () => {
        if (!folder.result) entry.folderId = '';
        save();
      };
    } else save();
  });
}

export function organizeLibraryExperiment(
  id: string,
  changes: Pick<SavedExperiment, 'name' | 'folderId' | 'tags'>,
) {
  return transaction<void>(['entries', 'folders'], 'readwrite', tx => {
    const entries = tx.objectStore('entries');
    const current = entries.get(id);
    const folder = tx.objectStore('folders').get(changes.folderId);
    folder.onsuccess = () => {
      if (!current.result) return;
      entries.put({
        ...current.result,
        ...changes,
        folderId: folder.result ? changes.folderId : '',
        updatedAt: Date.now(),
      });
    };
  });
}

export function readLibraryExperiment(id: string) {
  return transaction<ExperimentSession | undefined>(['sessions'], 'readonly', (tx, deliver) => {
    const request = tx.objectStore('sessions').get(id);
    request.onsuccess = () => deliver(request.result);
  });
}

export function setExperimentFavorite(id: string, favorite: boolean) {
  return transaction<void>(['entries'], 'readwrite', tx => {
    const entries = tx.objectStore('entries');
    const request = entries.get(id);
    request.onsuccess = () => {
      if (request.result) entries.put({ ...request.result, favorite });
    };
  });
}

export function removeLibraryExperiment(id: string) {
  return transaction<void>(['entries', 'sessions'], 'readwrite', tx => {
    tx.objectStore('entries').delete(id);
    tx.objectStore('sessions').delete(id);
  });
}
