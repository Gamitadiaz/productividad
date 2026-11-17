import { useState, type CSSProperties, type FormEvent } from 'react'
import { useData } from '../state/DataContext'
import { dayKey, lastNDays, streak, WEEKDAYS_SHORT } from '../lib/date'
import { Icon } from '../components/Icon'

const HABIT_COLORS = ['#7c6cff', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899']
const EMOJIS = ['💧', '📚', '🏃', '🧘', '🥗', '💤', '✍️', '🎸', '🧹', '💻']

export function Habits() {
  const { habits, addHabit, toggleHabit, deleteHabit } = useData()
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(EMOJIS[0])
  const [color, setColor] = useState(HABIT_COLORS[0])
  const days = lastNDays(7)
  const month = lastNDays(30).map((d) => dayKey(d))
  const today = dayKey()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    addHabit({ name: name.trim(), emoji, color })
    setName('')
  }

  return (
    <section className="view">
      <header className="view-header">
        <div>
          <h1>Hábitos</h1>
          <p className="muted">
            {habits.filter((h) => h.log.includes(today)).length} de {habits.length} cumplidos hoy
          </p>
        </div>
      </header>

      <form className="card habit-form" onSubmit={submit}>
        <div className="emoji-picker" role="radiogroup" aria-label="Ícono">
          {EMOJIS.map((em) => (
            <button
              type="button"
              key={em}
              role="radio"
              aria-checked={emoji === em}
              className={emoji === em ? 'active' : ''}
              onClick={() => setEmoji(em)}
            >
              {em}
            </button>
          ))}
        </div>
        <div className="habit-form-row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nuevo hábito, ej. Leer 20 min" aria-label="Nombre del hábito" />
          <div className="swatches" role="radiogroup" aria-label="Color">
            {HABIT_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                role="radio"
                aria-checked={color === c}
                aria-label={`Color ${c}`}
                className={color === c ? 'active' : ''}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <button className="btn btn-primary" disabled={!name.trim()}>
            <Icon name="plus" size={16} /> Agregar
          </button>
        </div>
      </form>

      {habits.length === 0 ? (
        <div className="empty">Crea tu primer hábito. Lo pequeño y diario gana 🌱</div>
      ) : (
        <ul className="habit-list">
          {[...habits].sort((a, b) => a.createdAt - b.createdAt).map((h) => {
            const s = streak(h.log)
            const rate = Math.round((month.filter((d) => h.log.includes(d)).length / 30) * 100)
            return (
              <li key={h.id} className="card habit" style={{ '--habit': h.color } as CSSProperties}>
                <div className="habit-head">
                  <span className="habit-emoji">{h.emoji}</span>
                  <div className="habit-info">
                    <strong>{h.name}</strong>
                    <span className="muted small">
                      <Icon name="flame" size={13} /> {s} {s === 1 ? 'día' : 'días'} de racha · {rate}% en 30 días
                    </span>
                  </div>
                  <button
                    className="icon-btn"
                    aria-label={`Eliminar ${h.name}`}
                    onClick={() => confirm(`¿Eliminar "${h.name}" y su historial?`) && deleteHabit(h.id)}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
                <div className="habit-week">
                  {days.map((d) => {
                    const k = dayKey(d)
                    const done = h.log.includes(k)
                    return (
                      <button
                        key={k}
                        className={`day ${done ? 'done' : ''} ${k === today ? 'today' : ''}`}
                        aria-pressed={done}
                        aria-label={`${d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric' })}: ${done ? 'cumplido' : 'sin cumplir'}`}
                        onClick={() => toggleHabit(h.id, k)}
                      >
                        <span className="day-name">{WEEKDAYS_SHORT[d.getDay()]}</span>
                        <span className="day-num">{d.getDate()}</span>
                      </button>
                    )
                  })}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
