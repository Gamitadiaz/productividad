import { useState } from 'react'
import type { Priority, Task } from '../types'
import { useData } from '../state/DataContext'
import { relativeDue } from '../lib/date'
import { Icon } from './Icon'

const PRIORITY_LABEL: Record<Priority, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' }

export function TaskItem({ task, onTagClick }: { task: Task; onTagClick?: (tag: string) => void }) {
  const { toggleTask, updateTask, deleteTask } = useData()
  const [open, setOpen] = useState(false)
  const [tagsDraft, setTagsDraft] = useState(task.tags.join(', '))
  const due = task.due ? relativeDue(task.due) : null

  return (
    <li className={`task prio-${task.priority} ${task.done ? 'is-done' : ''} ${open ? 'is-open' : ''}`}>
      <div className="task-row">
        <button
          className="checkbox"
          role="checkbox"
          aria-checked={task.done}
          aria-label={task.done ? 'Marcar como pendiente' : 'Marcar como completada'}
          onClick={() => toggleTask(task.id)}
        >
          {task.done && <Icon name="check" size={14} />}
        </button>

        <button className="task-main" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className="task-title">{task.title}</span>
          <span className="task-meta">
            {due && !task.done && (
              <span className={`chip due-${due.tone}`}>
                <Icon name="calendar" size={12} /> {due.label}
              </span>
            )}
            {task.priority !== 'media' && <span className={`chip prio-chip-${task.priority}`}>{PRIORITY_LABEL[task.priority]}</span>}
            {task.notes && <span className="chip chip-muted">Notas</span>}
          </span>
        </button>

        <span className="task-tags">
          {task.tags.map((t) => (
            <button key={t} className="tag" onClick={() => onTagClick?.(t)}>
              #{t}
            </button>
          ))}
        </span>
      </div>

      {open && (
        <div className="task-editor">
          <label className="field field-wide">
            <span>Título</span>
            <input value={task.title} onChange={(e) => updateTask(task.id, { title: e.target.value })} />
          </label>
          <label className="field">
            <span>Fecha</span>
            <input
              type="date"
              value={task.due ?? ''}
              onChange={(e) => updateTask(task.id, { due: e.target.value || undefined })}
            />
          </label>
          <label className="field">
            <span>Prioridad</span>
            <select value={task.priority} onChange={(e) => updateTask(task.id, { priority: e.target.value as Priority })}>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </label>
          <label className="field">
            <span>Etiquetas</span>
            <input
              value={tagsDraft}
              placeholder="trabajo, casa"
              onChange={(e) => setTagsDraft(e.target.value)}
              onBlur={() =>
                updateTask(task.id, {
                  tags: [...new Set(tagsDraft.split(/[,\s]+/).map((t) => t.replace(/^#/, '').trim().toLowerCase()).filter(Boolean))],
                })
              }
            />
          </label>
          <label className="field field-wide">
            <span>Notas</span>
            <textarea
              rows={3}
              value={task.notes ?? ''}
              onChange={(e) => updateTask(task.id, { notes: e.target.value || undefined })}
            />
          </label>
          <div className="editor-actions">
            <button className="btn btn-danger" onClick={() => deleteTask(task.id)}>
              <Icon name="trash" size={16} /> Eliminar
            </button>
            <button className="btn" onClick={() => setOpen(false)}>
              Listo
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
