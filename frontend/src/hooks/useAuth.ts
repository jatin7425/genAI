import { useCallback, useEffect, useRef, useState } from 'react'
import { login as loginRequest, logout as logoutRequest } from '../api/auth'
import {
  getToken,
  setToken,
  clearToken,
  markActivity,
  getLastActivity,
  UNAUTHORIZED_EVENT,
} from '../utils/authToken'

const INACTIVITY_LIMIT_MS = 60 * 60 * 1000 // 1 hour, mirrors the backend's own token expiry
const IDLE_CHECK_INTERVAL_MS = 30_000
const ACTIVITY_THROTTLE_MS = 5_000
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const

export function useAuth() {
  const [token, setTokenState] = useState<string | null>(() => getToken())
  const tokenRef = useRef(token)
  tokenRef.current = token

  const logout = useCallback(() => {
    if (tokenRef.current) void logoutRequest(tokenRef.current)
    clearToken()
    setTokenState(null)
  }, [])

  useEffect(() => {
    const handler = () => setTokenState(null)
    window.addEventListener(UNAUTHORIZED_EVENT, handler)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler)
  }, [])

  // Auto-logout after an hour of no mouse/keyboard/scroll activity. lastActivity lives in
  // localStorage so it's shared across tabs and survives a reload of this one.
  useEffect(() => {
    if (!token) return

    let lastMarked = 0
    const onActivity = () => {
      const now = Date.now()
      if (now - lastMarked < ACTIVITY_THROTTLE_MS) return
      lastMarked = now
      markActivity()
    }

    onActivity()
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, onActivity, { passive: true }))

    const interval = setInterval(() => {
      if (Date.now() - getLastActivity() > INACTIVITY_LIMIT_MS) {
        logout()
      }
    }, IDLE_CHECK_INTERVAL_MS)

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity))
      clearInterval(interval)
    }
  }, [token, logout])

  const login = useCallback(async (username: string, password: string) => {
    const newToken = await loginRequest(username, password)
    setToken(newToken)
    markActivity()
    setTokenState(newToken)
  }, [])

  return { isAuthenticated: !!token, login, logout }
}
