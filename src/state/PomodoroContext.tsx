import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { PomodoroMode, PomodoroSettings } from '../types'
import { DEFAULT_SETTINGS, MODE_LABEL } from '../lib/pomodoro'
import { useLocalState } from '../lib/storage'
import { formatClock } from '../lib/date'
import { useData } from './DataContext'

interface TimerState {
  mode: PomodoroMode
  running: boolean
  /** Timestamp en que termina el bloque actual (sólo si running) */
  endsAt: number | null
  /** Milisegundos restantes cuando está en pausa */
  remaining: number
  /** Duración total del bloque actual (ms) */
  total: number
  completedFocus: number
  taskId: string | null
}

interface PomodoroContextValue {
  settings: PomodoroSettings
  setSettings: (s: PomodoroSettings) => void
  mode: PomodoroMode
  running: boolean
  remainingMs: number
  totalMs: number
  completedFocus: number
  taskId: string | null
  setTaskId: (id: string | null) => void
  start: () => void
  pause: () => void
  reset: () => void
  skip: () => void
  setMode: (m: PomodoroMode) => void
}

const PomodoroContext = createContext<PomodoroContextValue | null>(null)

function playChime() {
  try {
    const ctx = new AudioContext()
    ;[660, 880, 990].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.18
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.55)
    })
    setTimeout(() => ctx.close(), 1500)
  } catch {
    /* sin audio */
  }
}

function notify(title: string, body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, icon: '/pwa-192.png' })
  } catch {
    /* algunos navegadores móviles sólo permiten notificaciones vía service worker */
  }
}

export function PomodoroProvider({ children }: { children: ReactNode }) {
  const { addSession } = useData()
  const [settings, setSettings] = useLocalState<PomodoroSettings>('pomodoroSettings', DEFAULT_SETTINGS)
  const duration = useCallback((m: PomodoroMode) => settings[m] * 60_000, [settings])

  const [timer, setTimer] = useLocalState<TimerState>('pomodoroTimer', {
    mode: 'focus',
    running: false,
    endsAt: null,
    remaining: DEFAULT_SETTINGS.focus * 60_000,
    total: DEFAULT_SETTINGS.focus * 60_000,
    completedFocus: 0,
    taskId: null,
  })
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!timer.running) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [timer.running])

  const remainingMs = timer.running && timer.endsAt ? Math.max(0, timer.endsAt - now) : timer.remaining

  /** Avanza al siguiente bloque; si `finished` es true registra la sesión. */
  const advance = useCallback(
    (finished: boolean) => {
      const t = timer
      let completedFocus = t.completedFocus
      if (t.mode === 'focus' && finished) {
        completedFocus++
        addSession({
          start: (t.endsAt ?? Date.now()) - t.total,
          minutes: Math.round(t.total / 60_000),
          taskId: t.taskId ?? undefined,
        })
      }
      const next: PomodoroMode =
        t.mode !== 'focus'
          ? 'focus'
          : finished && completedFocus % settings.longEvery === 0
            ? 'long'
            : 'short'
      const dur = duration(next)
      const autoRun = finished && settings.autoStart
      setTimer({
        ...t,
        mode: next,
        completedFocus,
        running: autoRun,
        endsAt: autoRun ? Date.now() + dur : null,
        remaining: dur,
        total: dur,
      })
    },
    [timer, setTimer, addSession, settings.longEvery, settings.autoStart, duration],
  )

  // Detecta fin de bloque (el ref evita registrar dos veces el mismo bloque)
  const handledEnd = useRef<number | null>(null)
  useEffect(() => {
    if (!timer.running || !timer.endsAt || now < timer.endsAt) return
    if (handledEnd.current === timer.endsAt) return
    handledEnd.current = timer.endsAt
    const wasFocus = timer.mode === 'focus'
    advance(true)
    if (settings.sound) playChime()
    notify(
      wasFocus ? '¡Pomodoro completado!' : 'Descanso terminado',
      wasFocus ? 'Tómate un respiro.' : 'Hora de volver a enfocarte.',
    )
  }, [now, timer.running, timer.endsAt, timer.mode, advance, settings.sound])

  // Si cambian los ajustes y el bloque no ha empezado, actualiza su duración
  useEffect(() => {
    setTimer((t) => {
      const dur = duration(t.mode)
      if (t.running || t.remaining !== t.total || t.total === dur) return t
      return { ...t, remaining: dur, total: dur }
    })
  }, [duration, setTimer])

  // Título de la pestaña con el tiempo restante
  useEffect(() => {
    document.title = timer.running ? `${formatClock(remainingMs)} · ${MODE_LABEL[timer.mode]}` : 'Productividad'
  }, [timer.running, timer.mode, remainingMs])

  const start = useCallback(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    setNow(Date.now())
    setTimer((t) => (t.running ? t : { ...t, running: true, endsAt: Date.now() + t.remaining }))
  }, [setTimer])

  const pause = useCallback(
    () =>
      setTimer((t) =>
        !t.running || !t.endsAt ? t : { ...t, running: false, remaining: Math.max(0, t.endsAt - Date.now()), endsAt: null },
      ),
    [setTimer],
  )

  const reset = useCallback(() => {
    setTimer((t) => {
      const dur = duration(t.mode)
      return { ...t, running: false, endsAt: null, remaining: dur, total: dur }
    })
  }, [setTimer, duration])

  const setMode = useCallback(
    (m: PomodoroMode) => {
      const dur = duration(m)
      setTimer((t) => ({ ...t, mode: m, running: false, endsAt: null, remaining: dur, total: dur }))
    },
    [setTimer, duration],
  )

  const skip = useCallback(() => advance(false), [advance])
  const setTaskId = useCallback((id: string | null) => setTimer((t) => ({ ...t, taskId: id })), [setTimer])

  const value = useMemo<PomodoroContextValue>(
    () => ({
      settings,
      setSettings,
      mode: timer.mode,
      running: timer.running,
      remainingMs,
      totalMs: timer.total,
      completedFocus: timer.completedFocus,
      taskId: timer.taskId,
      setTaskId,
      start,
      pause,
      reset,
      skip,
      setMode,
    }),
    [settings, setSettings, timer, remainingMs, setTaskId, start, pause, reset, skip, setMode],
  )

  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function usePomodoro(): PomodoroContextValue {
  const ctx = useContext(PomodoroContext)
  if (!ctx) throw new Error('usePomodoro debe usarse dentro de <PomodoroProvider>')
  return ctx
}
