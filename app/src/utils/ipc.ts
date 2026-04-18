import type { AnswerEvent } from '../types/answerEvent';
import type { UserProfile } from '../types/userProfile';

export interface DbStatus {
  open: boolean;
  path: string | null;
}

interface TauriShim {
  invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T>;
}

function tauriInvoker(): TauriShim | null {
  // Vite will tree-shake the import when not available via dynamic import lookup.
  const w = globalThis as unknown as {
    __TAURI_INTERNALS__?: { invoke: TauriShim['invoke'] };
  };
  if (w.__TAURI_INTERNALS__?.invoke) {
    return { invoke: w.__TAURI_INTERNALS__.invoke.bind(w.__TAURI_INTERNALS__) };
  }
  return null;
}

export function isTauri(): boolean {
  return tauriInvoker() !== null;
}

interface LocalStore {
  db: { open: boolean; path: string | null; users: UserProfile[]; events: AnswerEvent[] };
  prefs: { db_path: string | null; last_username: string | null };
}

const LS_KEY = 'flashcards_browser_store_v1';

function loadLocal(): LocalStore {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {
    db: { open: false, path: null, users: [], events: [] },
    prefs: { db_path: null, last_username: null },
  };
}

function saveLocal(s: LocalStore) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export async function openDb(path: string): Promise<DbStatus> {
  const t = tauriInvoker();
  if (t) return t.invoke<DbStatus>('open_db', { path });
  const s = loadLocal();
  s.db.open = true;
  s.db.path = path;
  saveLocal(s);
  return { open: true, path };
}

export async function dbStatus(): Promise<DbStatus> {
  const t = tauriInvoker();
  if (t) return t.invoke<DbStatus>('db_status');
  const s = loadLocal();
  return { open: s.db.open, path: s.db.path };
}

export async function logAnswerEvent(event: AnswerEvent): Promise<void> {
  const t = tauriInvoker();
  if (t) {
    await t.invoke('log_answer_event', { event });
    return;
  }
  const s = loadLocal();
  s.db.events.push(event);
  saveLocal(s);
}

export async function createUser(profile: UserProfile): Promise<void> {
  const t = tauriInvoker();
  if (t) {
    await t.invoke('create_user', { profile });
    return;
  }
  const s = loadLocal();
  s.db.users.push(profile);
  saveLocal(s);
}

export async function listUsers(): Promise<UserProfile[]> {
  const t = tauriInvoker();
  if (t) return t.invoke<UserProfile[]>('list_users');
  const s = loadLocal();
  return s.db.users;
}

export async function getAnswerHistory(
  username: string,
  since?: string,
): Promise<AnswerEvent[]> {
  const t = tauriInvoker();
  if (t) return t.invoke<AnswerEvent[]>('get_answer_history', { username, since });
  const s = loadLocal();
  return s.db.events.filter(
    (e) => e.username === username && (!since || e.timestamp >= since),
  );
}

export async function checkpointDb(): Promise<void> {
  const t = tauriInvoker();
  if (t) await t.invoke('checkpoint_db');
}

// Preferences (via tauri-plugin-store when available; localStorage otherwise).
interface PrefShape {
  db_path: string | null;
  last_username: string | null;
}

async function loadTauriStore() {
  if (!isTauri()) return null;
  try {
    const mod = await import('@tauri-apps/plugin-store');
    const store = await mod.load('prefs.json', { autoSave: true, defaults: {} });
    return store;
  } catch (e) {
    console.warn('Could not load tauri store', e);
    return null;
  }
}

export async function getPrefs(): Promise<PrefShape> {
  const store = await loadTauriStore();
  if (store) {
    const db_path = (await store.get<string>('db_path')) ?? null;
    const last_username = (await store.get<string>('last_username')) ?? null;
    return { db_path, last_username };
  }
  const s = loadLocal();
  return s.prefs;
}

export async function setPref<K extends keyof PrefShape>(
  key: K,
  value: PrefShape[K],
): Promise<void> {
  const store = await loadTauriStore();
  if (store) {
    await store.set(key, value ?? null);
    await store.save();
    return;
  }
  const s = loadLocal();
  s.prefs[key] = value;
  saveLocal(s);
}

export async function chooseDbPath(): Promise<string | null> {
  if (!isTauri()) {
    return prompt('Database path (fake in-browser):', '/tmp/family.flashcards_sqlite');
  }
  const mod = await import('@tauri-apps/plugin-dialog');
  const path = await mod.save({
    defaultPath: 'family.flashcards_sqlite',
    filters: [{ name: 'Flashcards DB', extensions: ['flashcards_sqlite'] }],
  });
  return path;
}

export async function pickExistingDb(): Promise<string | null> {
  if (!isTauri()) {
    return prompt('Existing DB path (fake in-browser):', '/tmp/family.flashcards_sqlite');
  }
  const mod = await import('@tauri-apps/plugin-dialog');
  const path = await mod.open({
    multiple: false,
    directory: false,
    filters: [{ name: 'Flashcards DB', extensions: ['flashcards_sqlite'] }],
  });
  return typeof path === 'string' ? path : null;
}

export const BROWSER_MODE = !isTauri();
