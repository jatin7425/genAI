import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchConversations, upsertConversation, deleteConversation, type ServerConversation } from '../api/conversations'
import { streamConversationEvents } from '../api/conversationEvents'
import { showToast } from '../utils/toastState'
import type { ChatTurn } from './useChatRegistry'

export type StoredConversation = {
  sessionId: string
  persona: string
  model: string | null
  title: string
  turns: ChatTurn[]
  updatedAt: number
}

function fromServer(c: ServerConversation): StoredConversation {
  return {
    sessionId: c.session_id,
    persona: c.persona,
    model: c.model ?? null,
    title: c.title,
    turns: c.turns || [],
    updatedAt: new Date(c.updated_at).getTime(),
  }
}

function uniqueConversations(items: StoredConversation[]): StoredConversation[] {
  const byId = new Map<string, StoredConversation>()
  for (const item of items) {
    const previous = byId.get(item.sessionId)
    if (!previous || item.updatedAt > previous.updatedAt) byId.set(item.sessionId, item)
  }
  return [...byId.values()]
}

const RECONNECT_DELAY_MS = 3000

export type RemoteChatHandlers = {
  onChatStarted?: (sessionId: string) => void
  onChatThinking?: (sessionId: string, content: string) => void
  onChatEnded?: (sessionId: string) => void
  onConversationUpserted?: (sessionId: string, persona: string, model: string | null, turns: ChatTurn[]) => void
}

export function useConversationHistory(remoteChatHandlers: RemoteChatHandlers = {}) {
  const [conversations, setConversations] = useState<StoredConversation[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const paginationOffset = useRef(0)
  const loadingMore = useRef(false)
  
  const remoteChatHandlersRef = useRef(remoteChatHandlers)
  remoteChatHandlersRef.current = remoteChatHandlers

  useEffect(() => {
    const doFetch = () => {
      fetchConversations(0, 20)
        .then((remote) => {
          paginationOffset.current = remote.items.length
          setConversations(uniqueConversations(remote.items.map(fromServer)))
          setHasMore(remote.has_more)
        })
        .catch(() => {
          // best-effort
        })
    }

    doFetch()

    window.addEventListener('api_mutation', doFetch)
    return () => window.removeEventListener('api_mutation', doFetch)
  }, [])

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore.current) return
    loadingMore.current = true
    setIsLoadingMore(true)
    try {
      const res = await fetchConversations(paginationOffset.current, 20)
      paginationOffset.current += res.items.length
      setConversations(prev => uniqueConversations([...prev, ...res.items.map(fromServer)]))
      setHasMore(res.has_more)
    } catch (err) {
      console.error(err)
    } finally {
      loadingMore.current = false
      setIsLoadingMore(false)
    }
  }, [hasMore])

  // Live updates: any browser logged into this account gets pushed changes made by
  // any other one (or by this one), instead of only seeing its own local writes.
  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    const connect = () => {
      if (cancelled) return
      streamConversationEvents(
        {
          onUpserted: (conversation) => {
            const incoming = fromServer(conversation)
            setConversations((prev) => [incoming, ...prev.filter((c) => c.sessionId !== incoming.sessionId)])
            remoteChatHandlersRef.current.onConversationUpserted?.(
              incoming.sessionId,
              incoming.persona,
              incoming.model,
              incoming.turns,
            )
          },
          onTitled: (sessionId, title) => {
            setConversations(prev => prev.map(c => c.sessionId === sessionId ? { ...c, title } : c))
          },
          onDeleted: (sessionId) => {
            setConversations((prev) => prev.filter((c) => c.sessionId !== sessionId))
          },
          onChatStarted: (sessionId) => remoteChatHandlersRef.current.onChatStarted?.(sessionId),
          onChatThinking: (sessionId, content) => remoteChatHandlersRef.current.onChatThinking?.(sessionId, content),
          onChatEnded: (sessionId) => remoteChatHandlersRef.current.onChatEnded?.(sessionId),
        },
        controller.signal,
      )
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setTimeout(connect, RECONNECT_DELAY_MS)
        })
    }
    connect()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  const upsert = useCallback((sessionId: string, persona: string, model: string | null, turns: ChatTurn[]) => {
    if (turns.length === 0) return

    setConversations((prev) => {
      const existing = prev.find((c) => c.sessionId === sessionId)
      const updated: StoredConversation = {
        sessionId,
        persona,
        model,
        title: existing?.title ?? deriveTitle(turns),
        turns,
        updatedAt: Date.now(),
      }
      const rest = prev.filter((c) => c.sessionId !== sessionId)
      return [updated, ...rest]
    })

    void upsertConversation(sessionId, persona, model, turns).catch(() => {})
  }, [])

  const remove = useCallback((sessionId: string) => {
    let removed: StoredConversation | undefined
    setConversations((prev) => {
      removed = prev.find((c) => c.sessionId === sessionId)
      return prev.filter((c) => c.sessionId !== sessionId)
    })

    deleteConversation(sessionId)
      .then(() => showToast('Conversation deleted.', 'success'))
      .catch(() => {
        showToast('Failed to delete conversation. It has been restored.', 'error')
        const restored = removed
        if (restored) {
          setConversations((prev) => (prev.some((c) => c.sessionId === restored.sessionId) ? prev : [restored, ...prev]))
        }
      })
  }, [])

  const sorted = uniqueConversations(conversations).sort((a, b) => b.updatedAt - a.updatedAt)

  return { conversations: sorted, upsert, remove, loadMore, hasMore, isLoadingMore }
}

function deriveTitle(turns: ChatTurn[]): string {
  const firstUserTurn = turns.find((t) => t.kind === 'user')
  if (!firstUserTurn) return 'New conversation'
  const text = firstUserTurn.text.trim()
  return text.length > 60 ? `${text.slice(0, 60)}...` : text
}
