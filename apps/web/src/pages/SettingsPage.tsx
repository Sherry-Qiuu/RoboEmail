import { useState, type FormEvent } from 'react'
import { api, type User } from '../api'
import { openChangelog } from '../releaseNotes'

type Props = {
  user: User
  onLoggedOut: () => void
}

export function SettingsPage({ user, onLoggedOut }: Props) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const mismatch = repeat.length > 0 && repeat !== next
  const ready = Boolean(current) && next.length >= 8 && repeat === next

  async function changePassword(event: FormEvent) {
    event.preventDefault()
    if (next !== repeat) {
      setNotice('两次输入的新密码不一样')
      return
    }
    setSaving(true)
    setNotice('')
    try {
      await api.changePassword(current, next)
      setCurrent('')
      setNext('')
      setRepeat('')
      setNotice('密码改好了，其他设备已退出')
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : '出错了')
    } finally {
      setSaving(false)
    }
  }

  async function logout() {
    setLeaving(true)
    await api.logout().catch(() => undefined)
    onLoggedOut()
  }

  return (
    <section>
      <h1 className="font-display text-[32px] leading-none tracking-tight">设置</h1>

      <div className="mt-8 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-[13px]">
        <span className="text-muted">{user.username}</span>
        <span className="text-faint">{user.email}</span>
        {user.isUnnc && <span className="text-faint">UNNC</span>}
      </div>

      <div className="mt-12 max-w-[320px]">
        <span className="label">修改密码</span>
        <form onSubmit={changePassword} className="mt-3 space-y-3">
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
          <div>
            <span className="text-[12px] text-faint">再输一次新密码</span>
            <input
              type="password"
              value={repeat}
              onChange={(event) => setRepeat(event.target.value)}
              className="field mt-1"
              autoComplete="new-password"
              aria-invalid={mismatch}
            />
          </div>
          {mismatch && <p className="text-[12px] text-warn">两次输入的新密码不一样</p>}
          {notice && <p className="text-[12px] text-muted">{notice}</p>}
          <button className="btn btn-ghost" disabled={saving || !ready}>
            {saving ? '保存中…' : '保存'}
          </button>
        </form>
      </div>

      <div className="mt-16 flex flex-col gap-4 border-t border-rule pt-6">
        <button
          className="self-start text-[13px] text-muted transition-colors hover:text-ink"
          onClick={openChangelog}
        >
          查看历史更新记录
        </button>
        <button
          className="self-start text-[13px] text-muted transition-colors hover:text-ink"
          onClick={logout}
          disabled={leaving}
        >
          {leaving ? '退出中…' : '退出登录'}
        </button>
      </div>
    </section>
  )
}
