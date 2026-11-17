import type { PomodoroMode, PomodoroSettings } from '../types'

export const DEFAULT_SETTINGS: PomodoroSettings = {
  focus: 25,
  short: 5,
  long: 15,
  longEvery: 4,
  autoStart: false,
  sound: true,
}

export const MODE_LABEL: Record<PomodoroMode, string> = {
  focus: 'Enfoque',
  short: 'Descanso corto',
  long: 'Descanso largo',
}
