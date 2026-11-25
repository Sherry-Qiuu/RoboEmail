import { useEffect, useRef, useState } from 'react'
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
  const [polishSource, setPolishSource] = useState('')
  const [writeSeed, setWriteSeed] = useState<Professor | null>(null)
  const headerRef = useRef<HTMLElement>(null)
  const [resetToken, setResetToken] = useState(() => {
    if (!window.location.pathname.startsWith('/reset')) return ''
    return new URLSearchParams(window.location.search).get('token') ?? ''
  })

  /**
   * The bar is fixed and grows on narrow screens (brand above the links), so the
   * page offset is measured rather than assumed to be 64 px.
   */


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
  // The history view manages its own scroll regions, so the page itself must not
  // scroll on a desktop-sized window.
  const locked = view === 'me' && signedIn && !checking

  // The bar is fixed and grows on narrow screens (brand above the links), so the
  // page offset is measured instead of assumed to be 64 px.
  useEffect(() => {
    const header = headerRef.current
    if (!header) return
    function measure() {
      const height = header!.getBoundingClientRect().height
      document.documentElement.style.setProperty('--header-h', `${Math.round(height)}px`)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(header)
    return () => observer.disconnect()
  }, [signedIn])

  return (
    <div className={`app-shell min-h-screen ${locked ? 'app-shell--locked' : ''}`}>
      <header className="app-header" ref={headerRef}>
        <div className="app-bar mx-auto max-w-[820px] px-6">
          <div className="app-bar-top">
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

            {signedIn && (
              <button
                className={`app-bar-user ${navClass(view === 'settings')}`}
                onClick={() => setView('settings')}
              >
                {user?.username}
              </button>
            )}
          </div>

          <nav className="app-bar-nav">
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
                    setPolishSource('')
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
                <span className="app-bar-divider" />
                <button
                  className={`app-bar-user-nav ${navClass(view === 'settings')}`}
                  onClick={() => setView('settings')}
                >
                  {user?.username}
                </button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className={`mx-auto max-w-[820px] px-6 ${locked ? 'history-main' : 'py-14'}`}>
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
            key={polishSource || polishSeed}
            preset={polishSeed}
            sourceId={polishSource || undefined}
            onNeedAccount={() => setView('auth')}
          />
        )}
        {view === 'write' && (
          <WritePage
            key={writeSeed?.id ?? 'blank'}
            seed={writeSeed}
            onNeedAccount={() => setView('auth')}
            onPolish={(text, sourceId) => {
              setPolishSeed(text)
              setPolishSource(sourceId ?? '')
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

      <footer className="app-footer mx-auto max-w-[1060px] px-6">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-rule py-3 text-[11px] text-faint">
          <span>
            Contact Us (Me)：
            <a
              href="mailto:biysq6@nottingham.edu.cn"
              className="text-muted transition-colors hover:text-ink"
            >
              biysq6@nottingham.edu.cn
            </a>
            <span className="mx-1">/</span>
            <a
              href="mailto:19558222390@163.com"
              className="text-muted transition-colors hover:text-ink"
            >
              19558222390@163.com
            </a>
          </span>

          <span className="text-rule">|</span>

          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-ink"
          >
            浙ICP备2026097271号
          </a>

          {/* 公安联网备案要求图标在编号左侧，链接到官方查询页。 */}
          <a
            href="https://beian.mps.gov.cn/#/query/webSearch?code=33021202004698"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 transition-colors hover:text-ink"
          >
            <img src="/gongan.png" alt="" width={13} height={13} className="h-[13px] w-[13px]" />
            浙公网安备33021202004698号
          </a>

          <button
            className="transition-colors hover:text-ink"
            onClick={() => openFeedback({ page: 'footer' })}
          >
            反馈
          </button>
        </div>
      </footer>
    </div>
  )
}
