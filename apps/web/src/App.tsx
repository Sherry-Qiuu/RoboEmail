import { useEffect, useState } from 'react'
import { api, type Professor, type User } from './api'
import { AuthPage } from './pages/AuthPage'
import { HomePage } from './pages/HomePage'
import { LearnPage } from './pages/LearnPage'
import { MyPage } from './pages/MyPage'
import { PeoplePage } from './pages/PeoplePage'
import { PolishPage } from './pages/PolishPage'
import { ResetPage } from './pages/ResetPage'
import { WritePage } from './pages/WritePage'

type View = 'home' | 'write' | 'polish' | 'auth' | 'me' | 'learn' | 'people'

function navClass(active: boolean): string {
  return `transition-colors ${active ? 'text-ink' : 'text-muted hover:text-ink'}`
}

export function App() {
  const [user, setUser] = useState<User | null>(null)
  const [view, setView] = useState<View>('home')
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
  }, [])

  async function logout() {
    await api.logout().catch(() => undefined)
    setUser(null)
    setView('home')
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-rule">
        <div className="mx-auto flex h-16 max-w-[820px] items-center justify-between px-6">
          <button
            onClick={() => setView('home')}
            className="font-display text-[19px] tracking-tight"
          >
            RoboEmail
          </button>

          <nav className="flex items-center gap-6 text-[13px]">
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
              我的
            </button>
            <button className={navClass(view === 'learn')} onClick={() => setView('learn')}>
              学习
            </button>
            <span className="h-3 w-px bg-rule" />
            {user ? (
              <button className="text-muted transition-colors hover:text-ink" onClick={logout}>
                {user.username}
              </button>
            ) : (
              <button className={navClass(view === 'auth')} onClick={() => setView('auth')}>
                登录
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[820px] px-6 py-14">
        {resetToken ? (
          <ResetPage
            token={resetToken}
            onDone={() => {
              setResetToken('')
              window.history.replaceState({}, '', '/')
              setView('auth')
            }}
          />
        ) : (
          <>
        {view === 'home' && (
          <HomePage onWrite={() => setView('write')} onPolish={() => setView('polish')} />
        )}
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
              setView('home')
            }}
          />
        )}
        {view === 'me' && <MyPage signedIn={Boolean(user)} />}
        {view === 'learn' && (
          <LearnPage signedIn={Boolean(user)} onNeedAccount={() => setView('auth')} />
        )}
          </>
        )}
      </main>
    </div>
  )
}
