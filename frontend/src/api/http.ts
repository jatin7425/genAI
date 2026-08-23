import { getToken, notifyUnauthorized } from '../utils/authToken'
import { showLoader, hideLoader } from '../utils/loaderState'

/** fetch wrapper that attaches the bearer token and clears/broadcasts on 401. */
export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  showLoader()
  try {
    const res = await fetch(url, { ...init, headers })

    if (res.status === 401) {
      notifyUnauthorized()
    }

    // If it's a successful mutation, notify the app to refetch lists
    const method = (init.method || 'GET').toUpperCase()
    if (res.ok && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      window.dispatchEvent(new CustomEvent('api_mutation'))
    }

    return res
  } finally {
    hideLoader()
  }
}
