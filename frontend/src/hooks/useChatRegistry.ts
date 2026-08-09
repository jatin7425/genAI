import { useCallback, useRef, useState } from 'react'
import { streamChat } from '../api/chat'
import type { ChatDonePayload } from '../api/types'
import { stripToolTagWrapper } from '../utils/text'

export type ChatTurn =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'agent'; id: string; text: string; status: ChatDonePayload['status'] }
  | { kind: 'question'; id: string; text: string }

let idCounter = 0
const nextId = () => `turn-${++idCounter}`

export type ConversationRuntime = {
  sessionId: string | null
  persona: string
  model: string | null
  turns: ChatTurn[]
  thinking: string[]
  status: 'idle' | 'streaming'
  awaitingAnswer: boolean
}

const EMPTY_RUNTIME = (persona: string, model: string | null = null): ConversationRuntime => ({
  sessionId: null,
  persona,
  model,
  turns: [],
  thinking: [],
  status: 'idle',
  awaitingAnswer: false,
})

/** Drops the last user turn and everything after it — used by both "edit my last
 * message" (resend with different text) and "retry" (resend the same text). */
function truncateBeforeLastUserTurn(turns: ChatTurn[]): ChatTurn[] {
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].kind === 'user') return turns.slice(0, i)
  }
  return turns
}

/**
 * Keeps one ConversationRuntime per conversation "key" (a temp client id until the
 * backend assigns a real session_id, then the session_id itself). Streams are never
 * aborted when the user switches which conversation is on screen — each keeps
 * receiving events and updating its own entry in the background; the UI just reads
 * whichever entry is currently active.
 *
 * Sessions this browser did NOT originate can also be marked "live" via
 * markRemoteStreaming/appendRemoteThinking/clearRemoteStreaming, fed by the
 * server's broadcast of another browser's in-flight chat. `locallyDrivenRef`
 * tracks which sessions THIS browser's own sendMessage is driving, so a remote
 * echo of our own request never overwrites the more up-to-date local state.
 */
export function useChatRegistry() {
  const [registry, setRegistry] = useState<Record<string, ConversationRuntime>>({})
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const locallyDrivenRef = useRef<Set<string>>(new Set())

  const startNewChat = useCallback(() => {
    setActiveKey(null)
  }, [])

  const openConversation = useCallback((sessionId: string, persona: string, model: string | null, turns: ChatTurn[]) => {
    setRegistry((prev) => {
      if (prev[sessionId]?.status === 'streaming') return prev // don't clobber an in-flight stream
      return { ...prev, [sessionId]: { sessionId, persona, model, turns, thinking: [], status: 'idle', awaitingAnswer: false } }
    })
    setActiveKey(sessionId)
  }, [])

  const sendMessage = useCallback(
    (text: string, persona: string, model: string | null, options?: { retry?: boolean }) => {
      const trimmed = text.trim()
      if (!trimmed) return

      const key = activeKey ?? crypto.randomUUID()
      if (activeKey === null) setActiveKey(key)

      setRegistry((prev) => {
        const base = prev[key] ?? EMPTY_RUNTIME(persona, model)
        if (base.status === 'streaming') return prev
        const baseTurns = options?.retry ? truncateBeforeLastUserTurn(base.turns) : base.turns
        return {
          ...prev,
          [key]: {
            ...base,
            model: model ?? base.model,
            turns: [...baseTurns, { kind: 'user', id: nextId(), text: trimmed }],
            thinking: [],
            status: 'streaming',
          },
        }
      })

      let effectiveKey = key
      locallyDrivenRef.current.add(effectiveKey)
      const controller = new AbortController()

      const patch = (updater: (r: ConversationRuntime) => ConversationRuntime) => {
        setRegistry((prev) => {
          const current = prev[effectiveKey]
          if (!current) return prev
          return { ...prev, [effectiveKey]: updater(current) }
        })
      }

      const finishLocalDrive = () => locallyDrivenRef.current.delete(effectiveKey)

      void streamChat(
        { sessionId: registry[key]?.sessionId ?? null, message: trimmed, persona, model, retry: options?.retry },
        {
          onSession: (newSessionId) => {
            // capture the pre-rekey key now — `effectiveKey` is mutated synchronously
            // below, but the setRegistry updater below runs later (React defers it),
            // so it would otherwise see the already-mutated value instead of the old one.
            const oldKey = effectiveKey
            setRegistry((prev) => {
              if (oldKey === newSessionId) return prev
              const entry = prev[oldKey]
              if (!entry) return prev
              const rest = { ...prev }
              delete rest[oldKey]
              return { ...rest, [newSessionId]: { ...entry, sessionId: newSessionId } }
            })
            setActiveKey((prevActive) => (prevActive === oldKey ? newSessionId : prevActive))
            locallyDrivenRef.current.delete(oldKey)
            locallyDrivenRef.current.add(newSessionId)
            effectiveKey = newSessionId
          },
          onThinking: (content) => {
            patch((r) => ({ ...r, thinking: [...r.thinking, content] }))
          },
          onQuestion: (question) => {
            patch((r) => ({
              ...r,
              turns: [...r.turns, { kind: 'question', id: nextId(), text: question }],
              awaitingAnswer: true,
              status: 'idle',
            }))
            finishLocalDrive()
          },
          onDone: (payload) => {
            patch((r) => ({
              ...r,
              turns: [
                ...r.turns,
                {
                  kind: 'agent',
                  id: nextId(),
                  text: stripToolTagWrapper(payload.answer ?? payload.note ?? 'The agent did not return an answer.'),
                  status: payload.status,
                },
              ],
              awaitingAnswer: false,
              status: 'idle',
            }))
            finishLocalDrive()
          },
          onError: (error) => {
            patch((r) => ({
              ...r,
              turns: [...r.turns, { kind: 'agent', id: nextId(), text: `Request failed: ${error.message}`, status: 'error' }],
              status: 'idle',
            }))
            finishLocalDrive()
          },
        },
        controller.signal,
      )
    },
    [activeKey, registry],
  )

  const markRemoteStreaming = useCallback((sessionId: string) => {
    if (locallyDrivenRef.current.has(sessionId)) return
    setRegistry((prev) => {
      const existing = prev[sessionId]
      if (existing) {
        if (existing.status === 'streaming') return prev
        return { ...prev, [sessionId]: { ...existing, status: 'streaming', thinking: [] } }
      }
      return { ...prev, [sessionId]: { ...EMPTY_RUNTIME(''), sessionId, status: 'streaming' } }
    })
  }, [])

  const appendRemoteThinking = useCallback((sessionId: string, content: string) => {
    if (locallyDrivenRef.current.has(sessionId)) return
    setRegistry((prev) => {
      const entry = prev[sessionId]
      if (!entry) return prev
      return { ...prev, [sessionId]: { ...entry, thinking: [...entry.thinking, content] } }
    })
  }, [])

  const clearRemoteStreaming = useCallback((sessionId: string) => {
    if (locallyDrivenRef.current.has(sessionId)) return
    setRegistry((prev) => {
      const entry = prev[sessionId]
      if (!entry || entry.status !== 'streaming') return prev
      return { ...prev, [sessionId]: { ...entry, status: 'idle' } }
    })
  }, [])

  // The final saved turns for a session (from another browser's completed chat) only
  // need to land here if we're already tracking that session (open, or marked live) —
  // otherwise it's just sidebar-list data with nothing on-screen to refresh.
  //
  // Content equality (not just an early bail-out) matters here: this also fires as an
  // echo of THIS browser's own save (local save -> server broadcast -> back to us), and
  // swapping in a fresh-but-identical `turns` array would change the registry's object
  // identity, which the App-level save effect uses to decide "something changed" — an
  // unconditional overwrite here would re-trigger that save, which re-broadcasts, which
  // re-arrives here, forever. Skipping when nothing actually changed breaks that loop.
  const syncRemoteTurns = useCallback((sessionId: string, persona: string, model: string | null, turns: ChatTurn[]) => {
    if (locallyDrivenRef.current.has(sessionId)) return
    setRegistry((prev) => {
      const entry = prev[sessionId]
      if (!entry) return prev
      const unchanged =
        entry.persona === persona && entry.model === model && JSON.stringify(entry.turns) === JSON.stringify(turns)
      if (unchanged && entry.status === 'idle' && entry.thinking.length === 0) return prev
      return {
        ...prev,
        [sessionId]: { ...entry, persona, model, turns: unchanged ? entry.turns : turns, status: 'idle', thinking: [] },
      }
    })
  }, [])

  const active = activeKey ? registry[activeKey] : null
  const streamingSessionIds = new Set(
    Object.values(registry)
      .filter((r) => r.status === 'streaming' && r.sessionId)
      .map((r) => r.sessionId as string),
  )

  return {
    registry,
    activeKey,
    active,
    streamingSessionIds,
    startNewChat,
    openConversation,
    sendMessage,
    markRemoteStreaming,
    appendRemoteThinking,
    clearRemoteStreaming,
    syncRemoteTurns,
  }
}
