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
- Tema claro/oscuro y respaldo **exportar/importar** en JSON.

## Stack

- Vite + React 19 + TypeScript
- `vite-plugin-pwa` (service worker con Workbox + manifest)
- Persistencia en `localStorage` (`src/lib/storage.ts`). Es la única capa que toca el almacenamiento,
  así que migrar a un backend (Supabase, API propia, etc.) implica cambiar sólo ese hook.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173 (también expuesto en la LAN)
npm run build      # build de producción en dist/
npm run preview    # sirve dist/ (aquí el service worker sí está activo)
npm run lint
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
  App.tsx                 layout, navegación (hash), tema, respaldo
  types.ts                modelos de datos
  lib/                    fechas, storage, parser de captura rápida, constantes pomodoro
  state/                  DataContext (tareas/hábitos/sesiones) y PomodoroContext (temporizador)
  components/             Icon, QuickAdd, TaskItem
  views/                  Dashboard, Tasks, Focus, Habits
```

## Siguientes pasos

- Sincronización en la nube con cuenta de usuario (Supabase).
- App nativa Android/iOS con Capacitor reutilizando este mismo código.
- Subtareas, tareas recurrentes y estadísticas más completas.
