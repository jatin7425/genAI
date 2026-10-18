import { API_V1 } from './config'
import { authFetch } from './http'

export type StoryCharacter = { name: string; description: string }

export type Story = {
  session_id: string
  title: string
  premise: string
  /** Empty when the user guides the narrator without being in the story. */
  user_role: string
  characters: StoryCharacter[]
  updated_at?: string
}

export type StoryDraft = {
  description?: string
  title?: string
  premise?: string
  user_role?: string
  characters?: StoryCharacter[]
  model?: string | null
}

const url = (sessionId: string, path = '') => `${API_V1}/stories/${encodeURIComponent(sessionId)}${path}`

async function storyRequest(target: string, init: RequestInit = {}, hideLoader = true): Promise<Story | null> {
  const res = await authFetch(target, { ...init, headers: init.body ? { 'Content-Type': 'application/json' } : undefined }, hideLoader)
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(typeof data?.detail === 'string' ? data.detail : 'The story could not be updated. Try again.')
  return data?.story ?? null
}

export const fetchStory = (sessionId: string) => storyRequest(url(sessionId))

/** Shows the global loader: drafting from a description waits on the model. */
export const createStory = (sessionId: string, draft: StoryDraft) =>
  storyRequest(url(sessionId), { method: 'POST', body: JSON.stringify(draft) }, false) as Promise<Story>

export const updateStory = (sessionId: string, fields: Partial<Pick<Story, 'title' | 'premise' | 'user_role'>>) =>
  storyRequest(url(sessionId), { method: 'PATCH', body: JSON.stringify(fields) }) as Promise<Story>

export const saveCharacter = (sessionId: string, character: StoryCharacter, originalName?: string) =>
  storyRequest(url(sessionId, '/characters'), { method: 'PUT', body: JSON.stringify({ ...character, original_name: originalName }) }) as Promise<Story>

export const removeCharacter = (sessionId: string, name: string) =>
  storyRequest(url(sessionId, `/characters/${encodeURIComponent(name)}`), { method: 'DELETE' }) as Promise<Story>
