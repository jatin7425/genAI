import type { ChatAttachment } from './attachments'
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
  attachments?: ChatAttachment[]
}

export async function streamChat(
  { sessionId, message, persona, model, retry, attachments }: StreamChatRequest,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const res = await authFetch(`${API_V1}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, message, persona, model, retry: retry ?? false, attachment_ids: attachments?.map(file => file.id) ?? [] }),
      signal,
    }, true)

    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => null)
      throw new Error(typeof data?.detail === 'string' ? data.detail : 'The chat request could not be completed. Please try again.')
    }

    let completed = false
    await readSseStream(res, ({ event, data }) => {
      const payload = JSON.parse(data)
      if (event === 'session') handlers.onSession?.(payload.session_id)
      else if (event === 'thinking') handlers.onThinking?.(payload.content)
      else if (event === 'token') handlers.onToken?.(payload.content)
      else if (event === 'model_switched') handlers.onModelSwitched?.(payload)
      else if (event === 'question') { completed = true; handlers.onQuestion?.(payload.question) }
      else if (event === 'done') { completed = true; handlers.onDone?.(payload) }
    }, 45000)
    if (!completed) throw new Error('The connection ended before the response finished. Try again or switch models.')
  } catch (error) {
    if ((error as { name?: string }).name === 'AbortError') return
    handlers.onError?.(error instanceof Error ? error : new Error(String(error)))
  }
}
