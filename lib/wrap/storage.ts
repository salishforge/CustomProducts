import type { Project } from './types';

// IndexedDB rather than localStorage: projects embed full-res PNGs and exceed the 5 MB quota.
const DB = 'wrap-studio';
const STORE = 'projects';

export type Saved = { id: string; name: string; updated: number; project: Project };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const q = fn(db.transaction(STORE, mode).objectStore(STORE));
    q.onsuccess = () => resolve(q.result as T);
    q.onerror = () => reject(q.error);
  });
}

export const saveProject = (p: Project) =>
  run<IDBValidKey>('readwrite', s => s.put({ id: p.id, name: p.name, updated: Date.now(), project: p }));

export const listProjects = async () =>
  (await run<Saved[]>('readonly', s => s.getAll())).sort((a, b) => b.updated - a.updated);

export const deleteProject = (id: string) => run<undefined>('readwrite', s => s.delete(id));
