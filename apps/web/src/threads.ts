import type { HistoryEntry } from './store'

/**
 * A letter and its rewrites form one thread.
 *
 * Two rules, in order:
 *
 * 1. **Lineage wins.** Every entry saved since v1.1.1 records the entry it was
 *    derived from, so a parent chain is authoritative. Nothing else is consulted
 *    when both sides have one.
 *
 * 2. **Legacy guess, only when lineage is missing.** Older entries have no
 *    parent, so two are treated as the same letter when
 *      - the greeting line is identical ("Dear Mia,"), and
 *      - at least 20 words of body, and
 *      - the bodies overlap by ≥ 0.65 on word bigrams.
 *    A guess never re-parents an entry that has a real parent, and a second
 *    generated letter only joins a thread when it is a near-duplicate (0.85).
 *
 * Kept free of browser APIs so the rules can be exercised from Node.
 */

export type Thread = {
  root: string
  /** Oldest first: the original letter, then each rewrite. */
  versions: HistoryEntry[]
}

const GREETING = /^(dear|hi|hello|to whom it may concern)\b/i
const SIGN_OFF =
  /^(?:(?:best|kind|warm|many)\s+)?(?:regards|wishes|sincerely|yours|respectfully|thanks|thank you|cheers)\b/i

const MIN_WORDS = 20
const SAME_LETTER = 0.65
const SAME_BODY = 0.85

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

type Parts = { greeting: string; body: string }

function partsOf(text: string): Parts {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const first = lines[0] ?? ''
  const greeting = GREETING.test(first) ? normalize(first) : ''

  let end = lines.length
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (SIGN_OFF.test(lines[index]!)) {
      end = index
      break
    }
  }

  const start = greeting ? 1 : 0
  return { greeting, body: normalize(lines.slice(start, Math.max(start, end)).join(' ')) }
}

function bigrams(body: string): Set<string> {
  const words = body.split(' ').filter(Boolean)
  const set = new Set<string>()
  if (words.length === 0) return set
  for (let index = 0; index < words.length - 1; index += 1) {
    set.add(`${words[index]} ${words[index + 1]}`)
  }
  if (words.length === 1) set.add(words[0]!)
  return set
}

export function similarity(a: string, b: string): number {
  const left = bigrams(a)
  const right = bigrams(b)
  if (left.size === 0 || right.size === 0) return 0
  let shared = 0
  for (const gram of left) if (right.has(gram)) shared += 1
  return shared / (left.size + right.size - shared)
}

function wordsOf(body: string): number {
  return body.split(' ').filter(Boolean).length
}

function sameLetter(a: Parts, b: Parts, threshold: number): boolean {
  if (!a.greeting || a.greeting !== b.greeting) return false
  if (wordsOf(a.body) < MIN_WORDS || wordsOf(b.body) < MIN_WORDS) return false
  return similarity(a.body, b.body) >= threshold
}

export function groupThreads(items: HistoryEntry[]): Thread[] {
  const byId = new Map(items.map((entry) => [entry.id, entry]))

  /** The root of an entry's parent chain, or null when it has no usable parent. */
  function lineageRoot(entry: HistoryEntry): string | null {
    let current: HistoryEntry = entry
    const seen = new Set<string>([current.id])
    let moved = false
    while (current.parentId && byId.has(current.parentId) && !seen.has(current.parentId)) {
      current = byId.get(current.parentId)!
      seen.add(current.id)
      moved = true
    }
    return moved ? current.id : null
  }

  const threads = new Map<string, HistoryEntry[]>()
  const legacy: HistoryEntry[] = []

  for (const entry of items) {
    const root = lineageRoot(entry)
    if (root) {
      const list = threads.get(root) ?? []
      list.push(entry)
      threads.set(root, list)
    } else {
      legacy.push(entry)
    }
  }

  // Attach the parentless rows, oldest first, so a chain grows forwards in time.
  for (const entry of legacy.sort((a, b) => a.createdAt - b.createdAt)) {
    const parts = partsOf(entry.text)
    let best: { root: string; score: number } | null = null

    for (const [root, versions] of threads) {
      const latest = versions[versions.length - 1]!
      const candidate = partsOf(latest.text)
      // Two generated letters are only the same letter when the bodies match.
      const threshold = entry.mode === 'generate' && latest.mode === 'generate' ? SAME_BODY : SAME_LETTER
      if (!sameLetter(parts, candidate, threshold)) continue
      const score = similarity(parts.body, candidate.body)
      if (!best || score > best.score) best = { root, score }
    }

    if (best) {
      threads.get(best.root)!.push(entry)
    } else {
      // A child can be stored before its root is seen here; then the root's own
      // id is already a thread key and the entry belongs at the front of it.
      const existing = threads.get(entry.id)
      if (existing) existing.unshift(entry)
      else threads.set(entry.id, [entry])
    }
  }

  return [...threads.entries()]
    .map(([root, versions]) => ({
      root,
      versions: versions.sort((a, b) => a.createdAt - b.createdAt),
    }))
    .sort(
      (a, b) =>
        b.versions[b.versions.length - 1]!.createdAt - a.versions[a.versions.length - 1]!.createdAt,
    )
}
