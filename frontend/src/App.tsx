import { useEffect, useRef, useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import type { NavKey } from './components/layout/SideNav'
import { NewChatScreen } from './screens/NewChatScreen'
import { ChatConversationScreen } from './screens/ChatConversationScreen'
import { LoginScreen } from './screens/LoginScreen'
import { PersonaSwitcher } from './components/persona/PersonaSwitcher'
import { CreatePersonaModal } from './components/persona/CreatePersonaModal'
import { ModelSwitcher } from './components/chat/ModelSwitcher'
import { useChatRegistry, type ChatTurn } from './hooks/useChatRegistry'
import { useConversationHistory, type StoredConversation } from './hooks/useConversationHistory'
import { useAuth } from './hooks/useAuth'

const DEFAULT_PERSONA = 'Default Assistant'

function AuthenticatedApp({ onLogout }: { onLogout: () => void }) {
  const [navKey, setNavKey] = useState<NavKey>('new-chat')
  const [activePersona, setActivePersona] = useState(DEFAULT_PERSONA)
  const [activeModel, setActiveModel] = useState<string | null>(null)
  const [personaModalOpen, setPersonaModalOpen] = useState(false)
  const [personaRefreshKey, setPersonaRefreshKey] = useState(0)

  const {
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
  } = useChatRegistry()
  const { conversations, upsert, remove } = useConversationHistory({
    onChatStarted: markRemoteStreaming,
    onChatThinking: appendRemoteThinking,
    onChatEnded: clearRemoteStreaming,
    onConversationUpserted: syncRemoteTurns,
  })

  // Every conversation keeps streaming in the background regardless of which one is
  // on screen, so persist all of them (not just the active one) whenever anything changes.
  // Skip conversations whose `turns` array is unchanged (e.g. a "thinking" trace update) —
  // upsert now hits a real network endpoint, so only fire it when there's actually new
  // content to save, not on every intermediate streaming event.
  const lastSyncedTurns = useRef<Record<string, ChatTurn[]>>({})
  useEffect(() => {
    for (const runtime of Object.values(registry)) {
      if (!runtime.sessionId || runtime.turns.length === 0) continue
      if (lastSyncedTurns.current[runtime.sessionId] === runtime.turns) continue
      lastSyncedTurns.current[runtime.sessionId] = runtime.turns
      upsert(runtime.sessionId, runtime.persona, runtime.model, runtime.turns)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry])

  const effectivePersona = active?.persona ?? activePersona
  const effectiveModel = active?.model ?? activeModel

  const handleNewChat = () => {
    startNewChat()
    setNavKey('new-chat')
  }

  const handleOpenConversation = (conversation: StoredConversation) => {
    openConversation(conversation.sessionId, conversation.persona, conversation.model, conversation.turns)
    setNavKey('recent')
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

  return (
    <div className="h-dvh w-screen relative">
      <AppShell
        activeNav={navKey}
        onSelectNav={(key) => {
          setNavKey(key)
          if (key === 'new-chat') handleNewChat()
        }}
        conversations={conversations}
        activeSessionId={activeKey}
        streamingSessionIds={streamingSessionIds}
        onOpenConversation={handleOpenConversation}
        onDeleteConversation={remove}
        onLogout={onLogout}
        headerRightSlot={
          <div className="flex items-center">
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
        {!active ? (
          <NewChatScreen
            onSend={(text) => sendMessage(text, effectivePersona, effectiveModel)}
            onSelectPrompt={(title) => sendMessage(title, effectivePersona, effectiveModel)}
          />
        ) : (
          <ChatConversationScreen
            turns={active.turns}
            thinking={active.thinking}
            status={active.status}
            awaitingAnswer={active.awaitingAnswer}
            onSend={(text) => sendMessage(text, effectivePersona, effectiveModel)}
            onEditLastMessage={handleEditLastMessage}
            onRetry={handleRetry}
          />
        )}
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

function App() {
  const { isAuthenticated, login, logout } = useAuth()

  if (!isAuthenticated) {
    return <LoginScreen onLogin={login} />
  }

  return <AuthenticatedApp onLogout={logout} />
}

export default App
