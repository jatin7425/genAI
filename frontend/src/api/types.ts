export type ProviderIssue = { code: string; message: string; model?: string; retry_after_seconds?: number | null }

export type ChatDoneStatus = 'done' | 'error' | 'max_iterations'

export type ChatDonePayload = {
  status: ChatDoneStatus
  answer: string | null
  sources: string[]
  confidence: 'high' | 'medium' | 'low' | 'unknown'
  note?: string
  provider_issue?: ProviderIssue
}

export type ChatStreamHandlers = {
  onSession?: (sessionId: string) => void
  onThinking?: (content: string) => void
  onToken?: (chunk: string) => void
  onQuestion?: (question: string) => void
  onDone?: (payload: ChatDonePayload) => void
  onError?: (error: Error) => void
}
