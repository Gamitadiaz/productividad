export type Priority = 'alta' | 'media' | 'baja'

export interface Task {
  id: string
  title: string
  notes?: string
  priority: Priority
  /** Fecha límite en formato local YYYY-MM-DD */
  due?: string
  tags: string[]
  done: boolean
  createdAt: number
  completedAt?: number
}

export interface Habit {
  id: string
  name: string
  emoji: string
  color: string
  createdAt: number
  /** Días cumplidos en formato YYYY-MM-DD */
  log: string[]
}

export interface FocusSession {
  id: string
  /** Timestamp de inicio (ms) */
  start: number
  minutes: number
  taskId?: string
}

export type PomodoroMode = 'focus' | 'short' | 'long'

export interface PomodoroSettings {
  focus: number
  short: number
  long: number
  /** Cada cuántos pomodoros toca descanso largo */
  longEvery: number
  autoStart: boolean
  sound: boolean
}

export type View = 'inicio' | 'tareas' | 'enfoque' | 'habitos'
