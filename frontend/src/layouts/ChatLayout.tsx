import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { PersonaSwitcher } from '../components/persona/PersonaSwitcher'
import { CreatePersonaModal } from '../components/persona/CreatePersonaModal'
import { ModelSwitcher } from '../components/chat/ModelSwitcher'
import { useChatRegistry, type ChatTurn } from '../hooks/useChatRegistry'
import { useConversationHistory, type StoredConversation } from '../hooks/useConversationHistory'
import { useAuth } from '../hooks/useAuth'

const DEFAULT_PERSONA = 'Default Assistant'

export type ChatOutletContext = {
  onSend: (text: string) => void
  onSelectPrompt: (title: string) => void
  onEditLastMessage: (newText: string) => void
  onRetry: () => void
  injectOlderTurns: (sessionId: string, olderTurns: ChatTurn[]) => void
  turns: ChatTurn[]
  thinking: string[]
  status: 'idle' | 'streaming'
  awaitingAnswer: boolean
  isReady: boolean
}

export function ChatLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { sessionId: urlSessionId } = useParams<{ sessionId?: string }>()

  const [activePersona, setActivePersona] = useState(DEFAULT_PERSONA)
  const [activeModel, setActiveModel] = useState<string | null>(null)
  const [personaModalOpen, setPersonaModalOpen] = useState(false)
  const [personaRefreshKey, setPersonaRefreshKey] = useState(0)

  const {
    activeKey,
    active,
    streamingSessionIds,
    startNewChat,
    openConversation,
    sendMessage,
    injectOlderTurns,
    markRemoteStreaming,
    appendRemoteThinking,
    clearRemoteStreaming,
    syncRemoteTurns,
    clearDirty,
  } = useChatRegistry()

  const {
    conversations,
    upsert,
    remove,
    loadMore,
    hasMore,
    isLoadingMore
  } = useConversationHistory({
    onChatStarted: markRemoteStreaming,
    onChatThinking: appendRemoteThinking,
    onChatEnded: clearRemoteStreaming,
    onConversationUpserted: syncRemoteTurns,
  })

  // On every change to the ACTIVE chat, persist it to the server.
  // (We skip saving truly empty chats until they have at least 1 turn).
  useEffect(() => {
    if (activeKey && active && active.dirty) {
      if (active.turns.length > 0) {
        upsert(activeKey, active.persona, active.model, active.turns)
      }
      clearDirty(activeKey)
    }
  }, [activeKey, active, upsert, clearDirty])

  // Sync URL → registry:
  //   /chat            → clear the active key (new chat state)
  //   /chat/:sessionId → open that conversation from history (deep link / Back button)
  useEffect(() => {
    if (!urlSessionId) {
      startNewChat()
      return
    }
    if (activeKey === urlSessionId) return
    const stored = conversations.find((c) => c.sessionId === urlSessionId)
    if (stored) {
      openConversation(stored.sessionId, stored.persona, stored.model, stored.turns)
    }
  }, [urlSessionId, conversations]) // eslint-disable-line react-hooks/exhaustive-deps

  // Registry-based persistence is handled by active.dirty effect above.

  const effectivePersona = active?.persona ?? activePersona
  const effectiveModel = active?.model ?? activeModel

  // Registry → URL: when the backend assigns a real sessionId (or when we switch
  // conversations via openConversation), push/replace the URL to match.
  // Uses location.pathname from the router (not window.location) to avoid stale reads.
  // We use a ref so the effect dep is only `activeKey` — avoids a loop where changing
  // the URL causes the effect to re-run unnecessarily.
  const locationPathnameRef = useRef(location.pathname)
  locationPathnameRef.current = location.pathname

  useEffect(() => {
    if (!activeKey) return
    const target = `/chat/${activeKey}`
    if (locationPathnameRef.current === target) return
    // replace:true when coming from /chat (new chat) so the temp /chat entry
    // doesn't litter the history stack; push otherwise.
    const isNewChatOrigin = locationPathnameRef.current === '/chat'
    navigate(target, { replace: isNewChatOrigin })
  }, [activeKey, navigate])

  // Called from the SideNav "New Chat" button. Navigation itself is handled by
  // <NavLink to="/chat"> inside SideNav, so here we only reset state.
  const handleNewChat = () => {
    startNewChat()
  }

  // Called from the SideNav conversation list. Navigation is handled by the Link
  // inside SideNav; we only need to load the turns into the registry.
  const handleOpenConversation = (conversation: StoredConversation) => {
    openConversation(conversation.sessionId, conversation.persona, conversation.model, conversation.turns)
  }

  const handleEditLastMessage = (newText: string) => {
    sendMessage(newText, effectivePersona, effectiveModel, { retry: true })
  }

  const handleRetry = () => {
    if (!active) return
    const lastUserTurn = [...active.turns].reverse().find((t) => t.kind === 'user')
    if (!lastUserTurn) return
    sendMessage(lastUserTurn.text, effectivePersona, effectiveModel, { retry: true })
  }

  const outletContext: ChatOutletContext = {
    onSend: (text) => sendMessage(text, effectivePersona, effectiveModel),
    onSelectPrompt: (title) => sendMessage(title, effectivePersona, effectiveModel),
    onEditLastMessage: handleEditLastMessage,
    onRetry: handleRetry,
    injectOlderTurns: (sessionId, olderTurns) => {
      injectOlderTurns(sessionId, olderTurns)
    },
    turns: active?.turns ?? [],
    thinking: active?.thinking ?? [],
    status: active?.status ?? 'idle',
    awaitingAnswer: active?.awaitingAnswer ?? false,
    isReady: !!active && activeKey === urlSessionId,
  }

  const { logout } = useAuth()

  return (
    <div className="h-dvh w-screen relative">
      <AppShell
        conversations={conversations}
        hasMoreConversations={hasMore}
        isLoadingMoreConversations={isLoadingMore}
        onLoadMoreConversations={loadMore}
        activeSessionId={activeKey}
        streamingSessionIds={streamingSessionIds}
        onOpenConversation={handleOpenConversation}
        onDeleteConversation={remove}
        onNewChat={handleNewChat}
        onLogout={logout}
        onSettings={() => navigate('/settings')}
        headerRightSlot={
          <div className="flex items-center gap-1 md:gap-3">
            <ModelSwitcher activeModel={effectiveModel} onSelectModel={setActiveModel} />
            <PersonaSwitcher
              activePersona={effectivePersona}
              refreshKey={personaRefreshKey}
              onSelectPersona={setActivePersona}
              onCreateNew={() => setPersonaModalOpen(true)}
            />
          </div>
        }
      >
        <Outlet context={outletContext} />
      </AppShell>

      {personaModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-stack-md bg-black/60">
          <CreatePersonaModal
            onClose={() => setPersonaModalOpen(false)}
            onCreated={(name) => {
              setPersonaRefreshKey((k) => k + 1)
              setActivePersona(name)
              setPersonaModalOpen(false)
            }}
          />
        </div>
      )}
    </div>
  )
}
