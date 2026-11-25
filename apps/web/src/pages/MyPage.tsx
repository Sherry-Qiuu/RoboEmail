import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { exportHtml, exportJson, exportPdf, exportWord } from '../export'
import { history, summaryLine, type HistoryEntry } from '../store'
import { groupThreads, type Thread } from '../threads'

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

function timeOf(value: number): string {
  return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

/** Local calendar day, so "today" matches what the clock on the wall shows. */
function dayKey(value: number): string {
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

function todayKey(): string {
  return dayKey(Date.now())
}

type DayEntry = {
  root: string
  first: HistoryEntry
  latest: HistoryEntry
  total: number
}

/**
 * A rewrite's own summary is taken from its body, so the subject would be lost.
 * The generated original carries the subject, and that is what names the thread.
 */
function threadTitle(thread: Thread): string {
  const original = thread.versions.find((entry) => entry.mode === 'generate' && entry.title.trim())
  if (original) return original.title
  return previewOf(thread.versions[thread.versions.length - 1]!)
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function MyPage() {
  const [items, setItems] = useState<HistoryEntry[]>([])
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState('')
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  })
  const [selectedDay, setSelectedDay] = useState('')
  const [selectedRoot, setSelectedRoot] = useState('')
  const [openVersions, setOpenVersions] = useState<Set<string>>(new Set())
  const [popOpen, setPopOpen] = useState(false)
  const [popYear, setPopYear] = useState(cursor.year)
  const [scrolled, setScrolled] = useState(false)

  const menu = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const calRef = useRef<HTMLDivElement>(null)

  const threads = useMemo(() => groupThreads(items), [items])
  const byRoot = useMemo(() => new Map(threads.map((thread) => [thread.root, thread])), [threads])

  /** Which letters had activity on each calendar day. */
  const days = useMemo(() => {
    const map = new Map<string, DayEntry[]>()
    for (const thread of threads) {
      const perDay = new Map<string, HistoryEntry[]>()
      for (const version of thread.versions) {
        const key = dayKey(version.createdAt)
        const list = perDay.get(key) ?? []
        list.push(version)
        perDay.set(key, list)
      }
      for (const [key, list] of perDay) {
        const bucket = map.get(key) ?? []
        bucket.push({
          root: thread.root,
          first: list[0]!,
          latest: list[list.length - 1]!,
          total: thread.versions.length,
        })
        map.set(key, bucket)
      }
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => b.latest.createdAt - a.latest.createdAt)
    }
    return map
  }, [threads])

  function selectThread(root: string) {
    setSelectedRoot(root)
    const thread = byRoot.get(root)
    const latest = thread?.versions[thread.versions.length - 1]
    setOpenVersions(new Set(latest ? [latest.id] : []))
  }

  function openDay(day: string) {
    setSelectedDay(day)
    const [year, month] = day.split('-').map(Number)
    if (year && month) setCursor({ year, month })
    const first = days.get(day)?.[0]
    if (first) selectThread(first.root)
    else {
      setSelectedRoot('')
      setOpenVersions(new Set())
    }
  }

  useEffect(() => {
    if (!ready) return
    if (selectedDay && days.has(selectedDay)) {
      const bucket = days.get(selectedDay)!
      if (bucket.some((entry) => entry.root === selectedRoot)) return
      if (bucket[0]) selectThread(bucket[0].root)
      return
    }
    const keys = [...days.keys()].sort()
    if (keys.length === 0) {
      setSelectedDay('')
      setSelectedRoot('')
      return
    }
    openDay(days.has(todayKey()) ? todayKey() : keys[keys.length - 1]!)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, days])

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

  useEffect(() => {
    if (!popOpen) return
    function onDown(event: MouseEvent) {
      if (!calRef.current?.contains(event.target as Node)) setPopOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setPopOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [popOpen])

  async function refresh() {
    setItems(await history.list())
  }

  useEffect(() => {
    refresh()
      .catch(() => undefined)
      .finally(() => setReady(true))
  }, [])

  async function remove(id: string) {
    await history.remove(id)
    await refresh()
  }

  async function removeThread(thread: Thread) {
    const message =
      thread.versions.length > 1 ? '删除这封邮件和它的全部版本？' : '删除这条记录？'
    if (!window.confirm(message)) return
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

  const monthThreads = days.get(selectedDay) ?? []
  const thread = byRoot.get(selectedRoot)
  const monthFirst = new Date(cursor.year, cursor.month - 1, 1)
  const monthDays = new Date(cursor.year, cursor.month, 0).getDate()
  const leading = monthFirst.getDay()
  const cells: { label: number | ''; key?: string; muted?: boolean; count: number }[] = []

  for (let i = leading - 1; i >= 0; i -= 1) {
    cells.push({ label: new Date(cursor.year, cursor.month - 1, -i).getDate(), muted: true, count: 0 })
  }
  for (let date = 1; date <= monthDays; date += 1) {
    const key = `${cursor.year}-${String(cursor.month).padStart(2, '0')}-${String(date).padStart(2, '0')}`
    cells.push({ label: date, key, count: days.get(key)?.length ?? 0 })
  }
  while (cells.length % 7 !== 0) cells.push({ label: '', muted: true, count: 0 })

  return (
    <section className="history-page">
      <div className="history-head">
        <h1 className="font-display text-[32px] leading-none tracking-tight">历史记录</h1>

        <div className="flex flex-wrap items-center justify-end gap-3">
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
                className="panel absolute right-0 top-[calc(100%+6px)] z-20 w-[200px] overflow-hidden py-1"
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
      </div>

      {notice && <p className="mt-3 text-[12px] text-warn">{notice}</p>}

      {ready && items.length === 0 ? (
        <p className="mt-12 border-t border-rule pt-6 text-[13px] text-faint">
          还没有记录。润色或生成一次就会出现在这里。
        </p>
      ) : (
        <div className="history-panes">
          <div className="history-rail">
            <div className="history-cal" ref={calRef}>
              <div className="history-cal-head">
                <button
                  className="history-cal-title"
                  onClick={() => {
                    setPopYear(cursor.year)
                    setPopOpen((open) => !open)
                  }}
                  aria-haspopup="dialog"
                  aria-expanded={popOpen}
                >
                  {cursor.year} 年 {cursor.month} 月 <span className="caret">▾</span>
                </button>
                <span className="history-cal-nav">
                  <button
                    aria-label="上个月"
                    onClick={() =>
                      setCursor((current) =>
                        current.month === 1
                          ? { year: current.year - 1, month: 12 }
                          : { year: current.year, month: current.month - 1 },
                      )
                    }
                  >
                    ‹
                  </button>
                  <button
                    aria-label="下个月"
                    onClick={() =>
                      setCursor((current) =>
                        current.month === 12
                          ? { year: current.year + 1, month: 1 }
                          : { year: current.year, month: current.month + 1 },
                      )
                    }
                  >
                    ›
                  </button>
                </span>
              </div>

              <div className="history-cal-weekdays">
                {WEEKDAYS.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>

              <div className="history-cal-days">
                {cells.map((cell, index) => (
                  <button
                    key={cell.key ?? `blank-${index}`}
                    className={[
                      'history-day',
                      cell.muted ? 'history-day--muted' : '',
                      cell.key === todayKey() ? 'history-day--today' : '',
                      cell.key && cell.key === selectedDay ? 'history-day--selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => cell.key && openDay(cell.key)}
                    disabled={!cell.key}
                  >
                    {cell.label}
                    {cell.count > 0 && <span className="dot" />}
                  </button>
                ))}
              </div>

              {popOpen && (
                <div className="history-cal-pop" role="dialog" aria-label="选择月份">
                  <div className="history-cal-pop-head">
                    <button aria-label="上一年" onClick={() => setPopYear((year) => year - 1)}>
                      ‹
                    </button>
                    <span className="text-[13px]">{popYear} 年</span>
                    <button aria-label="下一年" onClick={() => setPopYear((year) => year + 1)}>
                      ›
                    </button>
                  </div>

                  <div className="history-cal-months">
                    {Array.from({ length: 12 }, (_unused, index) => index + 1).map((month) => (
                      <button
                        key={month}
                        aria-current={month === cursor.month && popYear === cursor.year}
                        onClick={() => {
                          setCursor({ year: popYear, month })
                          setPopOpen(false)
                        }}
                      >
                        {month} 月
                      </button>
                    ))}
                  </div>

                  <div className="history-cal-pop-foot">
                    <button
                      onClick={() => {
                        setPopOpen(false)
                        openDay(todayKey())
                      }}
                    >
                      今天
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="history-daylist">
              <div className="flex items-baseline justify-between">
                <span className="label">
                  {selectedDay
                    ? `${Number(selectedDay.slice(5, 7))} 月 ${Number(selectedDay.slice(8))} 日`
                    : '选择日期'}
                </span>
                {monthThreads.length > 0 && (
                  <span className="text-[12px] text-faint">{monthThreads.length} 封</span>
                )}
              </div>

              <ul>
                {monthThreads.map((entry) => {
                  const span =
                    entry.first.createdAt === entry.latest.createdAt
                      ? timeOf(entry.latest.createdAt)
                      : `${timeOf(entry.first.createdAt)}–${timeOf(entry.latest.createdAt)}`
                  return (
                    <li key={entry.root}>
                      <button
                        className="history-entry"
                        aria-current={entry.root === selectedRoot}
                        onClick={() => selectThread(entry.root)}
                      >
                        <span className="history-entry-time">{span}</span>
                        <span className="history-entry-title">
                          {byRoot.get(entry.root) ? threadTitle(byRoot.get(entry.root)!) : previewOf(entry.latest)}
                        </span>
                        {entry.total > 1 && (
                          <span className="history-entry-tag">{entry.total} 个版本</span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>

              {ready && monthThreads.length === 0 && (
                <p className="mt-3 text-[12px] text-faint">这一天没有记录。</p>
              )}
            </div>
          </div>

          <div
            className="history-pane"
            data-scrolled={scrolled}
            onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 4)}
          >
            {thread ? (
              <>
                <div className="history-thread-head">
                  <h2 className="font-display text-[22px] leading-tight tracking-tight">
                    {threadTitle(thread)}
                  </h2>
                  <p className="mt-1.5 text-[12px] text-faint">
                    {thread.versions.length} 个版本 ·{' '}
                    {timeOf(thread.versions[0]!.createdAt)} –{' '}
                    {timeOf(thread.versions[thread.versions.length - 1]!.createdAt)}
                  </p>
                  <div className="mt-2 flex gap-4 text-[12px] text-muted">
                    <button
                      className="transition-colors hover:text-ink"
                      onClick={() => copy(thread.versions[thread.versions.length - 1]!)}
                    >
                      {copied === thread.versions[thread.versions.length - 1]!.id
                        ? '已复制'
                        : '复制最新'}
                    </button>
                    <button
                      className="transition-colors hover:text-warn"
                      onClick={() => removeThread(thread)}
                    >
                      删除整封
                    </button>
                  </div>
                </div>

                <div className="border-t border-rule">
                  {thread.versions.map((version, index) => {
                    const open = openVersions.has(version.id)
                    const label =
                      index === 0 ? '新建' : index === thread.versions.length - 1 ? '改动 · 当前' : '改动'
                    return (
                      <div key={version.id} className="history-version" data-open={open}>
                        <button
                          className="history-version-head"
                          aria-expanded={open}
                          onClick={() =>
                            setOpenVersions((current) => {
                              const next = new Set(current)
                              if (next.has(version.id)) next.delete(version.id)
                              else next.add(version.id)
                              return next
                            })
                          }
                        >
                          <span className="history-version-caret">▶</span>
                          <span className="history-version-label">{label}</span>
                          <span className="history-version-meta">
                            {timeOf(version.createdAt)} · {version.meta}
                          </span>
                          <span className="ml-auto flex gap-3 text-[12px] text-muted">
                            <span
                              role="button"
                              tabIndex={0}
                              className="transition-colors hover:text-ink"
                              onClick={(event) => {
                                event.stopPropagation()
                                void copy(version)
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.stopPropagation()
                                  void copy(version)
                                }
                              }}
                            >
                              {copied === version.id ? '已复制' : '复制'}
                            </span>
                            <span
                              role="button"
                              tabIndex={0}
                              className="transition-colors hover:text-warn"
                              onClick={(event) => {
                                event.stopPropagation()
                                void remove(version.id)
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.stopPropagation()
                                  void remove(version.id)
                                }
                              }}
                            >
                              删除
                            </span>
                          </span>
                        </button>

                        {open && <div className="history-version-body"><pre className="history-letter">{version.text}</pre></div>}
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <p className="text-[13px] text-faint">左边选一封，这里会列出它的新建和每次改动。</p>
            )}
          </div>
        </div>
      )}

      {!ready && <p className="mt-8 text-[13px] text-faint">读取中…</p>}
    </section>
  )
}
