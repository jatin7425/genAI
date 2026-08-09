const STORAGE_KEY = 'cortex.authToken'
const LAST_ACTIVITY_KEY = 'cortex.lastActivity'

export function getToken(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export const UNAUTHORIZED_EVENT = 'cortex:unauthorized'

export function notifyUnauthorized(): void {
  clearToken()
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
}

export function getLastActivity(): number {
  return Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || Date.now()
}

export function markActivity(): void {
  localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
}
