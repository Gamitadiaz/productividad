import { useEffect, useRef, useState } from 'react'
import { DataProvider } from './state/DataContext'
import { PomodoroProvider, usePomodoro } from './state/PomodoroContext'
import { Dashboard } from './views/Dashboard'
import { Tasks } from './views/Tasks'
import { Focus } from './views/Focus'
import { Habits } from './views/Habits'
import { Icon, type IconName } from './components/Icon'
import { exportBackup, importBackup } from './lib/storage'
import { dayKey, formatClock } from './lib/date'
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
  const fileRef = useRef<HTMLInputElement>(null)
  const p = usePomodoro()

  useEffect(() => {
    const onHash = () => setView(readView())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (v: View) => {
    location.hash = `/${v}`
    window.scrollTo({ top: 0 })
  }

  const doExport = () => {
    const blob = new Blob([exportBackup()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `productividad-${dayKey()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const doImport = async (file: File) => {
    try {
      importBackup(await file.text())
      location.reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo importar el archivo')
    }
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
          <button className="nav-item" onClick={doExport}>
            <Icon name="download" size={18} />
            <span>Exportar respaldo</span>
          </button>
          <button className="nav-item" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={18} />
            <span>Importar respaldo</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
          />
        </div>
      </nav>

      <main className="main">
        <div className="mobile-top">
          <span className="brand">
            <img className="brand-mark" src={`${import.meta.env.BASE_URL}icon.svg`} alt="" /> Productividad
          </span>
          <span className="mobile-actions">
            <button className="icon-btn" onClick={doExport} aria-label="Exportar respaldo">
              <Icon name="download" />
            </button>
            <button className="icon-btn" onClick={() => fileRef.current?.click()} aria-label="Importar respaldo">
              <Icon name="upload" />
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
    </div>
  )
}

export default function App() {
  return (
    <DataProvider>
      <PomodoroProvider>
        <Shell />
      </PomodoroProvider>
    </DataProvider>
  )
}
