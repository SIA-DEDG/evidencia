import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { installPageZoom } from './pageZoom'
import './styles.css'

installPageZoom()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
