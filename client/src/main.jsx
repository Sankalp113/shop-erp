import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter basename="/shop-erp">
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: '#1A1A2E',
          color: '#F1F5F9',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          fontSize: '13px',
          padding: '12px 16px',
        },
        success: { iconTheme: { primary: '#10B981', secondary: '#fff' } },
        error: { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
      }}
    />
  </BrowserRouter>
)
