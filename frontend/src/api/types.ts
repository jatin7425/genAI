export type ChatDoneStatus = 'done' | 'error' | 'max_iterations'

export type ChatDonePayload = {
  status: ChatDoneStatus
  answer: string | null
  sources: string[]
  confidence: 'high' | 'medium' | 'low' | 'unknown'
  note?: string
}

export type ChatStreamHandlers = {
  onSession?: (sessionId: string) => void
  onThinking?: (content: string) => void
  onQuestion?: (question: string) => void
  onDone?: (payload: ChatDonePayload) => void
  onError?: (error: Error) => void
}
