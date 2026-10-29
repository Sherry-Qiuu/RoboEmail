import { useState, type FormEvent } from 'react'
import { api, type User } from '../api'

type Props = {
  onAuthed: (user: User) => void
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : '出错了'
}

export function AuthPage({ onAuthed }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [stage, setStage] = useState<'form' | 'verify' | 'forgot' | 'sent'>('form')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isUnnc, setIsUnnc] = useState(false)
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState('')
  const [delivered, setDelivered] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submitForm(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (mode === 'login') {
        const { user } = await api.login(username.trim(), password)
        onAuthed(user)
      } else {
        const res = await api.register(username.trim(), email.trim(), password, isUnnc)
        setDevCode(res.devCode ?? '')
        setDelivered(res.delivered !== false)
        setStage('verify')
      }
    } catch (cause) {
      setError(messageOf(cause))
    } finally {
      setBusy(false)
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.verify(email.trim(), code.trim())
      const { user } = await api.login(username.trim(), password)
      onAuthed(user)
    } catch (cause) {
      setError(messageOf(cause))
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    setBusy(true)
    setError('')
    try {
      const res = await api.register(username.trim(), email.trim(), password, isUnnc)
      setDevCode(res.devCode ?? '')
      setDelivered(res.delivered !== false)
    } catch (cause) {
      setError(messageOf(cause))
    } finally {
      setBusy(false)
    }
  }

  async function submitForgot(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.forgot(email.trim())
      setStage('sent')
    } catch (cause) {
      setError(messageOf(cause))
    } finally {
      setBusy(false)
    }
  }

  if (stage === 'forgot' || stage === 'sent') {
    return (
      <div className="mx-auto max-w-[360px] pt-10">
        <h1 className="font-display text-[26px] tracking-tight">找回密码</h1>

        {stage === 'sent' ? (
          <>
            <p className="mt-3 text-[13px] leading-relaxed text-muted">
              如果 {email} 注册过，重置链接已经发出，30 分钟内有效。
            </p>
            <button
              className="btn btn-ghost mt-8 w-full"
              onClick={() => {
                setStage('form')
                setMode('login')
              }}
            >
              返回登录
            </button>
          </>
        ) : (
          <form onSubmit={submitForgot} className="mt-8 space-y-4">
            <div>
              <span className="label">邮箱</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="field mt-1"
                type="email"
                autoComplete="email"
                autoFocus
              />
            </div>

            {error && <p className="text-[13px] text-warn">{error}</p>}

            <button className="btn btn-primary w-full" disabled={busy || !email.trim()}>
              {busy ? '发送中…' : '发送重置链接'}
            </button>

            <button
              type="button"
              className="w-full text-[12px] text-faint transition-colors hover:text-ink"
              onClick={() => setStage('form')}
            >
              返回登录
            </button>
          </form>
        )}
      </div>
    )
  }

  if (stage === 'verify') {
    return (
      <div className="mx-auto max-w-[360px] pt-10">
        <h1 className="font-display text-[26px] tracking-tight">验证邮箱</h1>
        <p className="mt-2 text-[13px] text-muted">
          {delivered
            ? `验证码已发到 ${email}，10 分钟内有效。`
            : `邮件没能发出去，${email} 现在可能收不到。可以重发一次。`}
        </p>

        <form onSubmit={submitCode} className="mt-8 space-y-4">
          <div>
            <span className="label">6 位验证码</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              className="field mt-1 text-center text-[18px] tracking-[0.4em]"
              inputMode="numeric"
              autoFocus
            />
          </div>

          {devCode && (
            <p className="text-[12px] text-faint">
              本地模式：验证码 {devCode}（接上 SMTP 后这里会隐藏）
            </p>
          )}

          {error && <p className="text-[13px] text-warn">{error}</p>}

          <button className="btn btn-primary w-full" disabled={busy || code.length !== 6}>
            {busy ? '验证中…' : '验证并登录'}
          </button>

          <button
            type="button"
            className="w-full text-[12px] text-faint transition-colors hover:text-ink"
            onClick={resend}
            disabled={busy}
          >
            重发验证码
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[360px] pt-10">
      <div className="flex gap-6 border-b border-rule">
        {(['login', 'register'] as const).map((item) => (
          <button
            key={item}
            onClick={() => {
              setMode(item)
              setError('')
            }}
            className={`-mb-px border-b pb-2 text-[14px] transition-colors ${
              mode === item
                ? 'border-ink text-ink'
                : 'border-transparent text-faint hover:text-muted'
            }`}
          >
            {item === 'login' ? '登录' : '注册'}
          </button>
        ))}
      </div>

      <form onSubmit={submitForm} className="mt-8 space-y-4">
        <div>
          <span className="label">用户名</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="field mt-1"
            autoComplete="username"
            autoFocus
          />
        </div>

        {mode === 'register' && (
          <div>
            <span className="label">邮箱</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="field mt-1"
              autoComplete="email"
            />
          </div>
        )}

        <div>
          <span className="label">密码</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field mt-1"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </div>

        {mode === 'register' && (
          <div className="border border-rule px-4 py-3">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={isUnnc}
                onChange={(event) => setIsUnnc(event.target.checked)}
                className="mt-1 accent-accent"
              />
              <span className="text-[13px]">
                我是 UNNC 学生
                <span className="mt-1 block text-[12px] leading-relaxed text-faint">
                  打开后会多两样东西：按教授姓名自动补全称呼，以及教授资料页。不需要的话可以取消勾选。
                </span>
              </span>
            </label>
          </div>
        )}

        {error && <p className="text-[13px] text-warn">{error}</p>}

        <button
          className="btn btn-primary w-full"
          disabled={busy || !username.trim() || !password || (mode === 'register' && !email.trim())}
        >
          {busy ? '请稍候…' : mode === 'login' ? '登录' : '创建账号'}
        </button>

        {mode === 'login' && (
          <button
            type="button"
            className="w-full text-[12px] text-faint transition-colors hover:text-ink"
            onClick={() => {
              setError('')
              setStage('forgot')
            }}
          >
            忘记密码
          </button>
        )}
      </form>

      <p className="mt-6 text-[12px] leading-relaxed text-faint">
        不登录也可以试用润色，试用结果不会保存。
      </p>
    </div>
  )
}
