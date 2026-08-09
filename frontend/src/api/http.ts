import { getToken, notifyUnauthorized } from '../utils/authToken'

/** fetch wrapper that attaches the bearer token and clears/broadcasts on 401. */
export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(url, { ...init, headers })

  if (res.status === 401) {
    notifyUnauthorized()
  }

  return res
}
