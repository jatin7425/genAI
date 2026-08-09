import { useState, type ReactNode } from 'react'
import { SideNav, type NavKey } from './SideNav'
import { TopAppBar } from './TopAppBar'
import { BottomNav } from './BottomNav'
import type { StoredConversation } from '../../hooks/useConversationHistory'

type AppShellProps = {
  activeNav: NavKey
  onSelectNav?: (key: NavKey) => void
  headerRightSlot?: ReactNode
  conversations?: StoredConversation[]
  activeSessionId?: string | null
  streamingSessionIds?: Set<string>
  onOpenConversation?: (conversation: StoredConversation) => void
  onDeleteConversation?: (sessionId: string) => void
  onLogout?: () => void
  onOpenSettings?: () => void
  children: ReactNode
}

export function AppShell({
  activeNav,
  onSelectNav,
  headerRightSlot,
  conversations,
  activeSessionId,
  streamingSessionIds,
  onOpenConversation,
  onDeleteConversation,
  onLogout,
  onOpenSettings,
  children,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="bg-background text-on-background font-body-md text-body-md overflow-hidden flex h-screen">
      <SideNav
        active={activeNav}
        onSelect={onSelectNav}
        conversations={conversations}
        activeSessionId={activeSessionId}
        streamingSessionIds={streamingSessionIds}
        onOpenConversation={onOpenConversation}
        onDeleteConversation={onDeleteConversation}
        onLogout={onLogout}
        onOpenSettings={onOpenSettings}
      />

      {drawerOpen && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-80 max-w-[85%] h-full">
            <SideNav
              active={activeNav}
              forceVisible
              conversations={conversations}
              activeSessionId={activeSessionId}
              streamingSessionIds={streamingSessionIds}
              onOpenConversation={(conversation) => {
                onOpenConversation?.(conversation)
                setDrawerOpen(false)
              }}
              onDeleteConversation={onDeleteConversation}
              onLogout={onLogout}
              onOpenSettings={() => {
                onOpenSettings?.()
                setDrawerOpen(false)
              }}
              onSelect={(key) => {
                onSelectNav?.(key)
                setDrawerOpen(false)
              }}
            />
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col md:ml-80 h-full relative overflow-hidden">
        <TopAppBar onMenuClick={() => setDrawerOpen(true)} rightSlot={headerRightSlot} />
        {children}
        <BottomNav active="chat" />
      </main>
    </div>
  )
}
