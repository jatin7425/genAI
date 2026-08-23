import { useState, useMemo, useEffect, useCallback } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { Icon } from '../Icon'
import type { StoredConversation } from '../../hooks/useConversationHistory'
import { fetchDocuments, deleteDocument, type APIDocument } from '../../api/documents'
import { UploadDocumentModal } from '../document/UploadDocumentModal'
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll'

type SideNavProps = {
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
  onLogout?: () => void
  onSettings?: () => void
}

export function SideNav({
  forceVisible = false,
  conversations = [],
  hasMoreConversations = false,
  isLoadingMoreConversations = false,
  onLoadMoreConversations,
  activeSessionId,
  streamingSessionIds,
  onOpenConversation,
  onDeleteConversation,
  onNewChat,
  onLogout,
  onSettings
}: SideNavProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState<'chats' | 'documents'>('chats')
  const [docs, setDocs] = useState<APIDocument[]>([])
  const [docsHasMore, setDocsHasMore] = useState(true)
  const [docsLoading, setDocsLoading] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  const displayConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      if (a.sessionId === activeSessionId) return -1
      if (b.sessionId === activeSessionId) return 1
      return 0
    })
  }, [conversations, activeSessionId])

  const loadDocs = useCallback(async (reset = false) => {
    if ((!reset && !docsHasMore) || docsLoading) return
    setDocsLoading(true)
    try {
      const skip = reset ? 0 : docs.length
      const data = await fetchDocuments(skip, 20)
      setDocs(prev => reset ? data.items : [...prev, ...data.items])
      setDocsHasMore(data.has_more)
    } catch (err) {
      console.error(err)
    } finally {
      setDocsLoading(false)
    }
  }, [docs.length, docsHasMore, docsLoading])

  useEffect(() => {
    if (activeTab === 'documents') {
      loadDocs(true)
    }
  }, [activeTab])

  useEffect(() => {
    const handleMutation = () => {
      if (activeTab === 'documents') {
        loadDocs(true)
      }
    }
    window.addEventListener('api_mutation', handleMutation)
    return () => window.removeEventListener('api_mutation', handleMutation)
  }, [activeTab, loadDocs])

  const docsObserverTarget = useInfiniteScroll(loadDocs, docsHasMore, docsLoading)
  const convObserverTarget = useInfiniteScroll(() => {
    if (onLoadMoreConversations) onLoadMoreConversations()
  }, hasMoreConversations, isLoadingMoreConversations)

  return (
    <>
      {uploadModalOpen && (
        <UploadDocumentModal onClose={() => setUploadModalOpen(false)} />
      )}
      <aside
        className={`
          ${forceVisible ? 'flex' : 'hidden md:flex'}
          ${forceVisible ? '' : 'fixed left-0 top-0'}
          z-20
          h-full w-80
          flex-col
          border-r border-outline-variant/50
          bg-surface-container-low
          p-3 md:p-4
          shadow-xl shadow-black/5
        `}
      >
        <div className="mb-5 flex items-center gap-3 px-2 pt-2">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-lg" />
            <div className="relative h-11 w-11 overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-high shadow-md">
              <img
                alt="User profile avatar"
                className="h-full w-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBua_tAGdJ3Ee5aYlFxMgIvJK6gc_Cn8zGawjfKfPedOE1xGh4O0HpnaH9cRf7U7NWscpgn4CpTOc_LzVg0t2TvB_F7AIaOn27AsMSOV4dEknzjLH4Fh3wwgLvH-wGmDiDel7HADNhGIrqTRJtLY9OaCRw13efDL1YD8BptMyU0459Wk97O21w3m9BsuOI8VZsaSiLuNHeaYrwD0JQHYSrWGbrNqbOqpmcH2a8kvv4feBQOO6hmbgFQ"
              />
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-headline-md text-lg font-semibold tracking-tight text-on-surface">
              Cortex Labs
            </h1>
            <p className="mt-0.5 truncate text-xs text-on-surface-variant">
              AI Research Environment
            </p>
          </div>
        </div>

        <NavLink
          to="/"
          end
          onClick={onNewChat}
          className={({ isActive }) =>
            `group mb-5 flex w-full items-center justify-between rounded-xl border px-4 py-3 transition-all duration-200
            ${isActive
              ? 'border-primary/30 bg-primary text-on-primary shadow-lg shadow-primary/20'
              : 'border-outline-variant/50 bg-surface-container text-on-surface hover:-translate-y-0.5 hover:border-primary/30 hover:bg-surface-container-high hover:shadow-md'
            }`
          }
        >
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/5 transition-transform duration-200 group-hover:scale-110">
              <Icon name="add" className="text-[20px]" />
            </div>
            <span className="text-sm font-semibold">New Chat</span>
          </div>
          <Icon name="arrow_forward" className="text-[18px] opacity-60 transition-transform duration-200 group-hover:translate-x-1" />
        </NavLink>

        <nav className="flex min-h-0 flex-1 flex-col">
          <div className="mb-4 rounded-xl border border-outline-variant/40 bg-surface-container p-1">
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => setActiveTab('chats')}
                className={`relative rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  activeTab === 'chats' ? 'bg-surface-container-highest text-on-surface shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Icon name="chat_bubble" className="text-[16px]" />
                  Conversations
                </div>
              </button>
              <button
                onClick={() => setActiveTab('documents')}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  activeTab === 'documents' ? 'bg-surface-container-highest text-on-surface shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Icon name="description" className="text-[16px]" />
                  Documents
                </div>
              </button>
            </div>
          </div>

          {activeTab === 'chats' && (
            <div className="min-h-0 flex-1 overflow-y-auto px-1 custom-scrollbar">
              {conversations.length === 0 ? (
                <EmptyState icon="chat_bubble" title="No conversations" description="Start a new chat to begin exploring." />
              ) : (
                <div className="space-y-1">
                  <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant/60">
                    Recent
                  </p>
                  {displayConversations.map((conversation) => {
                    const isActive = conversation.sessionId === activeSessionId
                    const isStreaming = streamingSessionIds?.has(conversation.sessionId) ?? false
                    return (
                      <Link
                        key={conversation.sessionId}
                        to={`/chat/${conversation.sessionId}`}
                        onClick={() => onOpenConversation?.(conversation)}
                        className={`group/item flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-200 ${
                          isActive
                            ? 'border-primary/30 bg-primary/10 text-on-surface shadow-sm shadow-primary/20'
                            : 'border-outline-variant/50 bg-surface-container text-on-surface hover:-translate-y-0.5 hover:border-primary/30 hover:bg-surface-container-high hover:shadow-md'
                        }`}
                      >
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-primary/15 text-primary' : 'bg-surface-container-highest'}`}>
                          {isStreaming ? (
                            <span className="material-symbols-outlined animate-spin text-[17px] text-secondary" title="Still generating...">progress_activity</span>
                          ) : (
                            <Icon name="chat_bubble" className="text-[16px]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{conversation.title}</p>
                          {isStreaming && <p className="mt-0.5 text-[10px] text-secondary">Generating response...</p>}
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onDeleteConversation?.(conversation.sessionId)
                          }}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg md:opacity-0 transition-all md:hover:bg-error/10 md:hover:text-error md:group-hover/item:opacity-100"
                        >
                          <Icon name="delete" className="text-[16px]" />
                        </button>
                      </Link>
                    )
                  })}
                  {hasMoreConversations && (
                    <div ref={convObserverTarget} className="py-2 text-center text-secondary text-sm">
                      {isLoadingMoreConversations ? 'Loading...' : 'Scroll for more'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="min-h-0 flex-1 overflow-y-auto px-1 custom-scrollbar">
              {docs.length === 0 ? (
                <div className="flex flex-col h-full">
                  <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant/60 flex justify-between items-center">
                    <span>Documents</span>
                    <button onClick={() => setUploadModalOpen(true)} className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer" title="Upload Document">
                      <Icon name="add" className="font-[14px]" />
                    </button>
                  </p>
                  <EmptyState icon="description" title="No documents yet" description="Uploaded documents will appear here." />
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant/60 flex justify-between items-center">
                    <span>Documents</span>
                    <button onClick={() => setUploadModalOpen(true)} className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer" title="Upload Document">
                      <Icon name="add" className="font-[14px]" />
                    </button>
                  </p>
                  {docs.map((doc) => {
                    const filename = doc.filename || doc[' '] || 'Unknown Document'
                    const isFailed = doc.status === 'failed'
                    const isPending = doc.status === 'pending'
                    const isIndexed = doc.status === 'indexed'

                    return (
                      <Link
                        key={doc._id}
                        to={`/documents/${doc._id}`}
                        className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-on-surface-variant transition-all hover:bg-surface-container-high hover:text-on-surface"
                      >
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isFailed ? 'bg-error/10 text-error' : 'bg-surface-container-highest'}`}>
                          {isPending ? (
                            <span className="material-symbols-outlined animate-spin text-[17px] text-secondary">progress_activity</span>
                          ) : (
                            <Icon name={isFailed ? 'error' : 'description'} className="text-[17px]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 flex flex-col">
                          <span className="truncate text-sm font-medium">{filename}</span>
                          {isIndexed && doc.chunk_count !== undefined && (
                            <span className="text-[10px] opacity-70 truncate">{doc.chunk_count} chunks</span>
                          )}
                          {isFailed && (
                            <span className="text-[10px] text-error opacity-80 truncate">Failed to index</span>
                          )}
                        </div>
                        <button
                          onClick={async (e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            try {
                              await deleteDocument(doc._id)
                              if (location.pathname === `/documents/${doc._id}`) {
                                navigate('/')
                              }
                              window.dispatchEvent(new CustomEvent('api_mutation'))
                            } catch (err) {
                              console.error('Failed to delete doc:', err)
                            }
                          }}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg md:opacity-0 transition-all md:hover:bg-error/10 md:hover:text-error md:group-hover:opacity-100"
                        >
                          <Icon name="delete" className="text-[16px]" />
                        </button>
                      </Link>
                    )
                  })}
                  {docsHasMore && (
                    <div ref={docsObserverTarget} className="py-2 text-center text-secondary text-sm">
                      {docsLoading ? 'Loading...' : 'Scroll for more'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="mt-4 border-t border-outline-variant/50 pt-3 flex-shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={onSettings}
              className="flex flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-on-surface-variant transition-all hover:bg-surface-container-high hover:text-on-surface"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-high">
                <Icon name="settings" className="text-[18px]" />
              </div>
              <span className="font-medium">Settings</span>
            </button>
            <button
              onClick={onLogout}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-on-surface-variant transition-all hover:bg-error/10 hover:text-error"
              title="Log Out"
            >
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

function EmptyState({ icon, title, description }: { icon: string, title: string, description: string }) {
  return (
    <div className="flex h-full min-h-[250px] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container-high">
        <Icon name={icon} className="text-[24px] text-on-surface-variant" />
      </div>
      <h3 className="text-sm font-semibold text-on-surface">{title}</h3>
      <p className="mt-1 max-w-[200px] text-xs leading-relaxed text-on-surface-variant">{description}</p>
    </div>
  )
}