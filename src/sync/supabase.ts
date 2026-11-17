import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { RemoteRow, SyncCollection } from '../state/store'
import type { Remote } from './engine'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** null si la app se compiló sin credenciales de Supabase (modo sólo local) */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          // PKCE devuelve ?code= en la URL y no choca con el ruteo por hash (#/tareas)
          flowType: 'pkce',
        },
      })
    : null

interface DbRow {
  user_id: string
  collection: SyncCollection
  id: string
  data: unknown | null
  deleted: boolean
  updated_at: number | string
  server_updated_at: string
}

const PAGE = 1000

const toRow = (r: DbRow): RemoteRow => ({
  collection: r.collection,
  id: r.id,
  data: r.data,
  deleted: r.deleted,
  updatedAt: Number(r.updated_at),
  serverUpdatedAt: Date.parse(r.server_updated_at),
})

export function createSupabaseRemote(sb: SupabaseClient): Remote {
  return {
    async push(userId, changes) {
      const { error } = await sb.from('items').upsert(
        changes.map((c) => ({
          user_id: userId,
          collection: c.collection,
          id: c.id,
          data: c.data,
          deleted: c.data === null,
          updated_at: c.updatedAt,
        })),
        { onConflict: 'user_id,collection,id' },
      )
      if (error) throw error
    },

    async pull(userId, since) {
      const out: RemoteRow[] = []
      let cursor = since
      for (;;) {
        let q = sb.from('items').select('*').eq('user_id', userId).order('server_updated_at').limit(PAGE)
        if (cursor !== null) q = q.gt('server_updated_at', new Date(cursor).toISOString())
        const { data, error } = await q
        if (error) throw error
        const rows = (data as DbRow[]).map(toRow)
        out.push(...rows)
        if (rows.length < PAGE) break
        cursor = rows[rows.length - 1].serverUpdatedAt
      }
      return out
    },

    subscribe(userId, onRow) {
      const channel = sb
        .channel(`items:${userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'items', filter: `user_id=eq.${userId}` },
          (payload) => {
            const row = payload.new as Partial<DbRow>
            if (row && row.id && row.collection) onRow(toRow(row as DbRow))
          },
        )
        .subscribe()
      return () => {
        void sb.removeChannel(channel)
      }
    },
  }
}
