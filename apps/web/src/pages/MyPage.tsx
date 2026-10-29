import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { api } from '../api'
import { history, type HistoryEntry } from '../store'

function formatDate(value: number): string {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
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

export function MyPage({ signedIn }: { signedIn: boolean }) {
  const [items, setItems] = useState<HistoryEntry[]>([])
  const [ready, setReady] = useState(false)
  const [copied, setCopied] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

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

  async function changePassword(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setNotice('')
    try {
      await api.changePassword(current, next)
      setCurrent('')
      setNext('')
      setNotice('密码改好了，其他设备已退出')
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : '出错了')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <h1 className="font-display text-[32px] leading-none tracking-tight">我的</h1>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button className="btn btn-ghost" onClick={() => download(items)} disabled={items.length === 0}>
          导出
        </button>
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

      {ready && items.length === 0 && (
        <p className="mt-12 border-t border-rule pt-6 text-[13px] text-faint">
          还没有记录。润色或生成一次就会出现在这里。
        </p>
      )}

      <ul className="mt-10">
        {items.map((entry) => (
          <li key={entry.id} className="border-t border-rule py-4">
            <div className="flex items-baseline justify-between gap-4">
              <div className="min-w-0">
                <span className="text-[12px] text-faint">
                  {formatDate(entry.createdAt)} · {entry.mode === 'polish' ? '润色' : '写邮件'} ·{' '}
                  {entry.meta}
                </span>
                <p className="mt-1 truncate text-[14px]">{entry.title}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-[12px]">
                <button className="text-muted transition-colors hover:text-ink" onClick={() => copy(entry)}>
                  {copied === entry.id ? '已复制' : '复制'}
                </button>
                <button
                  className="text-muted transition-colors hover:text-warn"
                  onClick={() => remove(entry.id)}
                >
                  删除
                </button>
              </div>
            </div>

            <details className="mt-2">
              <summary className="cursor-pointer text-[12px] text-faint">展开</summary>
              <pre className="mt-3 whitespace-pre-wrap border border-rule bg-surface px-5 py-4 font-sans text-[14px] leading-[1.8]">
                {entry.text}
              </pre>
            </details>
          </li>
        ))}
      </ul>

      {signedIn && (
        <div className="mt-16 border-t border-rule pt-8">
          <span className="label">修改密码</span>
          <form onSubmit={changePassword} className="mt-3 max-w-[320px] space-y-3">
            <div>
              <span className="text-[12px] text-faint">当前密码</span>
              <input
                type="password"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
                className="field mt-1"
                autoComplete="current-password"
              />
            </div>
            <div>
              <span className="text-[12px] text-faint">新密码</span>
              <input
                type="password"
                value={next}
                onChange={(event) => setNext(event.target.value)}
                className="field mt-1"
                autoComplete="new-password"
              />
            </div>
            {notice && <p className="text-[12px] text-muted">{notice}</p>}
            <button className="btn btn-ghost" disabled={saving || !current || next.length < 8}>
              {saving ? '保存中…' : '保存'}
            </button>
          </form>
        </div>
      )}
    </section>
  )
}
