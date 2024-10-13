import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import posthog from 'posthog-js'
import { POSTHOG_HOST, POSTHOG_KEY } from './constants.ts'

posthog.init(POSTHOG_KEY,
  {
      api_host: POSTHOG_HOST,
      person_profiles: 'always'
  }
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
