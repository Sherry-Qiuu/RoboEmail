import { useEffect, useState } from 'react'
import { api, categoryLabel, type Insights, type LearnItem } from '../api'

type Props = {
  signedIn: boolean
  onNeedAccount: () => void
}

export function LearnPage({ signedIn, onNeedAccount }: Props) {
  const [data, setData] = useState<Insights | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (!signedIn) {
      setLoading(false)
      return
    }
    api
      .insights()
      .then(setData)
      .catch((cause) => setError(cause instanceof Error ? cause.message : '出错了'))
      .finally(() => setLoading(false))
  }, [signedIn])

  async function toggle(item: LearnItem) {
    const result = await api.setMastered(item.id).catch(() => null)
    if (!result) return
    setData((current) => {
      if (!current) return current
      return {
        ...current,
        mastered: current.mastered + (result.mastered ? 1 : -1),
        items: current.items.map((row) =>
          row.id === item.id ? { ...row, mastered: result.mastered ? 1 : 0 } : row,
        ),
      }
    })
  }

  if (!signedIn) {
    return (
      <section>
        <h1 className="font-display text-[32px] leading-none tracking-tight">学习</h1>
        <p className="mt-4 max-w-[420px] text-[14px] text-muted">
          登录后，每次润色改掉的错误会记在这里，按类别归档。
        </p>
        <button className="btn btn-primary mt-8" onClick={onNeedAccount}>
          登录
        </button>
      </section>
    )
  }

  if (loading) {
    return (
      <section>
        <h1 className="font-display text-[32px] leading-none tracking-tight">学习</h1>
        <p className="mt-6 text-[13px] text-faint">读取中…</p>
      </section>
    )
  }

  if (error) {
    return (
      <section>
        <h1 className="font-display text-[32px] leading-none tracking-tight">学习</h1>
        <p className="mt-6 text-[13px] text-warn">{error}</p>
      </section>
    )
  }

  if (!data || data.total === 0) {
    return (
      <section>
        <h1 className="font-display text-[32px] leading-none tracking-tight">学习</h1>
        <p className="mt-6 border-t border-rule pt-6 text-[13px] text-faint">
          还没有记录。润色一封邮件，改掉的错误会自动进这里。
        </p>
      </section>
    )
  }

  const peak = Math.max(1, ...data.daily.map((day) => day.n))
  const top = Math.max(1, ...data.byCategory.map((row) => row.n))
  const items = filter ? data.items.filter((item) => item.category === filter) : data.items

  return (
    <section>
      <h1 className="font-display text-[32px] leading-none tracking-tight">学习</h1>

      <div className="mt-10 grid gap-10 sm:grid-cols-[140px_1fr]">
        <div>
          <span className="label">累计</span>
          <p className="font-display text-[44px] leading-none tracking-tight">{data.total}</p>
          <p className="mt-2 text-[12px] text-faint">已掌握 {data.mastered}</p>
        </div>

        <div>
          <span className="label">近 7 天</span>
          <div className="mt-3 flex h-24 items-end gap-2">
            {data.daily.map((day) => (
              <div
                key={day.day}
                className="flex-1 rounded-[1px] bg-accent-soft"
                style={{ height: `${Math.max((day.n / peak) * 100, day.n > 0 ? 8 : 2)}%` }}
                title={`${day.day} · ${day.n}`}
              />
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            {data.daily.map((day) => (
              <span key={day.day} className="flex-1 text-center text-[10px] text-faint">
                {day.day.slice(8)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-12">
        <span className="label">按类别</span>
        <div className="mt-3">
          {data.byCategory.map((row) => (
            <div key={row.category} className="flex items-center gap-3 py-1.5">
              <span className="w-24 shrink-0 text-[12px] text-muted">
                {categoryLabel(row.category)}
              </span>
              <div className="h-[3px] flex-1 bg-rule">
                <div className="h-full bg-accent" style={{ width: `${(row.n / top) * 100}%` }} />
              </div>
              <span className="w-5 text-right text-[12px] text-faint">{row.n}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12">
        <div className="flex items-baseline justify-between border-b border-rule pb-3">
          <span className="label">错题本</span>
          <span className="text-[12px] text-faint">{items.length} 条</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('')}
            className={`border px-3 py-1 text-[12px] transition-colors ${
              filter === '' ? 'border-ink bg-ink text-paper' : 'border-rule text-muted hover:border-ink'
            }`}
          >
            全部
          </button>
          {data.byCategory.map((row) => (
            <button
              key={row.category}
              onClick={() => setFilter(row.category)}
              className={`border px-3 py-1 text-[12px] transition-colors ${
                filter === row.category
                  ? 'border-ink bg-ink text-paper'
                  : 'border-rule text-muted hover:border-ink'
              }`}
            >
              {categoryLabel(row.category)}
            </button>
          ))}
        </div>

        <ul className="mt-6">
          {items.map((item) => (
            <li key={item.id} className="border-t border-rule py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <span className="label">{categoryLabel(item.category)}</span>
                  <p className="mt-1 text-[14px]">
                    <span className="text-faint line-through">{item.before}</span>
                    <span className="mx-2 text-faint">→</span>
                    <span className="text-accent">{item.after}</span>
                  </p>
                  <p className="mt-1 text-[13px] text-muted">{item.explanation_zh}</p>
                </div>
                <button
                  onClick={() => toggle(item)}
                  className={`shrink-0 text-[12px] transition-colors ${
                    item.mastered ? 'text-accent' : 'text-muted hover:text-ink'
                  }`}
                >
                  {item.mastered ? '已掌握' : '标记已掌握'}
                </button>
              </div>
            </li>
          ))}
        </ul>

        {items.length === 0 && (
          <p className="border-t border-rule pt-6 text-[13px] text-faint">这个类别下还没有记录。</p>
        )}
      </div>
    </section>
  )
}
