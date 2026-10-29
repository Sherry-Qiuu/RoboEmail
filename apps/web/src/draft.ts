const PREFIX = 'roboemail:draft:'

/**
 * Drafts live in localStorage rather than IndexedDB: they are one small object
 * per page, and losing them is at most annoying, never damaging.
 */
export function readDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeDraft(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Private mode or a full quota. Drafts are a convenience, not a promise.
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // ignore
  }
}
