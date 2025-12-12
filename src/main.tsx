import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Если случайно пришли на /login без hash, перебрасываем на hash-маршрут
if (window.location.pathname.startsWith('/login') && !window.location.hash.includes('/login')) {
  window.location.replace(`/#/login${window.location.search}`)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
