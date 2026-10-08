export type ToastVariant = 'success' | 'error' | 'info'
export type Toast = { id: number; message: string; variant: ToastVariant }

type Listener = (toasts: Toast[]) => void

const TOAST_DURATION_MS = 4000

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<Listener>()

function emit() {
  listeners.forEach((listener) => listener(toasts))
}

export function showToast(message: string, variant: ToastVariant = 'info') {
  const id = nextId++
  toasts = [...toasts, { id, message, variant }]
  emit()
  setTimeout(() => dismissToast(id), TOAST_DURATION_MS)
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function subscribeToast(listener: Listener) {
  listeners.add(listener)
  listener(toasts)
  return () => {
    listeners.delete(listener)
  }
}
