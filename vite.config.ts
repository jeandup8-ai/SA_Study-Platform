import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registration is done explicitly in main.tsx via virtual:pwa-register
      // (with a periodic update check), not the default auto-injected
      // script, which only ever registers once and never checks again.
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'StudyLegends',
        short_name: 'StudyLegends',
        description: "Your child's personal digital tutor — Grade 4 to 7, South African curriculum.",
        theme_color: '#0d9488',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
        icons: [
          // PNGs, not just the SVG originals -- Chrome's install-banner
          // criteria (and most other browsers') don't reliably treat an
          // SVG-only icon set as installable, which was silently suppressing
          // the "Add to Home Screen" prompt entirely.
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
