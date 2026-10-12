import { useDialogFocus } from '../../hooks/useDialogFocus'
import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { SideNav } from './SideNav'
import { TopAppBar } from './TopAppBar'
import type { StoredConversation } from '../../hooks/useConversationHistory'

type AppShellProps = {
  headerRightSlot?: ReactNode
  conversations?: StoredConversation[]
  hasMoreConversations?: boolean
  isLoadingMoreConversations?: boolean
  onLoadMoreConversations?: () => void
  activeSessionId?: string | null
  streamingSessionIds?: Set<string>
  onOpenConversation?: (conversation: StoredConversation) => void
  onDeleteConversation?: (sessionId: string) => void
  onNewChat?: () => void
  onLogout?: () => void
  onSettings?: () => void
  children: ReactNode
}

export function AppShell({
  headerRightSlot,
  conversations,
  hasMoreConversations,
  isLoadingMoreConversations,
  onLoadMoreConversations,
  activeSessionId,
  streamingSessionIds,
  onOpenConversation,
  onDeleteConversation,
  onNewChat,
  onLogout,
  onSettings,
  children,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const drawerRef = useDialogFocus(drawerOpen, () => setDrawerOpen(false))

  // Close the mobile drawer automatically whenever the route changes.
  // This covers NavLink and Link clicks inside SideNav.
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setDrawerOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  return (
    <div className="bg-background text-on-background font-body-md text-body-md overflow-hidden flex h-dvh">
      <SideNav
        conversations={conversations}
        hasMoreConversations={hasMoreConversations}
        isLoadingMoreConversations={isLoadingMoreConversations}
        onLoadMoreConversations={onLoadMoreConversations}
        activeSessionId={activeSessionId}
        streamingSessionIds={streamingSessionIds}
        onOpenConversation={onOpenConversation}
        onDeleteConversation={onDeleteConversation}
        onNewChat={onNewChat}
        onLogout={onLogout}
        onSettings={onSettings}
      />

      {drawerOpen && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <div ref={drawerRef} tabIndex={-1} className="relative w-[272px] max-w-[85%] h-full" role="dialog" aria-modal="true" aria-label="Navigation">
            <SideNav
              forceVisible
              onClose={() => setDrawerOpen(false)}
              conversations={conversations}
              hasMoreConversations={hasMoreConversations}
              isLoadingMoreConversations={isLoadingMoreConversations}
              onLoadMoreConversations={onLoadMoreConversations}
              activeSessionId={activeSessionId}
              streamingSessionIds={streamingSessionIds}
              onOpenConversation={onOpenConversation}
              onDeleteConversation={onDeleteConversation}
              onNewChat={onNewChat}
              onLogout={onLogout}
              onSettings={onSettings}
            />
          </div>
        </div>
      )}

      <main inert={drawerOpen} className="workspace-main flex-1 flex flex-col h-full relative overflow-hidden">
        <TopAppBar onMenuClick={() => setDrawerOpen(true)} rightSlot={headerRightSlot} />
        {children}
      </main>
    </div>
  )
}
