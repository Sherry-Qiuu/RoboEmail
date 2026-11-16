import { useEffect, useState } from 'react'
import { api, type Professor, type User } from './api'
import { openFeedback } from './feedback'
import { AuthPage } from './pages/AuthPage'
import { LearnPage } from './pages/LearnPage'
import { MyPage } from './pages/MyPage'
import { PeoplePage } from './pages/PeoplePage'
import { PolishPage } from './pages/PolishPage'
import { ResetPage } from './pages/ResetPage'
import { SettingsPage } from './pages/SettingsPage'
import { WritePage } from './pages/WritePage'
import { BrandMark } from './components/BrandMark'

type View = 'write' | 'polish' | 'auth' | 'me' | 'learn' | 'people' | 'settings'

function navClass(active: boolean): string {
  return `transition-colors ${active ? 'text-ink' : 'text-muted hover:text-ink'}`
}

export function App() {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [view, setView] = useState<View>('write')
  const [polishSeed, setPolishSeed] = useState('')
  const [writeSeed, setWriteSeed] = useState<Professor | null>(null)
  const [resetToken, setResetToken] = useState(() => {
    if (!window.location.pathname.startsWith('/reset')) return ''
    return new URLSearchParams(window.location.search).get('token') ?? ''
  })

  useEffect(() => {
    api
      .me()
      .then((res) => setUser(res.user))
      .catch(() => undefined)
      .finally(() => setChecking(false))
  }, [])

  // Everything behind the door needs an account, so a visitor without one gets
  // the sign-in screen instead of the app shell.
  const signedIn = Boolean(user)
  const gated = !checking && !signedIn && !resetToken

  return (
    <div className="min-h-screen">
      <header className="border-b border-rule">
        <div className="mx-auto flex h-16 max-w-[820px] items-center justify-between px-6">
          <button
            onClick={() => setView('write')}
            className="flex items-center gap-[11px]"
            aria-label="RoboEmail 首页"
          >
            <BrandMark className="h-[29px] w-[29px] shrink-0" />
            <span className="brand-wordmark text-[19px] leading-none" aria-hidden="true">
              <span className="text-ink">Robo</span>
              <span className="text-accent">Email</span>
            </span>
          </button>

          <nav className="flex items-center gap-6 text-[13px]">
            {signedIn && (
              <>
                <button
                  className={navClass(view === 'write')}
                  onClick={() => {
                    setWriteSeed(null)
                    setView('write')
                  }}
                >
                  写邮件
                </button>
                <button
                  className={navClass(view === 'polish')}
                  onClick={() => {
                    setPolishSeed('')
                    setView('polish')
                  }}
                >
                  润色
                </button>
                <button className={navClass(view === 'people')} onClick={() => setView('people')}>
                  教授
                </button>
                <button className={navClass(view === 'me')} onClick={() => setView('me')}>
                  历史记录
                </button>
                <button className={navClass(view === 'learn')} onClick={() => setView('learn')}>
                  学习
                </button>
                <span className="h-3 w-px bg-rule" />
                <button
                  className={navClass(view === 'settings')}
                  onClick={() => setView('settings')}
                >
                  {user?.username}
                </button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[820px] px-6 py-14">
        {checking ? (
          <p className="text-[13px] text-faint">读取中…</p>
        ) : resetToken ? (
          <ResetPage
            token={resetToken}
            onDone={() => {
              setResetToken('')
              window.history.replaceState({}, '', '/')
              setView('auth')
            }}
          />
        ) : gated ? (
          <AuthPage
            onAuthed={(next) => {
              setUser(next)
              setView('write')
            }}
          />
        ) : (
          <>
        {view === 'polish' && (
          <PolishPage
            key={polishSeed}
            preset={polishSeed}
            onNeedAccount={() => setView('auth')}
          />
        )}
        {view === 'write' && (
          <WritePage
            key={writeSeed?.id ?? 'blank'}
            seed={writeSeed}
            onNeedAccount={() => setView('auth')}
            onPolish={(text) => {
              setPolishSeed(text)
              setView('polish')
            }}
          />
        )}
        {view === 'people' && (
          <PeoplePage
            signedIn={Boolean(user)}
            isUnnc={Boolean(user?.isUnnc)}
            onNeedAccount={() => setView('auth')}
            onEnabled={() => setUser((current) => (current ? { ...current, isUnnc: true } : current))}
            onWriteTo={(professor) => {
              setWriteSeed(professor)
              setView('write')
            }}
          />
        )}
        {view === 'auth' && (
          <AuthPage
            onAuthed={(next) => {
              setUser(next)
              setView('write')
            }}
          />
        )}
        {view === 'me' && <MyPage />}
        {view === 'settings' && user && (
          <SettingsPage
            user={user}
            onLoggedOut={() => {
              setUser(null)
              setView('write')
            }}
          />
        )}
        {view === 'learn' && (
          <LearnPage signedIn={Boolean(user)} onNeedAccount={() => setView('auth')} />
        )}
          </>
        )}
      </main>

      <footer className="mx-auto max-w-[820px] px-6 pb-10">
        <div className="border-t border-rule pt-5 text-center">
          <p className="text-[12px] text-muted">
            Contact Us (Me)：
            <a
              href="mailto:biysq6@nottingham.edu.cn"
              className="transition-colors hover:text-ink"
            >
              biysq6@nottingham.edu.cn
            </a>
            <span className="text-faint">（学校邮箱）</span>
            <span className="mx-2 text-faint">/</span>
            <a href="mailto:19558222390@163.com" className="transition-colors hover:text-ink">
              19558222390@163.com
            </a>
            <span className="text-faint">（个人邮箱）</span>
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <a
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-faint transition-colors hover:text-ink"
            >
              浙ICP备2026097271号
            </a>

            {/* 公安联网备案要求图标在编号左侧，链接到官方查询页。 */}
            <a
              href="https://beian.mps.gov.cn/#/query/webSearch?code=33021202004698"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-faint transition-colors hover:text-ink"
            >
              <img src="/gongan.png" alt="" width={14} height={14} className="h-[14px] w-[14px]" />
              浙公网安备33021202004698号
            </a>

            <button
              className="text-[11px] text-faint transition-colors hover:text-ink"
              onClick={() => openFeedback({ page: 'footer' })}
            >
              反馈
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
