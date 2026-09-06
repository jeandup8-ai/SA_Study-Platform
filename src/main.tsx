import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import './i18n'
import App from './App.tsx'
import { AuthProvider } from '@/context/AuthContext'
import { LearnerProvider } from '@/context/LearnerContext'

// The plain auto-injected registerSW.js only ever registers the worker once
// on load -- it never re-checks for a newer one, so a deploy could sit
// unnoticed on an already-open tab indefinitely (the classic "why am I still
// seeing the old version" PWA trap). registerType: 'autoUpdate' in
// vite.config.ts only configures the *worker* to skipWaiting/clientsClaim
// once it IS asked to update; something on the client still has to actually
// ask. Polling registration.update() here is that missing piece, and passing
// true to the returned updateSW forces the new worker to take over and
// reloads the page immediately once an update is found, rather than leaving
// stale content running silently in the background.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    setInterval(() => void registration.update(), 5 * 60 * 1000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LearnerProvider>
          <App />
        </LearnerProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
