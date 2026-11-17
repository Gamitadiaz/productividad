import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { store } from '../state/DataContext'
import { SyncEngine, type SyncInfo } from './engine'
import { createSupabaseRemote, supabase } from './supabase'

interface SyncContextValue {
  /** false si la app se compiló sin credenciales de Supabase */
  configured: boolean
  user: { id: string; email: string } | null
  ready: boolean
  info: SyncInfo
  signIn: (email: string, password: string) => Promise<void>
  /** Devuelve true si la cuenta requiere confirmar el correo */
  signUp: (email: string, password: string) => Promise<boolean>
  resetPassword: (email: string) => Promise<void>
  /** true al volver del enlace de "olvidé mi contraseña" */
  recovering: boolean
  updatePassword: (password: string) => Promise<void>
  signOut: (wipeLocal: boolean) => Promise<void>
  syncNow: () => void
}

const engine = supabase ? new SyncEngine(store, createSupabaseRemote(supabase), window.localStorage) : null
const IDLE: SyncInfo = { status: 'idle', lastSyncAt: null, error: null, pending: 0 }
const noopSubscribe = () => () => {}

const SyncContext = createContext<SyncContextValue | null>(null)

const redirectTo = () => `${location.origin}${import.meta.env.BASE_URL}`

function translateError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e)
  const map: Record<string, string> = {
    'Invalid login credentials': 'Correo o contraseña incorrectos.',
    'Email not confirmed': 'Confirma tu correo antes de iniciar sesión (revisa tu bandeja y spam).',
    'User already registered': 'Ya existe una cuenta con ese correo. Inicia sesión.',
  }
  for (const [k, v] of Object.entries(map)) if (msg.includes(k)) return new Error(v)
  if (/Password should be at least/i.test(msg)) return new Error('La contraseña debe tener al menos 6 caracteres.')
  if (/rate limit/i.test(msg)) return new Error('Demasiados intentos. Espera un momento y vuelve a intentar.')
  return new Error(msg)
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SyncContextValue['user']>(null)
  const [ready, setReady] = useState(!supabase)
  const [recovering, setRecovering] = useState(false)
  const info = useSyncExternalStore(engine?.subscribe ?? noopSubscribe, engine?.getInfo ?? (() => IDLE))

  useEffect(() => {
    if (!supabase) return
    const apply = (u: { id: string; email?: string } | null | undefined) => {
      setUser(u ? { id: u.id, email: u.email ?? '' } : null)
      // Diferido: llamar a Supabase dentro del callback de auth puede bloquearse
      setTimeout(() => {
        if (u) void engine?.start(u.id)
        else engine?.stop()
      }, 0)
    }
    supabase.auth.getSession().then(({ data }) => {
      apply(data.session?.user)
      setReady(true)
      // Limpia ?code= que deja el enlace de confirmación
      if (new URLSearchParams(location.search).has('code')) {
        history.replaceState(null, '', location.pathname + location.hash)
      }
    })
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      apply(session?.user)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw translateError(error)
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) return false
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo() } })
    if (error) throw translateError(error)
    // Supabase devuelve un usuario sin identidades si el correo ya estaba registrado
    if (data.user && data.user.identities?.length === 0) throw translateError('User already registered')
    return !data.session
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    if (!supabase) return
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() })
    if (error) throw translateError(error)
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    if (!supabase) return
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw translateError(error)
    setRecovering(false)
  }, [])

  const signOut = useCallback(
    async (wipeLocal: boolean) => {
      if (!supabase) return
      // Intento final de subir pendientes antes de salir
      if (engine && store.hasPending()) await engine.syncNow()
      const id = user?.id
      await supabase.auth.signOut()
      engine?.stop()
      if (wipeLocal) {
        store.clearLocal()
        if (id) engine?.forgetCursor(id)
      }
    },
    [user],
  )

  const syncNow = useCallback(() => void engine?.syncNow(), [])

  const value = useMemo(
    () => ({
      configured: !!supabase, user, ready, info, signIn, signUp, resetPassword, recovering, updatePassword, signOut, syncNow,
    }),
    [user, ready, info, signIn, signUp, resetPassword, recovering, updatePassword, signOut, syncNow],
  )
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSync debe usarse dentro de <SyncProvider>')
  return ctx
}
