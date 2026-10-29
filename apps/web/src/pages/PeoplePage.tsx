import { useEffect, useMemo, useState } from 'react'
import { api, type Professor } from '../api'

type Props = {
  signedIn: boolean
  isUnnc: boolean
  onNeedAccount: () => void
  onEnabled: () => void
  onWriteTo: (professor: Professor) => void
}

type GateProps = {
  note: string
  action: string
  onAction: () => void
  busy?: boolean
}

const SCHOOL_LABEL: Record<string, string> = {
  'Faculty of Science and Engineering': '理工学院',
  'Faculty of Humanities and Social Sciences': '人文社科学院',
  'Nottingham University Business School China': '商学院',
}

const FACULTY_OFFICE = 'Faculty of Science and Engineering (faculty office)'

const PAGE_LIMIT = 150

function shortSchool(school: string): string {
  return SCHOOL_LABEL[school] ?? school
}

function Gate({ note, action, onAction, busy }: GateProps) {
  return (
    <section>
      <h1 className="font-display text-[32px] leading-none tracking-tight">教授</h1>
      <p className="mt-4 max-w-[420px] text-[14px] text-muted">{note}</p>
      <button className="btn btn-primary mt-8" onClick={onAction} disabled={busy}>
        {busy ? '开启中…' : action}
      </button>
    </section>
  )
}

export function PeoplePage({ signedIn, isUnnc, onNeedAccount, onEnabled, onWriteTo }: Props) {
  const [items, setItems] = useState<Professor[]>([])
  const [loading, setLoading] = useState(true)
  const [enabling, setEnabling] = useState(false)
  const [query, setQuery] = useState('')
  const [school, setSchool] = useState('')
  const [department, setDepartment] = useState('')

  useEffect(() => {
    if (!signedIn || !isUnnc) {
      setLoading(false)
      return
    }
    api
      .professors('')
      .then((result) => setItems(result.items))
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [signedIn, isUnnc])

  const schools = useMemo(
    () => [...new Set(items.map((item) => item.school).filter(Boolean))].sort(),
    [items],
  )

  const departments = useMemo(() => {
    const pool = school ? items.filter((item) => item.school === school) : items
    return [...new Set(pool.map((item) => item.department).filter(Boolean))].sort()
  }, [items, school])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items.filter((item) => {
      if (school && item.school !== school) return false
      if (department && item.department !== department) return false
      if (!needle) return true
      return `${item.nameEn} ${item.title} ${item.department} ${item.email}`
        .toLowerCase()
        .includes(needle)
    })
  }, [items, query, school, department])

  async function enable() {
    setEnabling(true)
    await api.setUnnc(true).catch(() => undefined)
    setEnabling(false)
    onEnabled()
  }

  if (!signedIn) {
    return (
      <Gate
        note="登录后可以查三个学院老师的职称、邮箱和所属系。"
        action="登录"
        onAction={onNeedAccount}
      />
    )
  }

  if (!isUnnc) {
    return (
      <Gate
        note="教授库只对 UNNC 学生开放。你的账号注册时没有勾选。"
        action="我是 UNNC 学生"
        onAction={enable}
        busy={enabling}
      />
    )
  }

  if (loading) {
    return (
      <section>
        <h1 className="font-display text-[32px] leading-none tracking-tight">教授</h1>
        <p className="mt-6 text-[13px] text-faint">读取中…</p>
      </section>
    )
  }

  const updated = items[0]?.updatedAt.slice(0, 10) ?? ''
  const shown = filtered.slice(0, PAGE_LIMIT)

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-[32px] leading-none tracking-tight">教授</h1>
        <span className="text-[12px] text-faint">
          收录 {items.length} 人
          {updated && ` · 更新于 ${updated}`}
        </span>
      </div>

      <div className="mt-8">
        <span className="label">搜索</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="field mt-1"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {[{ key: '', label: '全部' }, ...schools.map((name) => ({ key: name, label: shortSchool(name) }))].map(
          (option) => (
            <button
              key={option.key || 'all'}
              onClick={() => {
                setSchool(option.key)
                setDepartment('')
              }}
              className={`border px-3 py-1 text-[12px] transition-colors ${
                school === option.key
                  ? 'border-ink bg-ink text-paper'
                  : 'border-rule text-muted hover:border-ink'
              }`}
            >
              {option.label}
            </button>
          ),
        )}
      </div>

      {school && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            onClick={() => setDepartment('')}
            className={`border px-3 py-1 text-[12px] transition-colors ${
              department === ''
                ? 'border-ink bg-ink text-paper'
                : 'border-rule text-muted hover:border-ink'
            }`}
          >
            全部系
          </button>
          {departments.map((name) => (
            <button
              key={name}
              onClick={() => setDepartment(name)}
              className={`border px-3 py-1 text-[12px] transition-colors ${
                department === name
                  ? 'border-ink bg-ink text-paper'
                  : 'border-rule text-muted hover:border-ink'
              }`}
            >
              {name === FACULTY_OFFICE ? '学院办公室' : name}
            </button>
          ))}
        </div>
      )}

      <p className="mt-6 text-[12px] text-faint">
        {filtered.length} 条
        {filtered.length > shown.length && `，显示前 ${shown.length} 条`}
      </p>

      <ul className="mt-2">
        {shown.map((item) => (
          <li
            key={item.id}
            className="flex items-baseline justify-between gap-4 border-t border-rule py-3"
          >
            <div className="min-w-0">
              <p className="text-[14px]">
                {item.nameEn}
                <span className="ml-2 text-[12px] text-faint">{item.title}</span>
              </p>
              <p className="truncate text-[12px] text-faint">
                {!school && `${shortSchool(item.school)} · `}
                {item.department}
                {item.email && ` · ${item.email}`}
              </p>
            </div>
            <button
              onClick={() => onWriteTo(item)}
              className="shrink-0 text-[12px] text-muted transition-colors hover:text-ink"
            >
              写邮件
            </button>
          </li>
        ))}
      </ul>

      {filtered.length === 0 && (
        <p className="border-t border-rule pt-6 text-[13px] text-faint">没有匹配的人。</p>
      )}
    </section>
  )
}
