import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { ChatBubble } from '../components/chat/ChatBubble'
import { LiveThinkingTrace } from '../components/chat/LiveThinkingTrace'
import { ChatInput } from '../components/chat/ChatInput'
import { Markdown } from '../components/chat/Markdown'
import type { ChatTurn } from '../hooks/useChatRegistry'

type ChatConversationScreenProps = {
  turns: ChatTurn[]
  thinking: string[]
  status: 'idle' | 'streaming'
  awaitingAnswer: boolean
  onSend: (text: string) => void
  onEditLastMessage: (newText: string) => void
  onRetry: () => void
}

export function ChatConversationScreen({
  turns,
  thinking,
  status,
  awaitingAnswer,
  onSend,
  onEditLastMessage,
  onRetry,
}: ChatConversationScreenProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [editingLast, setEditingLast] = useState(false)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // wait a frame so new/changed content has been laid out before we read scrollHeight
    const raf = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
    return () => cancelAnimationFrame(raf)
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
      <div ref={scrollRef} className="chat-scroll flex-1 overflow-y-auto p-container-padding pb-stack-lg max-w-4xl mx-auto w-full space-y-stack-md">
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
                      Save & Regenerate
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
                  <p className="font-body-lg text-body-lg text-on-surface">{turn.text}</p>
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
