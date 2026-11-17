import type { Change, KV, RemoteRow, Store } from '../state/store'
import { PREFIX } from '../state/store'

/** Backend remoto. Implementación real en supabase.ts; en pruebas, uno en memoria. */
export interface Remote {
  push(userId: string, changes: Change[]): Promise<void>
  /** Filas con serverUpdatedAt > since (todas las páginas) */
  pull(userId: string, since: number | null): Promise<RemoteRow[]>
  subscribe?(userId: string, onRow: (row: RemoteRow) => void): () => void
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error'

export interface SyncInfo {
  status: SyncStatus
  lastSyncAt: number | null
  error: string | null
  pending: number
}

const PUSH_CHUNK = 500
/** Margen al descargar para no perder filas confirmadas fuera de orden */
const PULL_OVERLAP_MS = 5_000

export class SyncEngine {
  private userId: string | null = null
  private running = false
  private rerun = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private cleanups: (() => void)[] = []
  private listeners = new Set<() => void>()
  private info: SyncInfo = { status: 'idle', lastSyncAt: null, error: null, pending: 0 }
  private readonly store: Store
  private readonly remote: Remote
  private readonly kv: KV

  constructor(store: Store, remote: Remote, kv: KV) {
    this.store = store
    this.remote = remote
    this.kv = kv
  }

  getInfo = (): SyncInfo => this.info
  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }
  private set(patch: Partial<SyncInfo>) {
    this.info = { ...this.info, ...patch, pending: this.store.pendingChanges().length }
    for (const fn of this.listeners) fn()
  }

  private cursorKey() {
    return `${PREFIX}syncCursor:${this.userId}`
  }
  private getCursor(): number | null {
    const v = this.kv.getItem(this.cursorKey())
    return v ? Number(v) : null
  }

  /** Empieza a sincronizar para un usuario. Devuelve una promesa con la primera sincronización. */
  start(userId: string, opts: { auto?: boolean } = {}): Promise<void> {
    if (this.userId === userId) return this.syncNow()
    this.stop()
    this.userId = userId

    // Primera vez de este dispositivo con esta cuenta: fusiona lo local con la nube
    if (this.getCursor() === null) this.store.enqueueAll()

    this.cleanups.push(
      this.store.subscribe(() => {
        if (this.store.hasPending()) this.schedule(1500)
        else this.set({})
      }),
    )
    if (this.remote.subscribe) {
      this.cleanups.push(this.remote.subscribe(userId, (row) => this.store.applyRemote([row])))
    }
    if (opts.auto !== false && typeof window !== 'undefined') {
      const onOnline = () => this.schedule(0)
      const onVisible = () => document.visibilityState === 'visible' && this.schedule(0)
      window.addEventListener('online', onOnline)
      document.addEventListener('visibilitychange', onVisible)
      const interval = setInterval(() => this.schedule(0), 60_000)
      this.cleanups.push(() => {
        window.removeEventListener('online', onOnline)
        document.removeEventListener('visibilitychange', onVisible)
        clearInterval(interval)
      })
    }
    return this.syncNow()
  }

  stop() {
    for (const c of this.cleanups) c()
    this.cleanups = []
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.userId = null
    this.set({ status: 'idle', error: null })
  }

  /** Olvida el cursor del usuario: la próxima vez descargará todo de nuevo */
  forgetCursor(userId: string) {
    this.kv.removeItem(`${PREFIX}syncCursor:${userId}`)
  }

  private schedule(ms: number) {
    if (!this.userId) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      void this.syncNow()
    }, ms)
  }

  async syncNow(): Promise<void> {
    const userId = this.userId
    if (!userId) return
    if (this.running) {
      this.rerun = true
      return
    }
    this.running = true
    this.set({ status: 'syncing', error: null })
    try {
      // 1) Subir cambios locales
      const pending = this.store.pendingChanges()
      for (let i = 0; i < pending.length; i += PUSH_CHUNK) {
        const chunk = pending.slice(i, i + PUSH_CHUNK)
        await this.remote.push(userId, chunk)
        this.store.ack(chunk)
      }
      // 2) Bajar cambios remotos
      const cursor = this.getCursor()
      const rows = await this.remote.pull(userId, cursor === null ? null : cursor - PULL_OVERLAP_MS)
      if (this.userId !== userId) return // cerró sesión a media sincronización
      this.store.applyRemote(rows)
      const maxTs = rows.reduce((m, r) => Math.max(m, r.serverUpdatedAt), cursor ?? 0)
      this.kv.setItem(this.cursorKey(), String(maxTs))
      this.set({ status: 'synced', lastSyncAt: Date.now() })
    } catch (e) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false
      this.set({
        status: offline ? 'offline' : 'error',
        error: offline ? null : e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e),
      })
    } finally {
      this.running = false
      if (this.rerun) {
        this.rerun = false
        void this.syncNow()
      }
    }
  }
}
