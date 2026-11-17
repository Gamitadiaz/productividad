import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// En GitHub Pages la app vive en /<repo>/; el workflow pasa BASE_PATH (p. ej. "/productividad")
const base = process.env.BASE_PATH ? `${process.env.BASE_PATH.replace(/\/$/, '')}/` : '/'

export default defineConfig({
  base,
  // host: true expone el servidor en la LAN para probar desde el celular
  server: { host: true },
  preview: { host: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Productividad',
        short_name: 'Productividad',
        description: 'Tareas, pomodoro y hábitos en un solo lugar.',
        lang: 'es-MX',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0f1115',
        background_color: '#0f1115',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
