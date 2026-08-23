import { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { ChatBubble } from '../components/chat/ChatBubble'
import { LiveThinkingTrace } from '../components/chat/LiveThinkingTrace'
import { ChatInput } from '../components/chat/ChatInput'
import { Markdown } from '../components/chat/Markdown'
import type { ChatOutletContext } from '../layouts/ChatLayout'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'
import { fetchConversationMessages } from '../api/conversations'

export function ChatConversationScreen() {
  const { sessionId } = useParams<{ sessionId?: string }>()
  const { turns, thinking, status, awaitingAnswer, onSend, onEditLastMessage, onRetry, injectOlderTurns, isReady } =
    useOutletContext<ChatOutletContext>()

  const scrollRef = useRef<HTMLDivElement>(null)
  const [editingLast, setEditingLast] = useState(false)
  const [editValue, setEditValue] = useState('')
  
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // Reset pagination state when switching conversations
  useEffect(() => {
    setHasMore(true)
    setLoadingMore(false)
  }, [sessionId])

  // Track if we just injected older messages to restore scroll position
  const previousScrollHeight = useRef<number>(0)

  const loadOlderMessages = useCallback(async () => {
    if (!sessionId || !hasMore || loadingMore) return
    setLoadingMore(true)
    try {
      const res = await fetchConversationMessages(sessionId, turns.length, 20)
      
      const el = scrollRef.current
      if (el) {
        previousScrollHeight.current = el.scrollHeight
      }
      
      injectOlderTurns(sessionId, res.items)
      setHasMore(res.has_more)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingMore(false)
    }
  }, [sessionId, turns.length, hasMore, loadingMore, injectOlderTurns])

  const observerTarget = useInfiniteScroll(loadOlderMessages, hasMore, loadingMore)

  // Initial load — wait until registry entry exists (isReady) before fetching
  useEffect(() => {
    if (isReady && sessionId && turns.length === 0 && hasMore && !loadingMore) {
      loadOlderMessages()
    }
  }, [isReady, sessionId, turns.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll restoration or auto-scroll to bottom
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return

    if (previousScrollHeight.current > 0) {
      // We just prepended messages. Adjust scroll position to maintain relative view
      const newHeight = el.scrollHeight
      const heightDifference = newHeight - previousScrollHeight.current
      el.scrollTop += heightDifference
      previousScrollHeight.current = 0
    } else {
      // Auto-scroll to bottom for new messages or thinking
      el.scrollTop = el.scrollHeight
    }
  }, [turns, thinking, status])

  useEffect(() => {
    setEditingLast(false)
  }, [turns.length])

  let lastUserIndex = -1
  turns.forEach((t, i) => {
    if (t.kind === 'user') lastUserIndex = i
  })
  const lastIndex = turns.length - 1
  const canEditOrRetry = status !== 'streaming' && !awaitingAnswer

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-background">
      <div ref={scrollRef} className="chat-scroll overflow-y-auto p-container-padding pb-stack-lg h-full">
        <div className="max-w-4xl mx-auto w-full flex-1 space-y-stack-md ">
          {hasMore && (
            <div ref={observerTarget} className="py-2 text-center text-secondary text-sm">
              {loadingMore ? 'Loading older messages...' : ''}
            </div>
          )}
          {turns.map((turn, i) => {
            if (turn.kind === 'user') {
              const isLastUser = i === lastUserIndex
              const isEditingThis = isLastUser && editingLast

              if (isEditingThis) {
                return (
                  <div key={turn.id} className="flex flex-col items-end gap-2">
                    <textarea
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full max-w-[80%] bg-surface-container border border-primary rounded-xl p-3 text-on-surface font-body-md text-body-md resize-none focus:outline-none"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingLast(false)}
                        className="px-3 py-1.5 rounded-lg text-sm text-on-surface-variant hover:bg-surface-container-high transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          const trimmed = editValue.trim()
                          if (trimmed) onEditLastMessage(trimmed)
                          setEditingLast(false)
                        }}
                        className="px-3 py-1.5 rounded-lg text-sm bg-primary text-on-primary hover:bg-primary-fixed transition-colors font-medium"
                      >
                        Save &amp; Regenerate
                      </button>
                    </div>
                  </div>
                )
              }

              return (
                <div key={turn.id} className="group flex flex-col items-end gap-1">
                  <ChatBubble role="user">{turn.text}</ChatBubble>
                  {isLastUser && canEditOrRetry && (
                    <button
                      onClick={() => {
                        setEditValue(turn.text)
                        setEditingLast(true)
                      }}
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 text-xs text-on-surface-variant hover:text-on-surface transition-all"
                    >
                      <Icon name="edit" className="text-[14px]" />
                      Edit
                    </button>
                  )}
                </div>
              )
            }

            if (turn.kind === 'question') {
              return (
                <ChatBubble key={turn.id} role="agent" accent>
                  <div className="shrink-0 text-tertiary mt-1">
                    <Icon name="help" filled />
                  </div>
                  <div className="flex-1">
                    <p className="font-body-lg text-body-md sm:text-body-lg text-on-surface">{turn.text}</p>
                  </div>
                </ChatBubble>
              )
            }

            const isLastTurn = i === lastIndex
            const failed = turn.status !== 'done'

            return (
              <div key={turn.id} className="flex flex-col gap-1">
                <ChatBubble role="agent" accent={failed}>
                  <div className="shrink-0 mt-1" style={{ color: turn.status === 'done' ? 'inherit' : undefined }}>
                    <Icon
                      name={turn.status === 'done' ? 'smart_toy' : 'error'}
                      filled
                      className={turn.status === 'done' ? 'text-secondary' : 'text-error'}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Markdown>{turn.text}</Markdown>
                  </div>
                </ChatBubble>
                {isLastTurn && failed && canEditOrRetry && (
                  <button
                    onClick={onRetry}
                    className="self-start flex items-center gap-1 px-2 py-1 text-xs text-on-surface-variant hover:text-on-surface transition-all"
                  >
                    <Icon name="refresh" className="text-[14px]" />
                    Retry
                  </button>
                )}
              </div>
            )
          })}

          {status === 'streaming' && <LiveThinkingTrace lines={thinking} />}
        </div>
      </div>

      <ChatInputBar onSend={onSend} disabled={status === 'streaming'} awaitingAnswer={awaitingAnswer} />
    </div>
  )
}

function ChatInputBar({
  onSend,
  disabled,
  awaitingAnswer,
}: {
  onSend: (text: string) => void
  disabled: boolean
  awaitingAnswer: boolean
}) {
  return (
    <div className="p-container-padding bg-background border-t border-outline-variant">
      <div className="max-w-4xl mx-auto w-full">
        <ChatInput
          variant="inline"
          placeholder={awaitingAnswer ? 'Type your answer here...' : 'Message Cortex...'}
          onSend={disabled ? undefined : onSend}
        />
      </div>
    </div>
  )
}
