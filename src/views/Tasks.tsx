import { useMemo, useState } from 'react'
import { useData } from '../state/DataContext'
import { dayKey } from '../lib/date'
import { compareTasks } from '../lib/quickAdd'
import { QuickAdd } from '../components/QuickAdd'
import { TaskItem } from '../components/TaskItem'
import { Icon } from '../components/Icon'
import type { Task } from '../types'

type Filter = 'hoy' | 'proximas' | 'sinfecha' | 'todas' | 'completadas'

const FILTERS: { id: Filter; label: string; test: (t: Task, today: string) => boolean }[] = [
  { id: 'hoy', label: 'Hoy', test: (t, today) => !t.done && !!t.due && t.due <= today },
  { id: 'proximas', label: 'Próximas', test: (t, today) => !t.done && !!t.due && t.due > today },
  { id: 'sinfecha', label: 'Sin fecha', test: (t) => !t.done && !t.due },
  { id: 'todas', label: 'Pendientes', test: (t) => !t.done },
  { id: 'completadas', label: 'Completadas', test: (t) => t.done },
]

export function Tasks() {
  const { tasks, clearCompleted } = useData()
  const [filter, setFilter] = useState<Filter>('todas')
  const [tag, setTag] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const today = dayKey()

  const allTags = useMemo(() => [...new Set(tasks.flatMap((t) => t.tags))].sort(), [tasks])

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter)!
    const q = query.trim().toLowerCase()
    const list = tasks.filter(
      (t) =>
        f.test(t, today) &&
        (!tag || t.tags.includes(tag)) &&
        (!q || t.title.toLowerCase().includes(q) || t.notes?.toLowerCase().includes(q)),
    )
    return filter === 'completadas'
      ? list.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
      : list.sort(compareTasks)
  }, [tasks, filter, tag, query, today])

  return (
    <section className="view">
      <header className="view-header">
        <div>
          <h1>Tareas</h1>
          <p className="muted">{tasks.filter((t) => !t.done).length} pendientes</p>
        </div>
      </header>

      <QuickAdd autoFocus />

      <div className="toolbar">
        <div className="segmented" role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              className={filter === f.id ? 'active' : ''}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              <span className="count">{tasks.filter((t) => f.test(t, today)).length}</span>
            </button>
          ))}
        </div>
        <label className="search">
          <Icon name="search" size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar" aria-label="Buscar tareas" />
        </label>
      </div>

      {allTags.length > 0 && (
        <div className="tag-filter">
          {allTags.map((t) => (
            <button key={t} className={`tag ${tag === t ? 'active' : ''}`} onClick={() => setTag(tag === t ? null : t)}>
              #{t}
            </button>
          ))}
          {tag && (
            <button className="link" onClick={() => setTag(null)}>
              Quitar filtro
            </button>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="empty">
          {filter === 'completadas' ? 'Aún no completas tareas.' : 'Nada por aquí. Agrega una tarea arriba ✨'}
        </div>
      ) : (
        <ul className="task-list">
          {visible.map((t) => (
            <TaskItem key={t.id} task={t} onTagClick={setTag} />
          ))}
        </ul>
      )}

      {filter === 'completadas' && visible.length > 0 && (
        <button className="btn btn-ghost" onClick={() => confirm('¿Eliminar todas las completadas?') && clearCompleted()}>
          <Icon name="trash" size={16} /> Limpiar completadas
        </button>
      )}

      <details className="hint">
        <summary>Atajos al escribir</summary>
        <ul>
          <li><code>#trabajo</code> agrega una etiqueta</li>
          <li><code>!1</code> / <code>!alta</code>, <code>!2</code>, <code>!3</code> fijan prioridad</li>
          <li><code>@hoy</code>, <code>@mañana</code>, <code>@vie</code>, <code>@2026-12-24</code> fijan fecha</li>
        </ul>
      </details>
    </section>
  )
}
