# Productividad

App web (PWA) de productividad: **tareas**, **pomodoro** y **hábitos** en un solo lugar.
Funciona offline y se puede instalar en el celular desde el navegador.

**En línea:** https://gamitadiaz.github.io/productividad/

## Funciones

- **Inicio**: resumen del día, tareas para hoy, mini‑temporizador, hábitos y gráfica de enfoque de 7 días.
- **Tareas**: prioridad, fecha, etiquetas, notas, búsqueda y filtros (Hoy / Próximas / Sin fecha / Pendientes / Completadas).
  Captura rápida con sintaxis:
  - `#trabajo` → etiqueta
  - `!1` / `!alta`, `!2`, `!3` → prioridad
  - `@hoy`, `@mañana`, `@vie`, `@2026-12-24` → fecha
- **Enfoque**: pomodoro configurable (enfoque, descanso corto/largo, ciclo), vinculado a una tarea, con sonido,
  notificación del sistema y registro de sesiones. El tiempo sigue corriendo al cambiar de vista o recargar.
- **Hábitos**: marcado de los últimos 7 días, rachas y porcentaje de cumplimiento a 30 días.
- **Sincronización entre dispositivos** (opcional) con Supabase: cuenta con correo y contraseña, funciona
  offline (cola de cambios) y en tiempo real. Sin Supabase configurado la app trabaja 100 % en local.
- Tema claro/oscuro y respaldo **exportar/importar** en JSON.

## Stack

- Vite + React 19 + TypeScript
- `vite-plugin-pwa` (service worker con Workbox + manifest)
- Store local offline‑first (`src/state/store.ts`) sobre `localStorage`, con outbox de cambios pendientes.
- Supabase (Postgres + Auth + Realtime) para sincronizar (`src/sync/`, `supabase/schema.sql`).
- Vitest para las pruebas del motor de sincronización (`npm test`).

## Sincronización: cómo funciona

- Cada tarea, hábito, sesión de enfoque y los ajustes del pomodoro son **una fila** en la tabla `items`.
- Cada edición lleva `updated_at` (reloj del cliente). En un conflicto **gana la edición más reciente**; un trigger
  en Postgres lo garantiza aunque un dispositivo suba tarde una versión vieja.
- Los borrados viajan como *tombstones* (`deleted = true`) para que se propaguen.
- Sin internet, los cambios se acumulan en una cola local y se suben al reconectar. Además se sincroniza al volver
  a la pestaña, cada 60 s y al instante vía Realtime.
- La primera vez que un dispositivo inicia sesión, sus datos locales se **fusionan** con los de la cuenta.
- Row Level Security: cada usuario sólo puede leer y escribir sus propias filas.

Limitación conocida: el conflicto se resuelve por elemento completo. Si marcas días distintos del **mismo hábito**
en dos dispositivos sin conexión al mismo tiempo, se conserva sólo la versión editada al último.

## Configurar Supabase (una vez, ~5 min)

1. Crea un proyecto gratis en [supabase.com](https://supabase.com).
2. **SQL Editor → New query**, pega el contenido de [`supabase/schema.sql`](supabase/schema.sql) y dale **Run**.
3. **Authentication → URL Configuration**:
   - *Site URL*: `https://gamitadiaz.github.io/productividad/`
   - *Redirect URLs*: agrega también `http://localhost:5173/**` para desarrollo.
4. **Project Settings → API**: copia *Project URL* y la *anon public key*.
5. Local: copia `.env.example` a `.env.local` y pega los valores.
6. GitHub Pages: en el repo, **Settings → Secrets and variables → Actions → Variables**, crea
   `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, y vuelve a correr el workflow.

> La *anon key* es pública por diseño: va dentro del JavaScript que descarga el navegador.
> Lo que protege los datos son las políticas RLS del esquema. **Nunca** uses la `service_role` key en la app.

Opcional: en **Authentication → Providers → Email** puedes desactivar *Confirm email* si no quieres
confirmar el correo al registrarte.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173 (también expuesto en la LAN)
npm run build      # build de producción en dist/
npm run preview    # sirve dist/ (aquí el service worker sí está activo)
npm run lint
npm test           # pruebas del motor de sincronización
```

### Probar en el celular

`npm run dev` muestra una URL `Network: http://192.168.x.x:5173`; ábrela desde el celular en la misma red.
Para **instalar** la PWA y tener notificaciones hace falta HTTPS (o `localhost`), así que para eso conviene desplegar
(Vercel, Netlify, Cloudflare Pages) o usar un túnel como `cloudflared tunnel --url http://localhost:4173`.

## Despliegue (GitHub Pages)

`.github/workflows/deploy.yml` compila y publica en cada push a `main` o a la rama de trabajo
(también se puede lanzar a mano desde **Actions → Deploy a GitHub Pages → Run workflow**).
El workflow pasa `BASE_PATH=/productividad` para que rutas, manifest y service worker funcionen bajo ese subdirectorio.

Requisitos únicos en GitHub:
1. El repo debe ser **público** (Pages en repos privados requiere GitHub Pro).
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Estructura

```
src/
  App.tsx                 layout, navegación (hash), tema
  types.ts                modelos de datos
  lib/                    fechas, storage, parser de captura rápida, constantes pomodoro
  state/                  store offline-first + outbox, hooks de datos, respaldo, PomodoroContext
  sync/                   motor de sincronización, adaptador Supabase, contexto de cuenta, pruebas
  components/             Icon, QuickAdd, TaskItem, AccountDialog
  views/                  Dashboard, Tasks, Focus, Habits
```

## Siguientes pasos

- App nativa Android/iOS con Capacitor reutilizando este mismo código.
- Subtareas, tareas recurrentes y estadísticas más completas.
