import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import type { FocusSession, Habit, Task } from '../types'
import { uid, useLocalState } from '../lib/storage'

type NewTask = Pick<Task, 'title' | 'priority' | 'tags'> & Partial<Pick<Task, 'due' | 'notes'>>

interface DataContextValue {
  tasks: Task[]
  addTask: (t: NewTask) => void
  updateTask: (id: string, patch: Partial<Task>) => void
  toggleTask: (id: string) => void
  deleteTask: (id: string) => void
  clearCompleted: () => void

  habits: Habit[]
  addHabit: (h: Pick<Habit, 'name' | 'emoji' | 'color'>) => void
  toggleHabit: (id: string, day: string) => void
  deleteHabit: (id: string) => void

  sessions: FocusSession[]
  addSession: (s: Omit<FocusSession, 'id'>) => void
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useLocalState<Task[]>('tasks', [])
  const [habits, setHabits] = useLocalState<Habit[]>('habits', [])
  const [sessions, setSessions] = useLocalState<FocusSession[]>('sessions', [])

  const addTask = useCallback(
    (t: NewTask) =>
      setTasks((prev) => [{ id: uid(), done: false, createdAt: Date.now(), ...t }, ...prev]),
    [setTasks],
  )
  const updateTask = useCallback(
    (id: string, patch: Partial<Task>) =>
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))),
    [setTasks],
  )
  const toggleTask = useCallback(
    (id: string) =>
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, done: !t.done, completedAt: t.done ? undefined : Date.now() } : t,
        ),
      ),
    [setTasks],
  )
  const deleteTask = useCallback((id: string) => setTasks((prev) => prev.filter((t) => t.id !== id)), [setTasks])
  const clearCompleted = useCallback(() => setTasks((prev) => prev.filter((t) => !t.done)), [setTasks])

  const addHabit = useCallback(
    (h: Pick<Habit, 'name' | 'emoji' | 'color'>) =>
      setHabits((prev) => [...prev, { id: uid(), createdAt: Date.now(), log: [], ...h }]),
    [setHabits],
  )
  const toggleHabit = useCallback(
    (id: string, day: string) =>
      setHabits((prev) =>
        prev.map((h) =>
          h.id !== id ? h : { ...h, log: h.log.includes(day) ? h.log.filter((d) => d !== day) : [...h.log, day] },
        ),
      ),
    [setHabits],
  )
  const deleteHabit = useCallback((id: string) => setHabits((prev) => prev.filter((h) => h.id !== id)), [setHabits])

  const addSession = useCallback(
    (s: Omit<FocusSession, 'id'>) => setSessions((prev) => [...prev, { id: uid(), ...s }]),
    [setSessions],
  )

  const value = useMemo(
    () => ({
      tasks, addTask, updateTask, toggleTask, deleteTask, clearCompleted,
      habits, addHabit, toggleHabit, deleteHabit,
      sessions, addSession,
    }),
    [tasks, addTask, updateTask, toggleTask, deleteTask, clearCompleted, habits, addHabit, toggleHabit, deleteHabit, sessions, addSession],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

// Hook junto a su Provider: patrón estándar de contexto
// oxlint-disable-next-line react/only-export-components
export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData debe usarse dentro de <DataProvider>')
  return ctx
}
