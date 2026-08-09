import { API_V1 } from './config'
import { authFetch } from './http'
import type { ChatTurn } from '../hooks/useChatRegistry'

export type ServerConversation = {
  session_id: string
  persona: string
  model: string | null
  title: string
  turns: ChatTurn[]
  updated_at: string
}

export async function fetchConversations(): Promise<ServerConversation[]> {
  const res = await authFetch(`${API_V1}/conversations`)
  if (!res.ok) throw new Error(`Failed to fetch conversations: ${res.status}`)
  const data: { conversations: ServerConversation[] } = await res.json()
  return data.conversations
}

export async function upsertConversation(
  sessionId: string,
  persona: string,
  model: string | null,
  turns: ChatTurn[],
): Promise<void> {
  const res = await authFetch(`${API_V1}/conversations/${encodeURIComponent(sessionId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ persona, model, turns }),
  })
  if (!res.ok) throw new Error(`Failed to save conversation: ${res.status}`)
}

export async function deleteConversation(sessionId: string): Promise<void> {
  const res = await authFetch(`${API_V1}/conversations/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete conversation: ${res.status}`)
}
