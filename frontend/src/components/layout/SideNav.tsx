import { useState } from 'react'
import { Icon } from '../Icon'
import type { StoredConversation } from '../../hooks/useConversationHistory'

export type NavKey = 'new-chat' | 'recent'

type SideNavProps = {
  active: NavKey
  onSelect?: (key: NavKey) => void
  forceVisible?: boolean
  conversations?: StoredConversation[]
  activeSessionId?: string | null
  streamingSessionIds?: Set<string>
  onOpenConversation?: (conversation: StoredConversation) => void
  onDeleteConversation?: (sessionId: string) => void
  onLogout?: () => void
  onOpenSettings?: () => void
}

export function SideNav({
  active,
  onSelect,
  forceVisible = false,
  conversations = [],
  activeSessionId,
  streamingSessionIds,
  onOpenConversation,
  onDeleteConversation,
  onLogout,
  onOpenSettings,
}: SideNavProps) {
  const [recentOpen, setRecentOpen] = useState(true)

  return (
    <aside
      className={`${forceVisible ? 'flex' : 'hidden md:flex'} flex-col h-full p-stack-sm md:p-stack-md bg-surface-container-low border-r border-outline-variant w-80 ${forceVisible ? '' : 'fixed left-0 top-0'} z-20`}
    >
      <div className="flex items-center gap-4 mb-stack-md px-2">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-container-high border border-outline-variant flex-shrink-0">
          <img
            alt="User profile avatar"
            className="w-full h-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBua_tAGdJ3Ee5aYlFxMgIvJK6gc_Cn8zGawjfKfPedOE1xGh4O0HpnaH9cRf7U7NWscpgn4CpTOc_LzVg0t2TvB_F7AIaOn27AsMSOV4dEknzjLH4Fh3wwgLvH-wGmDiDel7HADNhGIrqTRJtLY9OaCRw13efDL1YD8BptMyU0459Wk97O21w3m9BsuOI8VZsaSiLuNHeaYrwD0JQHYSrWGbrNqbOqpmcH2a8kvv4feBQOO6hmbgFQ"
          />
        </div>
        <div>
          <h1 className="font-headline-md text-headline-md text-on-surface m-0 leading-tight">Cortex Labs</h1>
          <p className="font-body-md text-body-md text-on-surface-variant m-0 opacity-80">AI Research Environment</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto space-y-unit">
        <button
          onClick={() => onSelect?.('new-chat')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg group transition-all text-left ${
            active === 'new-chat'
              ? 'bg-primary-container text-on-primary-container font-bold'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
          }`}
        >
          <Icon name="add" className="group-hover:scale-110 transition-transform" />
          <span className="font-body-md text-body-md">New Chat</span>
        </button>

        <div>
          <button
            onClick={() => setRecentOpen((v) => !v)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg group transition-all text-left ${
              active === 'recent'
                ? 'text-on-surface font-bold'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
            }`}
          >
            <Icon name="history" className="group-hover:scale-110 transition-transform" />
            <span className="font-body-md text-body-md flex-1">Recent Conversations</span>
            <Icon
              name="expand_more"
              className={`text-on-surface-variant transition-transform ${recentOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {recentOpen && (
            <div className="mt-1 flex flex-col gap-0.5 pl-4">
              {conversations.length === 0 ? (
                <p className="px-4 py-2 text-on-surface-variant text-xs opacity-70">No conversations yet.</p>
              ) : (
                conversations.map((conversation) => {
                  const isActive = conversation.sessionId === activeSessionId
                  const isStreaming = streamingSessionIds?.has(conversation.sessionId) ?? false
                  return (
                    <div
                      key={conversation.sessionId}
                      onClick={() => onOpenConversation?.(conversation)}
                      className={`group/item flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                        isActive
                          ? 'bg-surface-container-highest text-on-surface'
                          : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
                      }`}
                    >
                      {isStreaming ? (
                        <span
                          className="material-symbols-outlined text-[16px] shrink-0 animate-spin text-secondary"
                          title="Still generating..."
                        >
                          progress_activity
                        </span>
                      ) : (
                        <Icon name="chat_bubble" className="text-[16px] shrink-0" />
                      )}
                      <span className="flex-1 truncate text-sm">{conversation.title}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteConversation?.(conversation.sessionId)
                        }}
                        className="opacity-0 group-hover/item:opacity-100 p-1 hover:text-error rounded transition-all shrink-0"
                      >
                        <Icon name="delete" className="text-[14px]" />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </nav>

      <div className="mt-auto pt-stack-md space-y-unit">
        <div className="border-t border-outline-variant pt-unit mt-unit">
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container-highest transition-all text-left"
          >
            <Icon name="settings" />
            <span className="font-body-md text-body-md">Settings</span>
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container-highest transition-all text-left"
          >
            <Icon name="logout" />
            <span className="font-body-md text-body-md">Log Out</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
