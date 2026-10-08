import { useCallback, useRef, useState } from 'react'
import { streamChat } from '../api/chat'
import type { ChatDonePayload } from '../api/types'
import { stripToolTagWrapper } from '../utils/text'

export type ChatTurn =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'agent'; id: string; text: string; status: ChatDonePayload['status']; streaming?: boolean }
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
  dirty: boolean
}

const EMPTY_RUNTIME = (persona: string, model: string | null = null): ConversationRuntime => ({
  sessionId: null,
  persona,
  model,
  turns: [],
  thinking: [],
  status: 'idle',
  awaitingAnswer: false,
  dirty: false,
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
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())

  const startNewChat = useCallback(() => {
    setActiveKey(null)
  }, [])

  const openConversation = useCallback((sessionId: string, persona: string, model: string | null, turns: ChatTurn[]) => {
    setRegistry((prev) => {
      if (prev[sessionId]?.status === 'streaming') return prev // don't clobber an in-flight stream
      return { ...prev, [sessionId]: { sessionId, persona, model, turns, thinking: [], status: 'idle', awaitingAnswer: false, dirty: false } }
    })
    setActiveKey(sessionId)
  }, [])

  const stopMessage = useCallback((sessionId: string) => {
    const controller = abortControllersRef.current.get(sessionId)
    if (controller) {
      controller.abort()
      abortControllersRef.current.delete(sessionId)
      
      setRegistry((prev) => {
        const entry = prev[sessionId]
        if (!entry) return prev
        return {
          ...prev,
          [sessionId]: {
            ...entry,
            status: 'idle',
            turns: [...entry.turns, { kind: 'agent', id: nextId(), text: '\n\n*Stream stopped.*', status: 'done', streaming: false }],
            dirty: true,
          }
        }
      })
      locallyDrivenRef.current.delete(sessionId)
    }
  }, [])

  const sendMessage = useCallback(
    (text: string, persona: string, model: string | null, options?: { retry?: boolean }) => {
      const trimmed = text.trim()
      if (!trimmed) return

      const key = activeKey ?? crypto.randomUUID()
      if (activeKey === null) setActiveKey(key)

      const controller = new AbortController()
      abortControllersRef.current.set(key, controller)

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
            dirty: true,
          },
        }
      })

      let effectiveKey = key
      locallyDrivenRef.current.add(effectiveKey)

      const patch = (updater: (r: ConversationRuntime) => ConversationRuntime) => {
        setRegistry((prev) => {
          const current = prev[effectiveKey]
          if (!current) return prev
          return { ...prev, [effectiveKey]: updater(current) }
        })
      }

      const finishLocalDrive = () => {
        locallyDrivenRef.current.delete(effectiveKey)
        abortControllersRef.current.delete(effectiveKey)
      }

      let streamingTurnId: string | null = null

      void streamChat(
        { sessionId: registry[key]?.sessionId ?? key, message: trimmed, persona, model, retry: options?.retry },
        {
          onSession: (newSessionId) => {
            const oldKey = effectiveKey
            setRegistry((prev) => {
              if (oldKey === newSessionId) return prev
              const entry = prev[oldKey]
              if (!entry) return prev
              const rest = { ...prev }
              delete rest[oldKey]
              return { ...rest, [newSessionId]: { ...entry, sessionId: newSessionId, dirty: true } }
            })
            setActiveKey((prevActive) => (prevActive === oldKey ? newSessionId : prevActive))
            locallyDrivenRef.current.delete(oldKey)
            locallyDrivenRef.current.add(newSessionId)
            
            const oldController = abortControllersRef.current.get(oldKey)
            if (oldController) {
               abortControllersRef.current.set(newSessionId, oldController)
               abortControllersRef.current.delete(oldKey)
            }
            
            effectiveKey = newSessionId
          },
          onThinking: (content) => {
            patch((r) => ({ ...r, thinking: [...r.thinking, content] }))
          },
          onToken: (chunk) => {
            if (!streamingTurnId) {
              const id = nextId()
              streamingTurnId = id
              patch((r) => ({
                ...r,
                thinking: [], // clear thinking trace once tokens start flowing
                turns: [...r.turns, { kind: 'agent', id, text: chunk, status: 'done', streaming: true }],
              }))
            } else {
              // Subsequent tokens — append to the existing streaming turn
              const targetId = streamingTurnId
              patch((r) => ({
                ...r,
                turns: r.turns.map((t) =>
                  t.kind === 'agent' && t.id === targetId
                    ? { ...t, text: t.text + chunk }
                    : t,
                ),
              }))
            }
          },
          onQuestion: (question) => {
            patch((r) => ({
              ...r,
              turns: [...r.turns, { kind: 'question', id: nextId(), text: question }],
              awaitingAnswer: true,
              status: 'idle',
              dirty: true,
            }))
            finishLocalDrive()
          },
          onDone: (payload) => {
            const isError = payload.status === 'error'
            const targetId = streamingTurnId
            patch((r) => {
              if (targetId) {
                const streamed = r.turns.find((t) => t.kind === 'agent' && t.id === targetId)
                const streamedText = streamed && streamed.kind === 'agent' ? streamed.text : ''
                // On failure, keep whatever already streamed instead of overwriting it with
                // the raw backend error (payload.note) — the turn's error status already
                // surfaces a Retry affordance. Only fall back to a generic message if
                // nothing streamed at all.
                const finalText = isError
                  ? streamedText.trim() || "Something went wrong generating a response."
                  : stripToolTagWrapper(payload.answer ?? payload.note ?? 'The agent did not return an answer.')
                // Replace the streaming turn in-place with the finalized version
                return {
                  ...r,
                  turns: r.turns.map((t) =>
                    t.kind === 'agent' && t.id === targetId
                      ? { ...t, text: finalText, status: payload.status, streaming: false }
                      : t,
                  ),
                  awaitingAnswer: false,
                  status: 'idle',
                  dirty: true,
                }
              }
              // Fallback: no streaming turns received (e.g. tool-only response, or an
              // error before any tokens arrived)
              const finalText = isError
                ? "Something went wrong generating a response."
                : stripToolTagWrapper(payload.answer ?? payload.note ?? 'The agent did not return an answer.')
              return {
                ...r,
                turns: [
                  ...r.turns,
                  { kind: 'agent', id: nextId(), text: finalText, status: payload.status },
                ],
                awaitingAnswer: false,
                status: 'idle',
                dirty: true,
              }
            })
            finishLocalDrive()
          },
          onError: (error) => {
            patch((r) => ({
              ...r,
              turns: [...r.turns, { kind: 'agent', id: nextId(), text: `Request failed: ${error.message}`, status: 'error' }],
              status: 'idle',
              dirty: true,
            }))
            finishLocalDrive()
          },
        },
        controller.signal,
      )
    },
    [activeKey, registry],
  )

  const injectOlderTurns = useCallback((sessionId: string, olderTurns: ChatTurn[]) => {
    setRegistry((prev) => {
      const entry = prev[sessionId]
      if (!entry) return prev
      
      // To avoid duplicates, filter out turns we already have
      const existingIds = new Set(entry.turns.map(t => t.id))
      const newTurns = olderTurns.filter(t => !existingIds.has(t.id))
      
      if (newTurns.length === 0) return prev
      
      return {
        ...prev,
        [sessionId]: { ...entry, turns: [...newTurns, ...entry.turns] }
      }
    })
  }, [])

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

  const clearDirty = useCallback((sessionId: string) => {
    setRegistry((prev) => {
      const entry = prev[sessionId]
      if (!entry || !entry.dirty) return prev
      return { ...prev, [sessionId]: { ...entry, dirty: false } }
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
    stopMessage,
    injectOlderTurns,
    markRemoteStreaming,
    appendRemoteThinking,
    clearRemoteStreaming,
    syncRemoteTurns,
    clearDirty,
  }
}
