import { useEffect, useState } from 'react'
import { Icon } from '../Icon'
import { subscribeToast, dismissToast, type Toast } from '../../utils/toastState'

const VARIANT_STYLES: Record<Toast['variant'], string> = {
  success: 'border-primary/30 bg-surface-container-high text-on-surface',
  error: 'border-error/40 bg-error-container text-on-error-container',
  info: 'border-outline-variant bg-surface-container-high text-on-surface',
}

const VARIANT_ICONS: Record<Toast['variant'], string> = {
  success: 'check_circle',
  error: 'error',
  info: 'info',
}

export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => subscribeToast(setToasts), [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0 z-[60] flex flex-col items-center md:items-end gap-2 w-[calc(100%-2rem)] max-w-sm px-0">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`flex items-start gap-2 w-full rounded-xl border px-4 py-3 shadow-lg backdrop-blur-md [animation:toast-in_0.2s_ease-out] ${VARIANT_STYLES[toast.variant]}`}
        >
          <Icon name={VARIANT_ICONS[toast.variant]} filled className="text-[18px] shrink-0 mt-0.5" />
          <p className="flex-1 text-sm font-medium leading-snug">{toast.message}</p>
          <button
            onClick={() => dismissToast(toast.id)}
            className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <Icon name="close" className="text-[16px]" />
          </button>
        </div>
      ))}
    </div>
  )
}
