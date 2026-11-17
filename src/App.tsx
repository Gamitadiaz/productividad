import { useEffect, useState } from 'react'
import { PomodoroProvider, usePomodoro } from './state/PomodoroContext'
import { Dashboard } from './views/Dashboard'
import { Tasks } from './views/Tasks'
import { Focus } from './views/Focus'
import { Habits } from './views/Habits'
import { Icon, type IconName } from './components/Icon'
import { formatClock } from './lib/date'
import { SyncProvider, useSync } from './sync/SyncContext'
import { AccountDialog, SyncDot } from './components/AccountDialog'
import { syncLabel } from './sync/label'
import type { View } from './types'

const NAV: { id: View; label: string; icon: IconName }[] = [
  { id: 'inicio', label: 'Inicio', icon: 'home' },
  { id: 'tareas', label: 'Tareas', icon: 'list' },
  { id: 'enfoque', label: 'Enfoque', icon: 'timer' },
  { id: 'habitos', label: 'Hábitos', icon: 'flame' },
]

function readView(): View {
  const v = location.hash.replace(/^#\/?/, '') as View
  return NAV.some((n) => n.id === v) ? v : 'inicio'
}

type Theme = 'dark' | 'light'

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('prod:theme') as Theme | null
    return saved ?? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('prod:theme', theme)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0f1115' : '#f6f5f2')
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))] as const
}

function Shell() {
  const [view, setView] = useState<View>(readView)
  const [theme, toggleTheme] = useTheme()
  const p = usePomodoro()
  const sync = useSync()
  const [accountOpen, setAccountOpen] = useState(false)
  const label = syncLabel(sync.info, !!sync.user)


  useEffect(() => {
    const onHash = () => setView(readView())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (v: View) => {
    location.hash = `/${v}`
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="app">
      <nav className="nav" aria-label="Principal">
        <div className="brand">
          <img className="brand-mark" src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />
          <span className="brand-name">Productividad</span>
        </div>
        {NAV.map((n) => (
          <a
            key={n.id}
            href={`#/${n.id}`}
            className={`nav-item ${view === n.id ? 'active' : ''}`}
            aria-current={view === n.id ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault()
              go(n.id)
            }}
          >
            <Icon name={n.icon} size={20} />
            <span>{n.label}</span>
            {n.id === 'enfoque' && p.running && <span className="nav-badge">{formatClock(p.remainingMs)}</span>}
          </a>
        ))}
        <div className="nav-footer">
          <button className="nav-item" onClick={toggleTheme}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
            <span>Tema {theme === 'dark' ? 'claro' : 'oscuro'}</span>
          </button>
          <button className="nav-item account-btn" onClick={() => setAccountOpen(true)}>
            <Icon name="cloud" size={18} />
            <span className="account-btn-text">
              <span>{sync.user ? 'Cuenta' : 'Sincronizar'}</span>
              <span className="muted small">
                <SyncDot tone={label.tone} /> {label.text}
              </span>
            </span>
          </button>
        </div>
      </nav>

      <main className="main">
        <div className="mobile-top">
          <span className="brand">
            <img className="brand-mark" src={`${import.meta.env.BASE_URL}icon.svg`} alt="" /> Productividad
          </span>
          <span className="mobile-actions">
            <button className="icon-btn sync-btn" onClick={() => setAccountOpen(true)} aria-label={`Cuenta: ${label.text}`}>
              <Icon name="cloud" />
              <SyncDot tone={label.tone} />
            </button>
            <button className="icon-btn" onClick={toggleTheme} aria-label="Cambiar tema">
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
          </span>
        </div>
        {view === 'inicio' && <Dashboard go={go} />}
        {view === 'tareas' && <Tasks />}
        {view === 'enfoque' && <Focus />}
        {view === 'habitos' && <Habits />}
      </main>
      {/* Al volver del enlace de "olvidé mi contraseña" se abre solo para fijar una nueva */}
      <AccountDialog open={accountOpen || sync.recovering} onClose={() => setAccountOpen(false)} />
    </div>
  )
}

export default function App() {
  return (
    <SyncProvider>
      <PomodoroProvider>
        <Shell />
      </PomodoroProvider>
    </SyncProvider>
  )
}
