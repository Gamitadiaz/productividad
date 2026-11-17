import { useMemo, type CSSProperties } from 'react'
import { useData } from '../state/DataContext'
import { usePomodoro } from '../state/PomodoroContext'
import { MODE_LABEL } from '../lib/pomodoro'
import { dayKey, formatClock, formatLong, formatMinutes, lastNDays, streak, WEEKDAYS_SHORT } from '../lib/date'
import { compareTasks } from '../lib/quickAdd'
import { QuickAdd } from '../components/QuickAdd'
import { TaskItem } from '../components/TaskItem'
import { Icon } from '../components/Icon'
import type { View } from '../types'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export function Dashboard({ go }: { go: (v: View) => void }) {
  const { tasks, habits, sessions, toggleHabit } = useData()
  const p = usePomodoro()
  const today = dayKey()

  const todayTasks = useMemo(
    () => tasks.filter((t) => !t.done && t.due && t.due <= today).sort(compareTasks),
    [tasks, today],
  )
  const doneToday = tasks.filter((t) => t.completedAt && dayKey(new Date(t.completedAt)) === today).length
  const habitsDone = habits.filter((h) => h.log.includes(today)).length

  const week = useMemo(
    () =>
      lastNDays(7).map((d) => {
        const k = dayKey(d)
        return { d, k, min: sessions.filter((s) => dayKey(new Date(s.start)) === k).reduce((a, s) => a + s.minutes, 0) }
      }),
    [sessions],
  )
  const maxMin = Math.max(25, ...week.map((w) => w.min))
  const focusToday = week[week.length - 1].min
  const weekTotal = week.reduce((a, w) => a + w.min, 0)

  return (
    <section className="view">
      <header className="view-header">
        <div>
          <p className="eyebrow">{formatLong()}</p>
          <h1>{greeting()} 👋</h1>
        </div>
      </header>

      <div className="stats">
        <button className="stat card" onClick={() => go('tareas')}>
          <span className="stat-label">Para hoy</span>
          <span className="stat-value">{todayTasks.length}</span>
          <span className="stat-sub">{doneToday} completadas hoy</span>
        </button>
        <button className="stat card" onClick={() => go('enfoque')}>
          <span className="stat-label">Enfoque hoy</span>
          <span className="stat-value">{formatMinutes(focusToday)}</span>
          <span className="stat-sub">{formatMinutes(weekTotal)} esta semana</span>
        </button>
        <button className="stat card" onClick={() => go('habitos')}>
          <span className="stat-label">Hábitos</span>
          <span className="stat-value">
            {habitsDone}/{habits.length}
          </span>
          <span className="stat-sub">cumplidos hoy</span>
        </button>
      </div>

      <div className="dash-grid">
        <div className="card">
          <h2 className="card-title">Para hoy</h2>
          <QuickAdd defaultDue={today} />
          {todayTasks.length === 0 ? (
            <div className="empty small">Sin pendientes para hoy. ¡Bien! 🎉</div>
          ) : (
            <ul className="task-list">
              {todayTasks.slice(0, 8).map((t) => (
                <TaskItem key={t.id} task={t} />
              ))}
            </ul>
          )}
          {todayTasks.length > 8 && (
            <button className="link" onClick={() => go('tareas')}>
              Ver las {todayTasks.length} tareas →
            </button>
          )}
        </div>

        <div className="dash-side">
          <div className={`card mini-timer mode-${p.mode}`}>
            <div>
              <span className="stat-label">{MODE_LABEL[p.mode]}</span>
              <span className="mini-clock">{formatClock(p.remainingMs)}</span>
            </div>
            <button className="btn btn-primary" onClick={p.running ? p.pause : p.start} aria-label={p.running ? 'Pausar' : 'Iniciar'}>
              <Icon name={p.running ? 'pause' : 'play'} size={16} />
            </button>
          </div>

          <div className="card">
            <h2 className="card-title">Hábitos de hoy</h2>
            {habits.length === 0 ? (
              <button className="link" onClick={() => go('habitos')}>
                Crear un hábito →
              </button>
            ) : (
              <ul className="habit-today">
                {habits.map((h) => {
                  const done = h.log.includes(today)
                  return (
                    <li key={h.id}>
                      <button
                        className={`habit-pill ${done ? 'done' : ''}`}
                        style={{ '--habit': h.color } as CSSProperties}
                        aria-pressed={done}
                        onClick={() => toggleHabit(h.id, today)}
                      >
                        <span>{h.emoji}</span>
                        <span className="habit-pill-name">{h.name}</span>
                        <span className="muted small">
                          <Icon name="flame" size={12} /> {streak(h.log)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="card">
            <h2 className="card-title">Enfoque · 7 días</h2>
            <div className="bars" role="img" aria-label="Minutos de enfoque de los últimos 7 días">
              {week.map((w) => (
                <div key={w.k} className={`bar ${w.k === today ? 'today' : ''}`} title={`${w.min} min`}>
                  <span className="bar-val">{w.min || ''}</span>
                  <div className="bar-fill" style={{ height: `${(w.min / maxMin) * 100}%` }} />
                  <span className="bar-label">{WEEKDAYS_SHORT[w.d.getDay()]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
