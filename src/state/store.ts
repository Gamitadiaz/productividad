import type { FocusSession, Habit, PomodoroSettings, Task } from '../types'
import { DEFAULT_SETTINGS } from '../lib/pomodoro'

/**
 * Store local (offline‑first) con cola de cambios pendientes de sincronizar.
 *
 * - Toda mutación sella el elemento con `updatedAt` y deja una entrada en el outbox.
 * - El motor de sincronización sube el outbox y aplica cambios remotos con
 *   "gana la última edición" por elemento (no por colección completa).
 * - Los borrados viajan como tombstones (`data: null`).
 */

export type CollectionName = 'tasks' | 'habits' | 'sessions'
export type SyncCollection = CollectionName | 'settings'
export const COLLECTIONS: CollectionName[] = ['tasks', 'habits', 'sessions']
export const SETTINGS_ID = 'pomodoro'

export interface Collections {
  tasks: Task[]
  habits: Habit[]
  sessions: FocusSession[]
}

export interface StoreState extends Collections {
  settings: PomodoroSettings
  settingsUpdatedAt: number
}

/** Cambio local pendiente de subir */
export interface Change {
  collection: SyncCollection
  id: string
  data: unknown | null
  updatedAt: number
}

/** Fila tal como llega del servidor */
export interface RemoteRow {
  collection: SyncCollection
  id: string
  data: unknown | null
  deleted: boolean
  updatedAt: number
  /** Marca de tiempo del servidor (ms), usada como cursor de descarga */
  serverUpdatedAt: number
}

export interface KV {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const PREFIX = 'prod:v1:'
const SETTINGS_KEY = 'pomodoroSettings'
const SETTINGS_TS_KEY = 'pomodoroSettingsUpdatedAt'
const OUTBOX_KEY = 'outbox'

type Item = Collections[CollectionName][number]

/** Sello de tiempo de un elemento (compatibilidad con datos previos sin updatedAt) */
export function stampOf(item: Item): number {
  if (item.updatedAt) return item.updatedAt
  if ('createdAt' in item) return item.createdAt
  if ('start' in item) return item.start
  return 0
}

const changeKey = (collection: string, id: string) => `${collection}:${id}`

/** Garantiza que el reloj local nunca repita ni retroceda entre ediciones seguidas */
let lastNow = 0
function now(): number {
  lastNow = Math.max(Date.now(), lastNow + 1)
  return lastNow
}

export class Store {
  private state: StoreState
  private outbox: Record<string, Change>
  private listeners = new Set<() => void>()
  private readonly kv: KV

  constructor(kv: KV) {
    this.kv = kv
    this.state = this.load()
    this.outbox = this.read(OUTBOX_KEY, {})
  }

  // ---------- infraestructura ----------

  private read<T>(key: string, fallback: T): T {
    try {
      const raw = this.kv.getItem(PREFIX + key)
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  }

  private write(key: string, value: unknown) {
    try {
      this.kv.setItem(PREFIX + key, JSON.stringify(value))
    } catch {
      /* almacenamiento lleno o bloqueado */
    }
  }

  private load(): StoreState {
    return {
      tasks: this.read('tasks', []),
      habits: this.read('habits', []),
      sessions: this.read('sessions', []),
      settings: { ...DEFAULT_SETTINGS, ...this.read<Partial<PomodoroSettings>>(SETTINGS_KEY, {}) },
      settingsUpdatedAt: this.read(SETTINGS_TS_KEY, 0),
    }
  }

  /** Vuelve a leer del almacenamiento (p. ej. cuando otra pestaña escribió) */
  reload() {
    this.state = this.load()
    this.outbox = this.read(OUTBOX_KEY, {})
    this.emit()
  }

  getState = (): StoreState => this.state

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private emit() {
    for (const fn of this.listeners) fn()
  }

  private commit(next: Partial<StoreState>, changes: Change[] = []) {
    this.state = { ...this.state, ...next }
    for (const name of COLLECTIONS) if (name in next) this.write(name, this.state[name])
    if ('settings' in next) {
      this.write(SETTINGS_KEY, this.state.settings)
      this.write(SETTINGS_TS_KEY, this.state.settingsUpdatedAt)
    }
    if (changes.length) {
      for (const c of changes) this.outbox[changeKey(c.collection, c.id)] = c
      this.write(OUTBOX_KEY, this.outbox)
    }
    this.emit()
  }

  // ---------- mutaciones locales ----------

  put<N extends CollectionName>(name: N, item: Collections[N][number]) {
    const stamped = { ...item, updatedAt: now() }
    const list = this.state[name] as Item[]
    const idx = list.findIndex((x) => x.id === item.id)
    const next = idx >= 0 ? list.map((x, i) => (i === idx ? stamped : x)) : [...list, stamped]
    this.commit({ [name]: next } as Partial<StoreState>, [
      { collection: name, id: item.id, data: stamped, updatedAt: stamped.updatedAt },
    ])
  }

  patch<N extends CollectionName>(name: N, id: string, patch: Partial<Collections[N][number]>) {
    const current = (this.state[name] as Item[]).find((x) => x.id === id)
    if (current) this.put(name, { ...current, ...patch } as Collections[N][number])
  }

  remove(name: CollectionName, id: string) {
    this.removeMany(name, [id])
  }

  removeMany(name: CollectionName, ids: string[]) {
    if (!ids.length) return
    const set = new Set(ids)
    const ts = now()
    this.commit(
      { [name]: (this.state[name] as Item[]).filter((x) => !set.has(x.id)) } as Partial<StoreState>,
      ids.map((id) => ({ collection: name, id, data: null, updatedAt: ts })),
    )
  }

  setSettings(settings: PomodoroSettings) {
    const ts = now()
    this.commit({ settings, settingsUpdatedAt: ts }, [
      { collection: 'settings', id: SETTINGS_ID, data: settings, updatedAt: ts },
    ])
  }

  /** Reemplaza todos los datos (importar respaldo). Lo que no venga se borra. */
  replaceAll(data: Partial<Collections> & { settings?: PomodoroSettings }) {
    const ts = now()
    const next: Partial<StoreState> = {}
    const changes: Change[] = []
    for (const name of COLLECTIONS) {
      const incoming = (data[name] ?? []) as Item[]
      const ids = new Set(incoming.map((x) => x.id))
      const stamped = incoming.map((x) => ({ ...x, updatedAt: ts }))
      ;(next as Record<string, unknown>)[name] = stamped
      for (const x of stamped) changes.push({ collection: name, id: x.id, data: x, updatedAt: ts })
      for (const old of this.state[name] as Item[])
        if (!ids.has(old.id)) changes.push({ collection: name, id: old.id, data: null, updatedAt: ts })
    }
    if (data.settings) {
      next.settings = { ...DEFAULT_SETTINGS, ...data.settings }
      next.settingsUpdatedAt = ts
      changes.push({ collection: 'settings', id: SETTINGS_ID, data: next.settings, updatedAt: ts })
    }
    this.commit(next, changes)
  }

  /** Borra los datos de este dispositivo sin propagar borrados (al cerrar sesión) */
  clearLocal() {
    this.outbox = {}
    this.write(OUTBOX_KEY, this.outbox)
    this.commit({ tasks: [], habits: [], sessions: [], settings: DEFAULT_SETTINGS, settingsUpdatedAt: 0 })
  }

  // ---------- sincronización ----------

  pendingChanges(): Change[] {
    return Object.values(this.outbox)
  }

  hasPending(): boolean {
    return Object.keys(this.outbox).length > 0
  }

  /** Quita del outbox los cambios ya subidos (si no se volvieron a editar mientras tanto) */
  ack(changes: Change[]) {
    let dirty = false
    for (const c of changes) {
      const k = changeKey(c.collection, c.id)
      if (this.outbox[k]?.updatedAt === c.updatedAt) {
        delete this.outbox[k]
        dirty = true
      }
    }
    if (dirty) this.write(OUTBOX_KEY, this.outbox)
  }

  /** Encola todo lo local; se usa la primera vez que un dispositivo se conecta a una cuenta */
  enqueueAll() {
    const changes: Change[] = []
    for (const name of COLLECTIONS)
      for (const x of this.state[name] as Item[])
        changes.push({ collection: name, id: x.id, data: x, updatedAt: stampOf(x) })
    if (this.state.settingsUpdatedAt > 0)
      changes.push({
        collection: 'settings',
        id: SETTINGS_ID,
        data: this.state.settings,
        updatedAt: this.state.settingsUpdatedAt,
      })
    for (const c of changes) {
      const k = changeKey(c.collection, c.id)
      if (!this.outbox[k] || this.outbox[k].updatedAt < c.updatedAt) this.outbox[k] = c
    }
    this.write(OUTBOX_KEY, this.outbox)
  }

  /** Aplica filas remotas; gana la versión con `updatedAt` mayor. Devuelve si hubo cambios. */
  applyRemote(rows: RemoteRow[]): boolean {
    const lists: Partial<Record<CollectionName, Item[]>> = {}
    const next: Partial<StoreState> = {}
    let outboxDirty = false

    for (const row of rows) {
      const k = changeKey(row.collection, row.id)
      const pending = this.outbox[k]
      if (pending) {
        if (pending.updatedAt >= row.updatedAt) continue // lo local es más nuevo: se subirá
        delete this.outbox[k] // lo remoto es más nuevo: descartamos el cambio local
        outboxDirty = true
      }

      if (row.collection === 'settings') {
        const localTs = next.settingsUpdatedAt ?? this.state.settingsUpdatedAt
        if (row.deleted || !row.data || row.updatedAt <= localTs) continue
        next.settings = { ...DEFAULT_SETTINGS, ...(row.data as Partial<PomodoroSettings>) }
        next.settingsUpdatedAt = row.updatedAt
        continue
      }

      const name = row.collection
      const list = (lists[name] ??= [...(this.state[name] as Item[])])
      const idx = list.findIndex((x) => x.id === row.id)
      if (idx >= 0 && stampOf(list[idx]) >= row.updatedAt) continue
      if (row.deleted || !row.data) {
        if (idx >= 0) list.splice(idx, 1)
        else continue
      } else {
        const item = { ...(row.data as Item), updatedAt: row.updatedAt }
        if (idx >= 0) list[idx] = item
        else list.push(item)
      }
      ;(next as Record<string, unknown>)[name] = list
    }

    if (outboxDirty) this.write(OUTBOX_KEY, this.outbox)
    if (Object.keys(next).length === 0) return false
    this.commit(next)
    return true
  }
}
