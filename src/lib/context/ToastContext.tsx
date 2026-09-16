'use client'
import React, { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  message: string
}

interface ToastContextValue {
  toasts: ToastItem[]
  addToast: (type: ToastType, message: string) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
})

// ── Provider ─────────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setToasts(prev => [...prev.slice(-4), { id, type, message }]) // max 5 toasts
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastRenderer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useToast() {
  const { addToast } = useContext(ToastContext)
  return {
    success: (msg: string) => addToast('success', msg),
    error:   (msg: string) => addToast('error', msg),
    warn:    (msg: string) => addToast('warning', msg),
    info:    (msg: string) => addToast('info', msg),
  }
}

// ── Renderer ─────────────────────────────────────────────────────────────────
const TOAST_CONFIG: Record<ToastType, { icon: React.ReactNode; border: string; bg: string; text: string }> = {
  success: {
    icon:   <CheckCircle2 size={18} className="flex-shrink-0" />,
    border: 'border-emerald-500/40',
    bg:     'bg-emerald-500/10',
    text:   'text-emerald-300',
  },
  error: {
    icon:   <XCircle size={18} className="flex-shrink-0" />,
    border: 'border-red-500/40',
    bg:     'bg-red-500/10',
    text:   'text-red-300',
  },
  warning: {
    icon:   <AlertTriangle size={18} className="flex-shrink-0" />,
    border: 'border-amber-500/40',
    bg:     'bg-amber-500/10',
    text:   'text-amber-300',
  },
  info: {
    icon:   <Info size={18} className="flex-shrink-0" />,
    border: 'border-blue-500/40',
    bg:     'bg-blue-500/10',
    text:   'text-blue-300',
  },
}

function ToastRenderer({ toasts, onRemove }: { toasts: ToastItem[]; onRemove: (id: string) => void }) {
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(t => {
        const cfg = TOAST_CONFIG[t.type]
        return (
          <div
            key={t.id}
            className={`
              pointer-events-auto flex items-start gap-3 p-4 rounded-xl border
              backdrop-blur-xl shadow-2xl
              ${cfg.bg} ${cfg.border}
              animate-in slide-in-from-right-5 fade-in duration-300
            `}
          >
            <span className={cfg.text}>{cfg.icon}</span>
            <p className="flex-1 text-sm text-gray-200 leading-snug">{t.message}</p>
            <button
              onClick={() => onRemove(t.id)}
              className="text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0 mt-0.5"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
