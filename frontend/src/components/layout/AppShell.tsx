import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { SideNav } from './SideNav'
import { TopAppBar } from './TopAppBar'
import type { StoredConversation } from '../../hooks/useConversationHistory'

type AppShellProps = {
  headerRightSlot?: ReactNode
  conversations?: StoredConversation[]
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

  // Close the mobile drawer automatically whenever the route changes.
  // This covers NavLink and Link clicks inside SideNav.
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  return (
    <div className="bg-background text-on-background font-body-md text-body-md overflow-hidden flex h-dvh">
      <SideNav
        conversations={conversations}
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
          <div className="relative w-80 max-w-[85%] h-full">
            <SideNav
              forceVisible
              conversations={conversations}
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

      <main className="flex-1 flex flex-col md:ml-80 h-full relative overflow-hidden">
        <TopAppBar onMenuClick={() => setDrawerOpen(true)} rightSlot={headerRightSlot} />
        {children}
      </main>
    </div>
  )
}
