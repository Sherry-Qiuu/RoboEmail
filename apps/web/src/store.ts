const DB_NAME = 'roboemail'
const STORE = 'emails'

export type HistoryEntry = {
  id: string
  mode: 'polish' | 'generate'
  title: string
  text: string
  meta: string
  createdAt: number
  payload: unknown
}

let opening: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (opening) return opening
  opening = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return opening
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode)
    const request = action(transaction.objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export const history = {
  async list(): Promise<HistoryEntry[]> {
    const rows = await run<HistoryEntry[]>('readonly', (store) => store.getAll())
    return rows.sort((a, b) => b.createdAt - a.createdAt)
  },

  add(entry: Omit<HistoryEntry, 'id' | 'createdAt'>): Promise<IDBValidKey> {
    return run('readwrite', (store) =>
      store.put({ ...entry, id: crypto.randomUUID(), createdAt: Date.now() }),
    )
  },

  /** Used by import, where the original id and timestamp must survive. */
  put(entry: HistoryEntry): Promise<IDBValidKey> {
    return run('readwrite', (store) => store.put(entry))
  },

  remove(id: string): Promise<undefined> {
    return run('readwrite', (store) => store.delete(id))
  },

  clear(): Promise<undefined> {
    return run('readwrite', (store) => store.clear())
  },
}

/** Trials write nothing, so this is a no-op for anonymous use. */
export function remember(
  trial: boolean | undefined,
  entry: Omit<HistoryEntry, 'id' | 'createdAt'>,
): void {
  if (trial) return
  void history.add(entry).catch(() => undefined)
}

export function firstLine(text: string, fallback: string): string {
  const line = text
    .split('\n')
    .map((item) => item.trim())
    .find(Boolean) ?? fallback
  return line.length > 60 ? `${line.slice(0, 60)}…` : line
}
