import { API_V1 } from './config'
import { authFetch } from './http'
import { readSseStream } from './sse'
import type { ServerConversation } from './conversations'

export type ConversationEventHandlers = {
  onUpserted?: (conversation: ServerConversation) => void
  onDeleted?: (sessionId: string) => void
  onChatStarted?: (sessionId: string) => void
  onChatThinking?: (sessionId: string, content: string) => void
  onChatEnded?: (sessionId: string) => void
}

/** Long-lived SSE connection — resolves when the stream ends (error, server restart, etc). */
export async function streamConversationEvents(handlers: ConversationEventHandlers, signal?: AbortSignal): Promise<void> {
  const res = await authFetch(`${API_V1}/conversations/stream`, { signal }, true)
  if (!res.ok || !res.body) throw new Error(`Conversation stream failed: ${res.status}`)

  await readSseStream(res, ({ event, data }) => {
    const payload = JSON.parse(data)
    if (event === 'upserted') handlers.onUpserted?.(payload)
    else if (event === 'deleted') handlers.onDeleted?.(payload.session_id)
    else if (event === 'chat_started') handlers.onChatStarted?.(payload.session_id)
    else if (event === 'chat_thinking') handlers.onChatThinking?.(payload.session_id, payload.content)
    else if (event === 'chat_ended') handlers.onChatEnded?.(payload.session_id)
  })
}
