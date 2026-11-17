import { describe, expect, it } from 'vitest'
import { Store, type Change, type KV, type RemoteRow } from '../state/store'
import { SyncEngine, type Remote } from './engine'
import type { Task } from '../types'

class MemoryKV implements KV {
  private m = new Map<string, string>()
  getItem = (k: string) => this.m.get(k) ?? null
  setItem = (k: string, v: string) => void this.m.set(k, v)
  removeItem = (k: string) => void this.m.delete(k)
}

/** Imita la tabla `items` + el trigger "gana la última edición" de supabase/schema.sql */
class MemoryRemote implements Remote {
  rows = new Map<string, RemoteRow & { userId: string }>()
  clock = 1_000_000
  offline = false

  async push(userId: string, changes: Change[]) {
    if (this.offline) throw new Error('Failed to fetch')
    for (const c of changes) {
      const key = `${userId}|${c.collection}|${c.id}`
      const old = this.rows.get(key)
      if (old && c.updatedAt < old.updatedAt) continue
      this.rows.set(key, {
        userId,
        collection: c.collection,
        id: c.id,
        data: c.data,
        deleted: c.data === null,
        updatedAt: c.updatedAt,
        serverUpdatedAt: (this.clock += 1000),
      })
    }
  }

  async pull(userId: string, since: number | null) {
    if (this.offline) throw new Error('Failed to fetch')
    return [...this.rows.values()]
      .filter((r) => r.userId === userId && (since === null || r.serverUpdatedAt > since))
      .sort((a, b) => a.serverUpdatedAt - b.serverUpdatedAt)
  }
}

function device(remote: Remote) {
  const kv = new MemoryKV()
  const store = new Store(kv)
  const engine = new SyncEngine(store, remote, kv)
  return { kv, store, engine }
}

const task = (id: string, title: string, extra: Partial<Task> = {}): Task => ({
  id, title, priority: 'media', tags: [], done: false, createdAt: Date.now(), ...extra,
})

const titles = (s: Store) => s.getState().tasks.map((t) => t.title).sort()

describe('sincronización', () => {
  it('fusiona los datos locales de dos dispositivos al iniciar sesión', async () => {
    const remote = new MemoryRemote()
    const a = device(remote)
    const b = device(remote)
    a.store.put('tasks', task('1', 'Tarea de la PC'))
    b.store.put('tasks', task('2', 'Tarea del celular'))
    b.store.put('habits', { id: 'h', name: 'Agua', emoji: '💧', color: '#000', createdAt: 1, log: ['2026-11-17'] })

    await a.engine.start('u1', { auto: false })
    await b.engine.start('u1', { auto: false })
    await a.engine.syncNow()

    expect(titles(a.store)).toEqual(['Tarea de la PC', 'Tarea del celular'])
    expect(titles(b.store)).toEqual(['Tarea de la PC', 'Tarea del celular'])
    expect(a.store.getState().habits[0].log).toEqual(['2026-11-17'])
    expect(a.store.hasPending()).toBe(false)
    expect(a.engine.getInfo().status).toBe('synced')
  })

  it('en un conflicto gana la edición más reciente, en ambos dispositivos', async () => {
    const remote = new MemoryRemote()
    const a = device(remote)
    const b = device(remote)
    a.store.put('tasks', task('1', 'Original'))
    await a.engine.start('u1', { auto: false })
    await b.engine.start('u1', { auto: false })

    a.store.patch('tasks', '1', { title: 'Editada en A' })
    b.store.patch('tasks', '1', { title: 'Editada en B (después)' })
    // B sube primero; A sube su versión más vieja después: el servidor debe rechazarla
    await b.engine.syncNow()
    await a.engine.syncNow()
    await b.engine.syncNow()

    expect(titles(a.store)).toEqual(['Editada en B (después)'])
    expect(titles(b.store)).toEqual(['Editada en B (después)'])
  })

  it('propaga borrados (tombstones)', async () => {
    const remote = new MemoryRemote()
    const a = device(remote)
    const b = device(remote)
    a.store.put('tasks', task('1', 'Se va'))
    a.store.put('tasks', task('2', 'Se queda'))
    await a.engine.start('u1', { auto: false })
    await b.engine.start('u1', { auto: false })
    expect(titles(b.store)).toEqual(['Se queda', 'Se va'])

    a.store.remove('tasks', '1')
    await a.engine.syncNow()
    await b.engine.syncNow()
    expect(titles(b.store)).toEqual(['Se queda'])
  })

  it('sin conexión conserva la cola y la sube al reconectar', async () => {
    const remote = new MemoryRemote()
    const a = device(remote)
    const b = device(remote)
    await a.engine.start('u1', { auto: false })
    await b.engine.start('u1', { auto: false })

    remote.offline = true
    a.store.put('tasks', task('1', 'Escrita sin internet'))
    await a.engine.syncNow()
    expect(a.engine.getInfo().status).toBe('error')
    expect(a.store.pendingChanges()).toHaveLength(1)

    remote.offline = false
    await a.engine.syncNow()
    await b.engine.syncNow()
    expect(a.store.hasPending()).toBe(false)
    expect(titles(b.store)).toEqual(['Escrita sin internet'])
  })

  it('no pierde una edición hecha mientras se subía la versión anterior', async () => {
    const remote = new MemoryRemote()
    const a = device(remote)
    await a.engine.start('u1', { auto: false })
    a.store.put('tasks', task('1', 'v1'))
    const pushing = a.engine.syncNow()
    a.store.patch('tasks', '1', { title: 'v2' }) // edición durante la subida
    await pushing
    expect(a.store.pendingChanges().map((c) => (c.data as Task).title)).toEqual(['v2'])
    await a.engine.syncNow()
    expect(a.store.hasPending()).toBe(false)
    expect(titles(a.store)).toEqual(['v2'])
  })

  it('sincroniza los ajustes del pomodoro', async () => {
    const remote = new MemoryRemote()
    const a = device(remote)
    const b = device(remote)
    await a.engine.start('u1', { auto: false })
    await b.engine.start('u1', { auto: false })
    a.store.setSettings({ ...a.store.getState().settings, focus: 50 })
    await a.engine.syncNow()
    await b.engine.syncNow()
    expect(b.store.getState().settings.focus).toBe(50)
  })

  it('los datos de un usuario no aparecen en otro', async () => {
    const remote = new MemoryRemote()
    const a = device(remote)
    a.store.put('tasks', task('1', 'Privada'))
    await a.engine.start('u1', { auto: false })
    const other = device(remote)
    await other.engine.start('u2', { auto: false })
    expect(other.store.getState().tasks).toEqual([])
  })

  it('cerrar sesión borrando datos locales no borra nada en la nube', async () => {
    const remote = new MemoryRemote()
    const a = device(remote)
    a.store.put('tasks', task('1', 'Persistente'))
    await a.engine.start('u1', { auto: false })
    a.engine.stop()
    a.store.clearLocal()
    a.engine.forgetCursor('u1')
    expect(a.store.getState().tasks).toEqual([])

    await a.engine.start('u1', { auto: false })
    expect(titles(a.store)).toEqual(['Persistente'])
  })

  it('migra datos antiguos sin updatedAt', async () => {
    const remote = new MemoryRemote()
    const a = device(remote)
    a.kv.setItem('prod:v1:tasks', JSON.stringify([task('old', 'De la versión 1', { createdAt: 123 })]))
    a.store.reload()
    await a.engine.start('u1', { auto: false })
    const b = device(remote)
    await b.engine.start('u1', { auto: false })
    expect(titles(b.store)).toEqual(['De la versión 1'])
  })
})
