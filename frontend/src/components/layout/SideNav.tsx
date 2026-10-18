import { useMemo, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Icon } from '../Icon'
import type { StoredConversation } from '../../hooks/useConversationHistory'
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll'
import { ConfirmDialog } from '../ui/ConfirmDialog'

type SideNavProps = {
  onClose?: () => void
  forceVisible?: boolean
  conversations?: StoredConversation[]
  hasMoreConversations?: boolean
  isLoadingMoreConversations?: boolean
  onLoadMoreConversations?: () => void
  activeSessionId?: string | null
  streamingSessionIds?: Set<string>
  onOpenConversation?: (conversation: StoredConversation) => void
  onDeleteConversation?: (sessionId: string) => void
  onNewChat?: () => void
  onNewStory?: () => void
  onLogout?: () => void
  onSettings?: () => void
}

export function SideNav({ forceVisible = false, onClose, conversations = [], hasMoreConversations = false, isLoadingMoreConversations = false, onLoadMoreConversations, activeSessionId, streamingSessionIds, onOpenConversation, onDeleteConversation, onNewChat, onNewStory, onLogout, onSettings }: SideNavProps) {
  const [search, setSearch] = useState('')
  const [pendingDelete, setPendingDelete] = useState<StoredConversation | null>(null)
  const filtered = useMemo(() => conversations.filter(item => item.title.toLowerCase().includes(search.toLowerCase())), [conversations, search])
  const target = useInfiniteScroll(() => onLoadMoreConversations?.(), hasMoreConversations, isLoadingMoreConversations)
  return <>
    {pendingDelete && <ConfirmDialog title="Delete conversation?" description={`"${pendingDelete.title}" and its attachments will be permanently deleted.`} confirmLabel="Delete" onCancel={() => setPendingDelete(null)} onConfirm={() => { onDeleteConversation?.(pendingDelete.sessionId); setPendingDelete(null) }} />}
    <aside className={`${forceVisible ? 'flex' : 'hidden md:flex fixed left-0 top-0'} workspace-sidebar z-20 h-full flex-col bg-surface-container-low border-r border-outline-variant p-4`}>
      <div className="sidebar-brand flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary text-on-primary grid place-items-center"><Icon name="graphic_eq" className="text-[23px]" /></div>
        <div className="min-w-0"><h1 className="font-semibold text-lg tracking-tight">Cortex</h1><p className="text-xs text-on-surface-variant">Your thinking partner</p></div>
        {forceVisible && <button onClick={onClose} aria-label="Close navigation" className="ml-auto p-1"><Icon name="close" className="text-[18px]" /></button>}
      </div>
      <NavLink to="/chat" end onClick={() => { onNewChat?.(); onClose?.() }} className="sidebar-new mb-2 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold"><Icon name="add" className="text-[20px]" />New conversation</NavLink>
      <button onClick={() => { onNewStory?.(); onClose?.() }} className="mb-5 flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium border border-outline-variant text-on-surface hover:bg-surface-container-high transition-colors"><Icon name="menu_book" className="text-[18px] text-primary" />New story</button>
      <div className="flex gap-2 items-center rounded-xl border border-outline-variant px-3 py-3 mb-5 bg-background/50"><Icon name="search" className="text-[16px] text-on-surface-variant" /><input aria-label="Search conversations" placeholder="Search conversations…" value={search} onChange={event => setSearch(event.target.value)} className="bg-transparent w-full min-w-0 outline-none text-xs" /></div>
      <nav aria-label="Conversations" className="flex-1 min-h-0 overflow-y-auto">
        <p className="text-[11px] font-semibold text-on-surface-variant/70 tracking-wider uppercase px-3 mb-2">Recent conversations</p>
        {!filtered.length && <div className="px-3 py-8 text-xs text-on-surface-variant"><p className="font-medium mb-2">{search ? 'No matching conversations' : 'A fresh start'}</p><p>{search ? 'Try a different search.' : 'Your conversations will appear here.'}</p></div>}
        {filtered.map(item => <div key={item.sessionId} className={`conversation-link group flex items-center rounded-xl ${item.sessionId === activeSessionId ? 'is-active' : ''}`}>
          <Link to={`/chat/${item.sessionId}`} onClick={() => { onOpenConversation?.(item); onClose?.() }} className="flex flex-1 min-w-0 items-center gap-3 px-3 py-3 text-sm"><Icon name={streamingSessionIds?.has(item.sessionId) ? 'progress_activity' : item.story ? 'menu_book' : 'chat_bubble'} className={`text-[16px] ${streamingSessionIds?.has(item.sessionId) ? 'animate-spin' : ''}`} /><span className="truncate">{item.title}</span></Link>
          <button aria-label={`Delete ${item.title}`} onClick={() => setPendingDelete(item)} className="p-2 mr-1 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 md:opacity-0 group-hover:opacity-100 focus-visible:opacity-100"><Icon name="delete" className="text-[15px]" /></button>
        </div>)}
        {hasMoreConversations && <div ref={target} className="text-center text-xs text-on-surface-variant py-4">{isLoadingMoreConversations ? 'Loading…' : 'Scroll for more'}</div>}
      </nav>
      <div className="flex items-center border-t border-outline-variant mt-4 pt-3"><button onClick={onSettings} className="flex flex-1 items-center gap-3 px-3 py-3 text-sm text-on-surface-variant hover:bg-surface-container-high rounded-xl"><Icon name="settings" className="text-[18px]" />Settings</button><button onClick={onLogout} title="Log Out" aria-label="Log out" className="p-3 text-on-surface-variant hover:text-error"><Icon name="logout" className="text-[18px]" /></button></div>
    </aside>
  </>
}
