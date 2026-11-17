const pad = (n: number) => String(n).padStart(2, '0')

/** Clave de día en hora local: YYYY-MM-DD */
export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d)
  c.setDate(c.getDate() + n)
  return c
}

export function lastNDays(n: number, end: Date = new Date()): Date[] {
  return Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)))
}

export function diffDays(key: string, from: Date = new Date()): number {
  return Math.round((parseDay(key).getTime() - parseDay(dayKey(from)).getTime()) / 86_400_000)
}

/** Racha de días consecutivos. Si hoy aún no se cumple, cuenta desde ayer. */
export function streak(log: string[], today: Date = new Date()): number {
  const set = new Set(log)
  let d = today
  if (!set.has(dayKey(d))) d = addDays(d, -1)
  let s = 0
  while (set.has(dayKey(d))) {
    s++
    d = addDays(d, -1)
  }
  return s
}

export const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
export const WEEKDAYS_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

export type DueTone = 'overdue' | 'today' | 'soon' | 'later'

export function relativeDue(key: string): { label: string; tone: DueTone } {
  const diff = diffDays(key)
  if (diff < 0) return { label: diff === -1 ? 'Ayer' : `Hace ${-diff} días`, tone: 'overdue' }
  if (diff === 0) return { label: 'Hoy', tone: 'today' }
  if (diff === 1) return { label: 'Mañana', tone: 'soon' }
  const d = parseDay(key)
  if (diff < 7) return { label: WEEKDAYS[d.getDay()].replace(/^./, (c) => c.toUpperCase()), tone: 'soon' }
  return { label: d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }), tone: 'later' }
}

export function formatLong(d: Date = new Date()): string {
  const s = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}
