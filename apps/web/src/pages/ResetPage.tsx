import { useState, type FormEvent } from 'react'
import { api } from '../api'

type Props = {
  token: string
  onDone: () => void
}

export function ResetPage({ token, onDone }: Props) {
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password !== repeat) {
      setError('两次输入不一致')
      return
    }
    setBusy(true)
    setError('')
    try {
      await api.reset(token, password)
      setDone(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '出错了')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-[360px] pt-10">
        <h1 className="font-display text-[26px] tracking-tight">密码已更新</h1>
        <p className="mt-3 text-[13px] text-muted">所有设备都已退出登录，用新密码登录。</p>
        <button className="btn btn-primary mt-8 w-full" onClick={onDone}>
          去登录
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[360px] pt-10">
      <h1 className="font-display text-[26px] tracking-tight">设置新密码</h1>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <span className="label">新密码</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field mt-1"
            autoComplete="new-password"
            autoFocus
          />
        </div>

        <div>
          <span className="label">再输一次</span>
          <input
            type="password"
            value={repeat}
            onChange={(event) => setRepeat(event.target.value)}
            className="field mt-1"
            autoComplete="new-password"
          />
        </div>

        {error && <p className="text-[13px] text-warn">{error}</p>}

        <button
          className="btn btn-primary w-full"
          disabled={busy || password.length < 8 || !repeat}
        >
          {busy ? '保存中…' : '保存'}
        </button>
      </form>
    </div>
  )
}
