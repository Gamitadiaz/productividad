import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSync } from '../sync/SyncContext'
import { syncLabel, type SyncTone } from '../sync/label'
import { exportBackup, importBackup } from '../state/backup'
import { dayKey } from '../lib/date'
import { Icon } from './Icon'

export function SyncDot({ tone }: { tone: SyncTone }) {
  return <span className={`sync-dot sync-${tone}`} aria-hidden="true" />
}

type Mode = 'login' | 'signup' | 'reset'

function AuthForm() {
  const { signIn, signUp, resetPassword } = useSync()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'login') await signIn(email, password)
      else if (mode === 'signup') {
        const needsConfirm = await signUp(email, password)
        if (needsConfirm) setNotice('Te enviamos un correo de confirmación. Ábrelo y luego inicia sesión aquí.')
      } else {
        await resetPassword(email)
        setNotice('Si el correo existe, te llegará un enlace para restablecer tu contraseña.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {mode !== 'reset' && (
        <div className="segmented" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
            Iniciar sesión
          </button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>
            Crear cuenta
          </button>
        </div>
      )}
      <label className="field">
        <span>Correo</span>
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {mode !== 'reset' && (
        <label className="field">
          <span>Contraseña</span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-notice" role="status">{notice}</p>}
      <button className="btn btn-primary" disabled={busy}>
        {busy ? 'Un momento…' : mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Crear cuenta' : 'Enviar enlace'}
      </button>
      {mode === 'login' && (
        <button type="button" className="link" onClick={() => setMode('reset')}>
          ¿Olvidaste tu contraseña?
        </button>
      )}
      {mode === 'reset' && (
        <button type="button" className="link" onClick={() => setMode('login')}>
          ← Volver
        </button>
      )}
      <p className="muted small">
        Tus datos actuales de este dispositivo se fusionan con la cuenta la primera vez que inicias sesión.
      </p>
    </form>
  )
}

function NewPasswordForm() {
  const { updatePassword } = useSync()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="auth-form"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError(null)
        try {
          await updatePassword(password)
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setBusy(false)
        }
      }}
    >
      <p>Escribe tu nueva contraseña.</p>
      <label className="field">
        <span>Nueva contraseña</span>
        <input type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-primary" disabled={busy}>
        Guardar contraseña
      </button>
    </form>
  )
}

function AccountInfo() {
  const { user, info, syncNow, signOut } = useSync()
  const [wipe, setWipe] = useState(true)
  const [busy, setBusy] = useState(false)
  const label = syncLabel(info, true)
  return (
    <div className="account-info">
      <div className="account-row">
        <span className="avatar">{user!.email.charAt(0).toUpperCase()}</span>
        <div className="account-who">
          <strong>{user!.email}</strong>
          <span className="muted small">
            <SyncDot tone={label.tone} /> {label.text}
            {info.lastSyncAt && info.status === 'synced' && ` · ${new Date(info.lastSyncAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`}
          </span>
        </div>
        <button className="icon-btn" onClick={syncNow} aria-label="Sincronizar ahora" disabled={info.status === 'syncing'}>
          <Icon name="reset" className={info.status === 'syncing' ? 'spin' : ''} />
        </button>
      </div>
      {info.status === 'error' && info.error && <p className="form-error">{info.error}</p>}
      <label className="toggle">
        <input type="checkbox" checked={wipe} onChange={(e) => setWipe(e.target.checked)} />
        Al cerrar sesión, borrar los datos de este dispositivo
      </label>
      <button
        className="btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await signOut(wipe)
          } finally {
            setBusy(false)
          }
        }}
      >
        Cerrar sesión
      </button>
    </div>
  )
}

export function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { configured, user, ready, recovering } = useSync()
  const [backupMsg, setBackupMsg] = useState<string | null>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  const doExport = () => {
    const blob = new Blob([exportBackup()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `productividad-${dayKey()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const doImport = async (file: File) => {
    if (!confirm('Importar reemplaza tus datos actuales (también en la nube si tienes sesión). ¿Continuar?')) return
    try {
      importBackup(await file.text())
      setBackupMsg('Respaldo importado.')
    } catch (e) {
      setBackupMsg(e instanceof Error ? e.message : 'No se pudo importar el archivo')
    }
  }

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <div className="dialog-body">
        <header className="dialog-head">
          <h2>{user ? 'Tu cuenta' : 'Sincroniza tus dispositivos'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <Icon name="x" />
          </button>
        </header>

        {!configured ? (
          <p className="muted">
            La sincronización no está configurada en esta instalación. Tus datos se guardan sólo en este navegador; usa el
            respaldo para moverlos.
          </p>
        ) : !ready ? (
          <p className="muted">Cargando…</p>
        ) : recovering ? (
          <NewPasswordForm />
        ) : user ? (
          <AccountInfo />
        ) : (
          <AuthForm />
        )}

        <section className="backup">
          <h3>Respaldo</h3>
          <div className="backup-actions">
            <button className="btn" onClick={doExport}>
              <Icon name="download" size={16} /> Exportar
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={16} /> Importar
            </button>
          </div>
          {backupMsg && <p className="muted small">{backupMsg}</p>}
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void doImport(f)
            }}
          />
        </section>
      </div>
    </dialog>
  )
}
