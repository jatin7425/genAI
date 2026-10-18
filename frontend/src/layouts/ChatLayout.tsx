import type { ProviderIssue } from '../api/types'
import type { ChatAttachment } from '../api/attachments'
import { Suspense, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { PersonaSwitcher } from '../components/persona/PersonaSwitcher'
import { CreatePersonaModal } from '../components/persona/CreatePersonaModal'
import { ModelSwitcher } from '../components/chat/ModelSwitcher'
import { useChatRegistry, type ChatTurn } from '../hooks/useChatRegistry'
import { useConversationHistory, type StoredConversation } from '../hooks/useConversationHistory'
import { useAuth } from '../hooks/useAuth'
import { Icon } from '../components/Icon'
import { CreateStoryModal } from '../components/story/CreateStoryModal'
import { StoryPanel } from '../components/story/StoryPanel'
import { createStory, fetchStory, removeCharacter, saveCharacter, updateStory, type Story, type StoryDraft } from '../api/stories'
import { showToast } from '../utils/toastState'

const DEFAULT_PERSONA = 'Default Assistant'

export type ChatOutletContext = {
  onSend: (text: string, attachments?: ChatAttachment[]) => void
  onStop: () => void
  onSelectPrompt: (title: string) => void
  onEditLastMessage: (newText: string) => void
  onRetry: () => void
  injectOlderTurns: (sessionId: string, olderTurns: ChatTurn[]) => void
  turns: ChatTurn[]
  thinking: string[]
  status: 'idle' | 'streaming'
  awaitingAnswer: boolean
  isReady: boolean
  providerIssue?: ProviderIssue
  storyMode: boolean
}

const STORY_COMMAND = /^\/createstory(?:\s+|$)/i
const STORY_KICKOFF = 'Begin the story.'

export function ChatLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { sessionId: urlSessionId } = useParams<{ sessionId?: string }>()

  const [activePersona, setActivePersona] = useState(DEFAULT_PERSONA)
  const [activeModel, setActiveModel] = useState<string | null>(null)
  const [personaModalOpen, setPersonaModalOpen] = useState(false)
  const [editPersonaName, setEditPersonaName] = useState<string | undefined>()
  const [personaRefreshKey, setPersonaRefreshKey] = useState(0)
  const [story, setStory] = useState<Story | null>(null)
  const [storyOpen, setStoryOpen] = useState(() => window.matchMedia?.('(min-width: 768px)').matches ?? true)
  const [storyModal, setStoryModal] = useState<{ idea: string } | null>(null)

  const {
    activeKey,
    active,
    streamingSessionIds,
    startNewChat,
    openConversation,
    sendMessage,
    selectModel,
    stopMessage,
    injectOlderTurns,
    markRemoteStreaming,
    appendRemoteThinking,
    clearRemoteStreaming,
    syncRemoteTurns,
    clearDirty,
  } = useChatRegistry()

  const activeKeyRef = useRef(activeKey)
  activeKeyRef.current = activeKey

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
    onStoryUpdated: (updated) => { if (updated.session_id === activeKeyRef.current) setStory(updated) },
  })

  // Load the story bible (if any) for whichever conversation is on screen.
  useEffect(() => {
    if (!activeKey) { setStory(null); return }
    let cancelled = false
    setStory(current => current?.session_id === activeKey ? current : null)
    fetchStory(activeKey).then(loaded => { if (!cancelled) setStory(loaded) }).catch(() => {})
    return () => { cancelled = true }
  }, [activeKey])

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

  // Clear the active chat on actual navigation to the new-chat route.
  // History refreshes must not clear an in-flight first message before its
  // session URL has been assigned.
  useEffect(() => {
    if (location.pathname === '/chat') startNewChat()
  }, [location.pathname, startNewChat])

  // Sync URL → registry:
  //   /chat            → clear the active key (new chat state)
  //   /chat/:sessionId → open that conversation from history (deep link / Back button)
  useEffect(() => {
    if (!urlSessionId) return
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
    sendMessage(newText, effectivePersona, effectiveModel, { retry: true, attachments: [...(active?.turns ?? [])].reverse().find(turn => turn.kind === 'user')?.attachments })
  }

  const handleRetry = () => {
    if (!active) return
    const lastUserTurn = [...active.turns].reverse().find((t) => t.kind === 'user')
    if (!lastUserTurn) return
    sendMessage(lastUserTurn.text, effectivePersona, effectiveModel, { retry: true, attachments: lastUserTurn.attachments })
  }

  // The bible is saved under a fresh session id first, so the narrator's very
  // first turn already runs in story mode.
  const startStory = async (draft: StoryDraft) => {
    const sessionId = crypto.randomUUID()
    const created = await createStory(sessionId, { ...draft, model: effectiveModel })
    setStory(created)
    setStoryModal(null)
    if (window.matchMedia?.('(min-width: 768px)').matches) setStoryOpen(true)
    sendMessage(STORY_KICKOFF, effectivePersona, effectiveModel, { sessionId })
  }

  const handleSend = (text: string, attachments?: ChatAttachment[]) => {
    if (!STORY_COMMAND.test(text)) return sendMessage(text, effectivePersona, effectiveModel, { attachments })
    const idea = text.replace(STORY_COMMAND, '').trim()
    if (!idea) return setStoryModal({ idea: '' })
    if (attachments?.length) showToast('Attachments aren’t used when creating a story.', 'info')
    showToast('Setting up your story…', 'info')
    startStory({ description: idea }).catch(error => {
      showToast(error instanceof Error ? error.message : 'The story could not be created.', 'error')
      setStoryModal({ idea })
    })
  }

  const showStory = !!story && story.session_id === activeKey && location.pathname.startsWith('/chat/')
  const applyStory = (request: (sessionId: string) => Promise<Story>) => story ? request(story.session_id).then(setStory) : Promise.resolve()

  const outletContext: ChatOutletContext = {
    onSend: handleSend,
    onStop: () => {
      if (activeKey) stopMessage(activeKey)
    },
    onSelectPrompt: handleSend,
    onEditLastMessage: handleEditLastMessage,
    onRetry: handleRetry,
    injectOlderTurns: (sessionId, olderTurns) => {
      injectOlderTurns(sessionId, olderTurns)
    },
    turns: active?.turns ?? [],
    thinking: active?.thinking ?? [],
    status: active?.status ?? 'idle',
    awaitingAnswer: active?.awaitingAnswer ?? false,
    providerIssue: active?.providerIssue,
    isReady: !!active && activeKey === urlSessionId,
    storyMode: showStory,
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
        onNewStory={() => setStoryModal({ idea: '' })}
        onLogout={logout}
        onSettings={() => navigate('/settings')}
        headerRightSlot={
          <div className="flex items-center gap-1 md:gap-3">
            {showStory && <button onClick={() => setStoryOpen(open => !open)} aria-pressed={storyOpen} title={storyOpen ? 'Hide story cast' : 'Show story cast'} className={`flex items-center gap-1.5 rounded-lg border px-2 sm:px-3 py-2 text-sm transition-colors ${storyOpen ? 'border-primary text-primary bg-primary/5' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-high'}`}><Icon name="group" className="text-[17px]" /><span className="hidden sm:inline">Cast</span></button>}
            <ModelSwitcher activeModel={effectiveModel} disabled={active?.status === 'streaming' || active?.awaitingAnswer} onSelectModel={model => { setActiveModel(model); selectModel(model) }} />
            <PersonaSwitcher
              activePersona={effectivePersona}
              refreshKey={personaRefreshKey}
              onSelectPersona={setActivePersona}
              onEdit={(name) => { setEditPersonaName(name); setPersonaModalOpen(true) }}
              onCreateNew={() => { setEditPersonaName(undefined); setPersonaModalOpen(true) }}
            />
          </div>
        }
      >
        <div className="flex flex-1 min-h-0">
          {showStory && storyOpen && story && <>
            <div className="md:hidden fixed inset-0 z-30 bg-black/50" onClick={() => setStoryOpen(false)} />
            <div className="fixed md:static inset-y-0 left-0 z-30 md:z-auto w-[300px] max-w-[85%] md:w-72 md:max-w-none shrink-0">
              <StoryPanel story={story} onClose={() => setStoryOpen(false)}
                onUpdate={fields => applyStory(id => updateStory(id, fields))}
                onSaveCharacter={(character, originalName) => applyStory(id => saveCharacter(id, character, originalName))}
                onRemoveCharacter={name => applyStory(id => removeCharacter(id, name))} />
            </div>
          </>}
          <div className="flex-1 min-w-0 flex flex-col">
            <Suspense fallback={<div className="flex-1 grid place-items-center text-sm text-on-surface-variant" role="status">Loading…</div>}><Outlet context={outletContext} /></Suspense>
          </div>
        </div>
      </AppShell>

      {storyModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-stack-md bg-black/60">
          <CreateStoryModal initialIdea={storyModal.idea} onClose={() => setStoryModal(null)} onCreate={startStory} />
        </div>
      )}

      {personaModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-stack-md bg-black/60">
          <CreatePersonaModal key={editPersonaName ?? "new"} editName={editPersonaName}
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
