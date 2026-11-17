import { useSyncExternalStore } from 'react'
import type { FocusSession, Habit, PomodoroSettings, Task } from '../types'
import { uid } from '../lib/storage'
import { PREFIX, Store } from './store'

/** Instancia única del store, persistida en localStorage */
export const store = new Store(window.localStorage)

// Si otra pestaña modifica los datos, recargamos
window.addEventListener('storage', (e) => {
  if (!e.key?.startsWith(PREFIX)) return
  const k = e.key.slice(PREFIX.length)
  if (k === 'pomodoroTimer' || k.startsWith('syncCursor:')) return
  store.reload()
})

type NewTask = Pick<Task, 'title' | 'priority' | 'tags'> & Partial<Pick<Task, 'due' | 'notes'>>

const actions = {
  addTask: (t: NewTask) => store.put('tasks', { id: uid(), done: false, createdAt: Date.now(), ...t }),
  updateTask: (id: string, patch: Partial<Task>) => store.patch('tasks', id, patch),
  toggleTask: (id: string) => {
    const t = store.getState().tasks.find((x) => x.id === id)
    if (t) store.patch('tasks', id, { done: !t.done, completedAt: t.done ? undefined : Date.now() })
  },
  deleteTask: (id: string) => store.remove('tasks', id),
  clearCompleted: () =>
    store.removeMany(
      'tasks',
      store.getState().tasks.filter((t) => t.done).map((t) => t.id),
    ),

  addHabit: (h: Pick<Habit, 'name' | 'emoji' | 'color'>) =>
    store.put('habits', { id: uid(), createdAt: Date.now(), log: [], ...h }),
  toggleHabit: (id: string, day: string) => {
    const h = store.getState().habits.find((x) => x.id === id)
    if (h) store.patch('habits', id, { log: h.log.includes(day) ? h.log.filter((d) => d !== day) : [...h.log, day] })
  },
  deleteHabit: (id: string) => store.remove('habits', id),

  addSession: (s: Omit<FocusSession, 'id'>) => store.put('sessions', { id: uid(), ...s }),
  setSettings: (s: PomodoroSettings) => store.setSettings(s),
}

// oxlint-disable-next-line react/only-export-components
export function useData() {
  const state = useSyncExternalStore(store.subscribe, store.getState)
  return { ...state, ...actions }
}

export const dataActions = actions
