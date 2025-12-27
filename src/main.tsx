import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n' // Initialize i18n before app
import './index.css'
import App from './App'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found. Make sure there is an element with id="root" in your HTML.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
