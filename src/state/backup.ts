import type { PomodoroSettings } from '../types'
import type { Collections } from './store'
import { store } from './DataContext'

export function exportBackup(): string {
  const { tasks, habits, sessions, settings } = store.getState()
  return JSON.stringify(
    { app: 'productividad', version: 2, exportedAt: new Date().toISOString(), tasks, habits, sessions, pomodoroSettings: settings },
    null,
    2,
  )
}

/** Reemplaza los datos actuales por los del respaldo (y lo sincroniza si hay sesión) */
export function importBackup(json: string): void {
  const data = JSON.parse(json) as Partial<Collections> & { app?: string; pomodoroSettings?: PomodoroSettings }
  if (data.app !== 'productividad') throw new Error('El archivo no es un respaldo de Productividad')
  store.replaceAll({
    tasks: data.tasks ?? [],
    habits: data.habits ?? [],
    sessions: data.sessions ?? [],
    settings: data.pomodoroSettings ?? undefined,
  })
}
