import { API_V1 } from './config'
import { authFetch } from './http'
import { readSseStream } from './sse'
import type { ChatStreamHandlers } from './types'

export type StreamChatRequest = {
  sessionId: string | null
  message: string
  persona?: string | null
  model?: string | null
  retry?: boolean
}

export async function streamChat(
  { sessionId, message, persona, model, retry }: StreamChatRequest,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const res = await authFetch(`${API_V1}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, message, persona, model, retry: retry ?? false }),
      signal,
    })

    if (!res.ok || !res.body) {
      throw new Error(`Chat request failed: ${res.status}`)
    }

    await readSseStream(res, ({ event, data }) => {
      const payload = JSON.parse(data)
      if (event === 'session') handlers.onSession?.(payload.session_id)
      else if (event === 'thinking') handlers.onThinking?.(payload.content)
      else if (event === 'question') handlers.onQuestion?.(payload.question)
      else if (event === 'done') handlers.onDone?.(payload)
    })
  } catch (error) {
    if ((error as { name?: string }).name === 'AbortError') return
    handlers.onError?.(error instanceof Error ? error : new Error(String(error)))
  }
}
