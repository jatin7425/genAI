import { API_V1 } from './config'
import { authFetch } from './http'
import { readSseStream } from './sse'
import type { ChatStreamHandlers } from './types'
export type Companion = { id: string; attributes: Record<string, string>; description: string; updated_at: string }
export type CompanionTurn = { id: string; kind: 'user' | 'agent'; text: string; status?: string }
export type CompanionThread = { id: string; profile_id: string; turns: CompanionTurn[]; updated_at: string }
const TOKEN_KEY = 'cortex.secretWorld'
export const forgetWorldToken = () => sessionStorage.removeItem(TOKEN_KEY)
export const hasWorldToken = () => !!sessionStorage.getItem(TOKEN_KEY)
async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  const token = sessionStorage.getItem(TOKEN_KEY)
  if (token) headers.set('X-Roleplay-Token', token)
  const res = await authFetch(`${API_V1}/roleplay${path}`, { ...init, headers }, true)
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    if (res.status === 403 && path !== '/unlock') { forgetWorldToken(); window.dispatchEvent(new Event('secret_world_locked')) }
    throw new Error(typeof data?.detail === 'string' ? data.detail : 'The request could not finish. Try again.')
  }
  return res
}
export async function unlockWorld(password: string) {
  const res = await request('/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
  sessionStorage.setItem(TOKEN_KEY, (await res.json()).token)
}
export async function lockWorld() { try { await request('/lock', { method: 'POST' }) } finally { forgetWorldToken() } }
export async function fetchCompanions(): Promise<Companion[]> { return (await (await request('/profiles')).json()).profiles }
export async function extractCompanion(description: string, model: string, signal?: AbortSignal): Promise<{ attributes: Record<string, string>; missing_fields: string[] }> {
  return (await request('/extract', { signal, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description, model }) })).json()
}
export async function saveCompanion(attributes: Record<string, string>, description: string, id?: string): Promise<Companion> {
  return (await request(`/profiles${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attributes, description }) })).json()
}
export async function deleteCompanion(id: string) { await request(`/profiles/${encodeURIComponent(id)}`, { method: 'DELETE' }) }
export async function fetchCompanionThreads(id: string): Promise<CompanionThread[]> { return (await (await request(`/profiles/${encodeURIComponent(id)}/threads`)).json()).threads }
export async function streamCompanion(id: string, message: string, model: string, sessionId: string | null, handlers: ChatStreamHandlers, signal?: AbortSignal) {
  try {
    const res = await request(`/profiles/${encodeURIComponent(id)}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, model, session_id: sessionId }), signal })
    let completed = false
    await readSseStream(res, ({ event, data }) => {
      const value = JSON.parse(data)
      if (event === 'session') handlers.onSession?.(value.session_id)
      else if (event === 'thinking') handlers.onThinking?.(value.content)
      else if (event === 'token') handlers.onToken?.(value.content)
      else if (event === 'question') { completed = true; handlers.onQuestion?.(value.question) }
      else if (event === 'done') { completed = true; handlers.onDone?.(value) }
    }, 45000)
    if (!completed) throw new Error('The response was interrupted. Please try again.')
  } catch (error) {
    if ((error as { name?: string }).name !== 'AbortError') handlers.onError?.(error instanceof Error ? error : new Error('Could not send message.'))
  }
}
