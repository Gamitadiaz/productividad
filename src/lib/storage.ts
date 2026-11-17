import { useEffect, useState } from 'react'

const PREFIX = 'prod:v1:'

export function readKey<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeKey(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* almacenamiento lleno o bloqueado: se ignora */
  }
}

/**
 * useState persistido en localStorage y sincronizado entre pestañas.
 * Es la única capa que toca el almacenamiento: para migrar a un backend
 * basta con reemplazar este hook.
 */
export function useLocalState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readKey(key, initial))

  useEffect(() => {
    writeKey(key, value)
  }, [key, value])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== PREFIX + key || e.newValue == null) return
      try {
        setValue(JSON.parse(e.newValue) as T)
      } catch {
        /* valor corrupto: se ignora */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key])

  return [value, setValue] as const
}

export function uid(): string {
  // crypto.randomUUID sólo existe en contextos seguros (https/localhost);
  // desde el celular por IP de LAN no, así que hay fallback.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto && window.isSecureContext) return crypto.randomUUID()
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}
