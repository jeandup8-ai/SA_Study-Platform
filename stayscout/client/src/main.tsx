import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
// Fonts are bundled and served from our own origin (SIL Open Font License),
// so page views don't send visitors' IP addresses to a font CDN.
import '@fontsource/fraunces/400.css'
import '@fontsource/fraunces/600.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import './styles.css'
import { Layout } from './components/Layout'
import { StatusProvider } from './components/ui'
import { Landing } from './pages/Landing'
import { MyTrips, NotFound, Privacy, Sample, Shared, Terms } from './pages/Other'
import { Plan } from './pages/Plan'
import { Trip } from './pages/Trip'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StatusProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Landing />} />
            <Route path="plan" element={<Plan />} />
            <Route path="trips" element={<MyTrips />} />
            <Route path="trips/:id" element={<Trip />} />
            <Route path="sample" element={<Sample />} />
            <Route path="g/:token" element={<Shared />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="terms" element={<Terms />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StatusProvider>
  </StrictMode>,
)
