import { API_V1 } from './config'

export async function login(username: string, password: string): Promise<string> {
  const res = await fetch(`${API_V1}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail ?? `Login failed: ${res.status}`)
  }

  const data: { token: string } = await res.json()
  return data.token
}

/** Best-effort server-side invalidation — logout should still proceed locally even if this fails. */
export async function logout(token: string): Promise<void> {
  await fetch(`${API_V1}/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {})
}
