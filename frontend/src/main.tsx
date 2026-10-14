import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Discard credentials and preferences from the retired feature.
sessionStorage.removeItem('cortex.secretWorld')
sessionStorage.removeItem('cortex.companionModel')

document.documentElement.classList.toggle('dark', localStorage.getItem('cortex.theme') === 'dark')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
