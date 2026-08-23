type Listener = (loading: boolean) => void

let activeRequests = 0
const listeners = new Set<Listener>()

function emit() {
  const isLoading = activeRequests > 0
  listeners.forEach((listener) => listener(isLoading))
}

export function showLoader() {
  activeRequests++
  emit()
}

export function hideLoader() {
  activeRequests = Math.max(0, activeRequests - 1)
  emit()
}

export function subscribeLoader(listener: Listener) {
  listeners.add(listener)
  listener(activeRequests > 0)
  return () => {
    listeners.delete(listener)
  }
}
