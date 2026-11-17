import { useMemo, useState } from 'react'
import { usePomodoro } from '../state/PomodoroContext'
import { MODE_LABEL } from '../lib/pomodoro'
import { useData } from '../state/DataContext'
import { dayKey, formatClock, formatMinutes } from '../lib/date'
import { compareTasks } from '../lib/quickAdd'
import { Icon } from '../components/Icon'
import type { PomodoroMode, PomodoroSettings } from '../types'

const R = 120
const C = 2 * Math.PI * R

export function Focus() {
  const p = usePomodoro()
  const { tasks, sessions } = useData()
  const [showSettings, setShowSettings] = useState(false)
  const today = dayKey()

  const pending = useMemo(() => tasks.filter((t) => !t.done).sort(compareTasks), [tasks])
  const todaySessions = sessions.filter((s) => dayKey(new Date(s.start)) === today)
  const todayMinutes = todaySessions.reduce((a, s) => a + s.minutes, 0)
  const progress = p.totalMs ? 1 - p.remainingMs / p.totalMs : 0
  const cyclePos = p.completedFocus % p.settings.longEvery

  const setNum = (key: keyof PomodoroSettings, v: number, max: number) =>
    p.setSettings({ ...p.settings, [key]: Math.min(max, Math.max(1, Math.round(v) || 1)) })

  return (
    <section className="view focus-view">
      <header className="view-header">
        <div>
          <h1>Enfoque</h1>
          <p className="muted">
            Hoy: {todaySessions.length} pomodoros · {formatMinutes(todayMinutes)}
          </p>
        </div>
        <button className="icon-btn" aria-label="Ajustes del temporizador" onClick={() => setShowSettings((s) => !s)}>
          <Icon name="settings" />
        </button>
      </header>

      {showSettings && (
        <div className="card settings-grid">
          {(
            [
              ['focus', 'Enfoque (min)', 120],
              ['short', 'Descanso corto', 60],
              ['long', 'Descanso largo', 60],
              ['longEvery', 'Largo cada', 12],
            ] as const
          ).map(([k, label, max]) => (
            <label key={k} className="field">
              <span>{label}</span>
              <input type="number" min={1} max={max} value={p.settings[k]} onChange={(e) => setNum(k, Number(e.target.value), max)} />
            </label>
          ))}
          <label className="toggle">
            <input type="checkbox" checked={p.settings.autoStart} onChange={(e) => p.setSettings({ ...p.settings, autoStart: e.target.checked })} />
            Iniciar siguiente bloque automáticamente
          </label>
          <label className="toggle">
            <input type="checkbox" checked={p.settings.sound} onChange={(e) => p.setSettings({ ...p.settings, sound: e.target.checked })} />
            Sonido al terminar
          </label>
        </div>
      )}

      <div className={`timer-card card mode-${p.mode}`}>
        <div className="segmented" role="tablist">
          {(['focus', 'short', 'long'] as PomodoroMode[]).map((m) => (
            <button key={m} role="tab" aria-selected={p.mode === m} className={p.mode === m ? 'active' : ''} onClick={() => p.setMode(m)}>
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>

        <div className="ring">
          <svg viewBox="0 0 280 280" aria-hidden="true">
            <circle cx="140" cy="140" r={R} className="ring-track" />
            <circle
              cx="140"
              cy="140"
              r={R}
              className="ring-progress"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progress)}
              transform="rotate(-90 140 140)"
            />
          </svg>
          <div className="ring-center">
            <span className="clock" aria-live="polite">{formatClock(p.remainingMs)}</span>
            <span className="muted">{MODE_LABEL[p.mode]}</span>
            <span className="cycle-dots" aria-label={`${cyclePos} de ${p.settings.longEvery} hacia el descanso largo`}>
              {Array.from({ length: p.settings.longEvery }, (_, i) => (
                <i key={i} className={i < cyclePos ? 'on' : ''} />
              ))}
            </span>
          </div>
        </div>

        <div className="timer-controls">
          <button className="icon-btn lg" onClick={p.reset} aria-label="Reiniciar">
            <Icon name="reset" />
          </button>
          <button className="btn btn-primary btn-xl" onClick={p.running ? p.pause : p.start}>
            <Icon name={p.running ? 'pause' : 'play'} /> {p.running ? 'Pausar' : 'Iniciar'}
          </button>
          <button className="icon-btn lg" onClick={p.skip} aria-label="Saltar al siguiente bloque">
            <Icon name="skip" />
          </button>
        </div>

        <label className="field task-link">
          <span>Trabajando en</span>
          <select value={p.taskId ?? ''} onChange={(e) => p.setTaskId(e.target.value || null)}>
            <option value="">— Sin tarea —</option>
            {pending.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {todaySessions.length > 0 && (
        <div className="card">
          <h2 className="card-title">Sesiones de hoy</h2>
          <ul className="session-list">
            {[...todaySessions].reverse().map((s) => (
              <li key={s.id}>
                <span>{new Date(s.start).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="session-task">{tasks.find((t) => t.id === s.taskId)?.title ?? 'Enfoque libre'}</span>
                <span className="muted">{s.minutes} min</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
