import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { exportHtml, exportJson, exportPdf, exportWord } from '../export'
import { history, summaryLine, type HistoryEntry } from '../store'

/**
 * Generated mail stores the subject line, which reads well on its own. Polished
 * mail stores whatever the model returned, whose first line is a salutation, so
 * the preview is derived from the body instead — this also repairs rows saved
 * before the preview rule existed.
 */
function previewOf(entry: HistoryEntry): string {
  if (entry.mode === 'generate' && entry.title.trim()) return entry.title
  return summaryLine(entry.text, entry.title || '润色')
}

function formatDate(value: number): string {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function timeOf(value: number): string {
  return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

type Thread = {
  id: string
  versions: HistoryEntry[]
}

/**
 * A generated letter and every rewrite that came from it belong together.
 * Entries carry the id they were derived from; walking that chain gives the
 * thread they belong to. Entries saved before this existed have no parent and
 * each land in a thread of their own.
 */
function groupThreads(items: HistoryEntry[]): Thread[] {
  const byId = new Map(items.map((entry) => [entry.id, entry]))

  function rootOf(entry: HistoryEntry): string {
    let current = entry
    const seen = new Set<string>([current.id])
    while (current.parentId && byId.has(current.parentId) && !seen.has(current.parentId)) {
      current = byId.get(current.parentId)!
      seen.add(current.id)
    }
    return current.id
  }

  const groups = new Map<string, HistoryEntry[]>()
  for (const entry of items) {
    const root = rootOf(entry)
    const list = groups.get(root) ?? []
    list.push(entry)
    groups.set(root, list)
  }

  return [...groups.entries()]
    .map(([id, versions]) => ({ id, versions: versions.sort((a, b) => a.createdAt - b.createdAt) }))
    .sort((a, b) => b.versions[b.versions.length - 1]!.createdAt - a.versions[a.versions.length - 1]!.createdAt)
}

function download(entries: HistoryEntry[]): void {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `roboemail-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

export function MyPage() {
  const [items, setItems] = useState<HistoryEntry[]>([])
  const [ready, setReady] = useState(false)
  const [copied, setCopied] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [openThreads, setOpenThreads] = useState<Record<string, boolean>>({})
  const [openVersions, setOpenVersions] = useState<Record<string, boolean>>({})
  const fileInput = useRef<HTMLInputElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onDown(event: MouseEvent) {
      if (!menu.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  function pick(format: 'word' | 'pdf' | 'html' | 'json') {
    setMenuOpen(false)
    setNotice('')
    if (items.length === 0) return
    if (format === 'word') exportWord(items)
    if (format === 'html') exportHtml(items)
    if (format === 'json') exportJson(items)
    if (format === 'pdf' && !exportPdf(items)) {
      setNotice('浏览器拦住了新窗口，允许后重试，或用 Word 导出再另存为 PDF。')
    }
  }

  async function refresh() {
    setItems(await history.list())
  }

  useEffect(() => {
    refresh().finally(() => setReady(true))
  }, [])

  async function remove(id: string) {
    await history.remove(id)
    await refresh()
  }

  async function removeThread(thread: Thread) {
    if (!window.confirm(thread.versions.length > 1 ? '删除这封邮件和它的全部版本？' : '删除这条记录？')) {
      return
    }
    for (const version of thread.versions) await history.remove(version.id)
    await refresh()
  }

  async function clearAll() {
    if (!window.confirm('清空这台设备上的全部记录？')) return
    await history.clear()
    await refresh()
  }

  async function copy(entry: HistoryEntry) {
    await navigator.clipboard.writeText(entry.text)
    setCopied(entry.id)
    window.setTimeout(() => setCopied(''), 1600)
  }

  async function onImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as HistoryEntry[]
      for (const entry of parsed) {
        if (entry?.id && entry?.text) await history.put(entry)
      }
      await refresh()
    } catch {
      window.alert('这个文件读不出来，可能是导出的格式不对。')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <section>
      <h1 className="font-display text-[32px] leading-none tracking-tight">历史记录</h1>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative" ref={menu}>
          <button
            className="btn btn-ghost"
            onClick={() => setMenuOpen((open) => !open)}
            disabled={items.length === 0}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            导出
            <span className="text-faint">▾</span>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="panel absolute left-0 top-[calc(100%+6px)] z-20 w-[200px] overflow-hidden py-1"
            >
              {[
                ['word', 'Word 文档', '每封信另起一页'],
                ['pdf', 'PDF', '打印后另存为 PDF'],
                ['html', '网页', '左侧带目录'],
                ['json', '备份文件', '可重新导入'],
              ].map(([value, label, hint]) => (
                <button
                  key={value}
                  role="menuitem"
                  onClick={() => pick(value as 'word' | 'pdf' | 'html' | 'json')}
                  className="block w-full px-4 py-2 text-left transition-colors hover:bg-[var(--edge-hover,#f0f0ec)]"
                >
                  <span className="block text-[13px]">{label}</span>
                  <span className="block text-[11px] text-faint">{hint}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="btn btn-ghost" onClick={() => fileInput.current?.click()}>
          导入
        </button>
        <button className="btn btn-ghost" onClick={clearAll} disabled={items.length === 0}>
          清空
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          onChange={onImport}
          className="hidden"
        />
      </div>

      {notice && <p className="mt-6 text-[12px] text-warn">{notice}</p>}

      {ready && items.length === 0 && (
        <p className="mt-12 border-t border-rule pt-6 text-[13px] text-faint">
          还没有记录。润色或生成一次就会出现在这里。
        </p>
      )}

      <div className="mt-10">
        {groupThreads(items).map((thread, threadIndex) => {
          const first = thread.versions[0]!
          const last = thread.versions[thread.versions.length - 1]!
          const threadOpen = openThreads[thread.id] ?? threadIndex === 0
          const span =
            new Date(first.createdAt).toDateString() === new Date(last.createdAt).toDateString()
              ? `${formatDate(first.createdAt).slice(0, 5)} ${timeOf(first.createdAt)}–${timeOf(last.createdAt)}`
              : `${formatDate(first.createdAt)} – ${formatDate(last.createdAt)}`

          return (
            <div key={thread.id} className="border-t border-rule">
              <div className="flex items-baseline gap-3 py-4">
                <button
                  className="flex min-w-0 flex-1 items-baseline gap-2 text-left"
                  onClick={() =>
                    setOpenThreads((current) => ({ ...current, [thread.id]: !threadOpen }))
                  }
                  aria-expanded={threadOpen}
                >
                  <span
                    className="w-3 shrink-0 text-[10px] text-faint transition-transform"
                    style={{ transform: threadOpen ? 'rotate(90deg)' : undefined }}
                  >
                    ▶
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 text-[12px] text-faint">
                      <span>{span}</span>
                      {thread.versions.length > 1 && (
                        <span className="rounded-full bg-accent-soft px-2 py-[1px] text-[11px] text-accent">
                          {thread.versions.length} 个版本
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block truncate text-[14px]">{previewOf(last)}</span>
                  </span>
                </button>

                <span className="flex shrink-0 items-center gap-3 text-[12px]">
                  <button
                    className="text-muted transition-colors hover:text-ink"
                    onClick={() => copy(last)}
                  >
                    {copied === last.id ? '已复制' : '复制最新'}
                  </button>
                  <button
                    className="text-muted transition-colors hover:text-warn"
                    onClick={() => removeThread(thread)}
                  >
                    {thread.versions.length > 1 ? '删除整封' : '删除'}
                  </button>
                </span>
              </div>

              {threadOpen && (
                <div className="pb-4 pl-5">
                  {thread.versions.map((entry, index) => {
                    const isLatest = index === thread.versions.length - 1
                    const label =
                      entry.mode === 'generate'
                        ? '原始 · 写邮件'
                        : isLatest
                          ? '润色 · 当前'
                          : '润色'
                    const versionOpen = openVersions[entry.id] ?? false

                    return (
                      <div
                        key={entry.id}
                        className="border-l-2 border-rule pl-4"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <button
                            className="flex min-w-0 items-baseline gap-2 py-2 text-left"
                            onClick={() =>
                              setOpenVersions((current) => ({
                                ...current,
                                [entry.id]: !versionOpen,
                              }))
                            }
                            aria-expanded={versionOpen}
                          >
                            <span
                              className="w-3 shrink-0 text-[9px] text-faint transition-transform"
                              style={{ transform: versionOpen ? 'rotate(90deg)' : undefined }}
                            >
                              ▶
                            </span>
                            <span className="text-[13px]">{label}</span>
                            <span className="text-[12px] text-faint">
                              {timeOf(entry.createdAt)} · {entry.meta}
                            </span>
                          </button>

                          <span className="flex shrink-0 items-center gap-3 text-[12px]">
                            <button
                              className="text-muted transition-colors hover:text-ink"
                              onClick={() => copy(entry)}
                            >
                              {copied === entry.id ? '已复制' : '复制'}
                            </button>
                            <button
                              className="text-muted transition-colors hover:text-warn"
                              onClick={() => remove(entry.id)}
                            >
                              删除
                            </button>
                          </span>
                        </div>

                        {versionOpen && (
                          <pre className="mb-3 whitespace-pre-wrap rounded-[10px] border border-rule bg-surface px-5 py-4 font-sans text-[14px] leading-[1.8]">
                            {entry.text}
                          </pre>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
