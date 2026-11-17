import type { SyncInfo } from './engine'

export type SyncTone = 'ok' | 'busy' | 'warn' | 'bad' | 'off'

export function syncLabel(info: SyncInfo, signedIn: boolean): { text: string; tone: SyncTone } {
  if (!signedIn) return { text: 'Sólo en este dispositivo', tone: 'off' }
  switch (info.status) {
    case 'syncing':
      return { text: 'Sincronizando…', tone: 'busy' }
    case 'offline':
      return { text: `Sin conexión · ${info.pending} pendientes`, tone: 'warn' }
    case 'error':
      return { text: 'Error al sincronizar', tone: 'bad' }
    case 'synced':
      return info.pending ? { text: `${info.pending} cambios por subir`, tone: 'busy' } : { text: 'Sincronizado', tone: 'ok' }
    default:
      return { text: 'Conectando…', tone: 'busy' }
  }
}
