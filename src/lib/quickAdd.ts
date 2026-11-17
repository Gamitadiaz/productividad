import type { Priority } from '../types'
import { addDays, dayKey } from './date'

const DAY_ALIASES: Record<string, number> = {
  dom: 0, domingo: 0,
  lun: 1, lunes: 1,
  mar: 2, martes: 2,
  mie: 3, mié: 3, miercoles: 3, miércoles: 3,
  jue: 4, jueves: 4,
  vie: 5, viernes: 5,
  sab: 6, sáb: 6, sabado: 6, sábado: 6,
}

export interface ParsedTask {
  title: string
  priority: Priority
  due?: string
  tags: string[]
}

/**
 * Sintaxis rápida:
 *   #etiqueta        → agrega etiqueta
 *   !1 / !alta       → prioridad alta (!2 media, !3 baja)
 *   @hoy @mañana     → fecha
 *   @lun … @dom      → próximo día de la semana
 *   @2026-12-24      → fecha exacta
 */
export function parseQuickAdd(raw: string, defaultDue?: string): ParsedTask {
  let priority: Priority = 'media'
  let due = defaultDue
  const tags: string[] = []
  const rest: string[] = []

  for (const w of raw.trim().split(/\s+/).filter(Boolean)) {
    const lw = w.toLowerCase()
    if (/^#[\p{L}\p{N}_-]+$/u.test(w)) {
      const t = lw.slice(1)
      if (!tags.includes(t)) tags.push(t)
    } else if (lw === '!1' || lw === '!alta') priority = 'alta'
    else if (lw === '!2' || lw === '!media') priority = 'media'
    else if (lw === '!3' || lw === '!baja') priority = 'baja'
    else if (lw === '@hoy') due = dayKey()
    else if (lw === '@mañana' || lw === '@manana') due = dayKey(addDays(new Date(), 1))
    else if (/^@\d{4}-\d{2}-\d{2}$/.test(lw)) due = lw.slice(1)
    else if (lw.startsWith('@') && lw.slice(1) in DAY_ALIASES) {
      const target = DAY_ALIASES[lw.slice(1)]
      const now = new Date()
      const delta = (target - now.getDay() + 7) % 7 || 7
      due = dayKey(addDays(now, delta))
    } else rest.push(w)
  }

  return { title: rest.join(' '), priority, due, tags }
}

const PRIORITY_RANK: Record<Priority, number> = { alta: 0, media: 1, baja: 2 }

/** Orden: fecha (sin fecha al final) → prioridad → antigüedad */
export function compareTasks(
  a: { due?: string; priority: Priority; createdAt: number },
  b: { due?: string; priority: Priority; createdAt: number },
): number {
  if (a.due !== b.due) {
    if (!a.due) return 1
    if (!b.due) return -1
    return a.due < b.due ? -1 : 1
  }
  if (a.priority !== b.priority) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  return a.createdAt - b.createdAt
}
