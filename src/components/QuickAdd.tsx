import { useState, type FormEvent } from 'react'
import { useData } from '../state/DataContext'
import { parseQuickAdd } from '../lib/quickAdd'
import { Icon } from './Icon'

export function QuickAdd({ defaultDue, autoFocus }: { defaultDue?: string; autoFocus?: boolean }) {
  const { addTask } = useData()
  const [text, setText] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const parsed = parseQuickAdd(text, defaultDue)
    if (!parsed.title) return
    addTask(parsed)
    setText('')
  }

  return (
    <form className="quick-add" onSubmit={submit}>
      <Icon name="plus" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Nueva tarea…  #etiqueta  !1  @mañana"
        aria-label="Nueva tarea"
        autoFocus={autoFocus}
      />
      <button type="submit" className="btn btn-primary" disabled={!text.trim()}>
        Agregar
      </button>
    </form>
  )
}
