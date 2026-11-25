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
  /** The entry this one was derived from, so a letter and its rewrites group. */
  parentId?: string
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

  /** Returns the id of the row it wrote, so callers can chain entries. */
  async add(entry: Omit<HistoryEntry, 'id' | 'createdAt'>): Promise<string> {
    const id = crypto.randomUUID()
    await run('readwrite', (store) => store.put({ ...entry, id, createdAt: Date.now() }))
    return id
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

export async function remember(
  entry: Omit<HistoryEntry, 'id' | 'createdAt'>,
): Promise<string | undefined> {
  try {
    return await history.add(entry)
  } catch {
    return undefined
  }
}

export { summaryLine } from './summary.ts'
