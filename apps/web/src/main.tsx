import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { App } from './App'
import { FeedbackHost } from './components/FeedbackHost'
import { VersionNotice } from './components/VersionNotice'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <VersionNotice />
    <FeedbackHost />
  </StrictMode>,
)
