import { useRef } from 'react'
import { Icon } from '../Icon'

type ChatInputProps = {
  placeholder?: string
  onSend?: (value: string) => void
  onStop?: () => void
  isStreaming?: boolean
  variant?: 'floating' | 'inline'
}

export function ChatInput({ placeholder = 'Message Cortex...', onSend, onStop, isStreaming = false, variant = 'floating' }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleInput = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }

  const handleSend = () => {
    if (isStreaming) return
    const value = textareaRef.current?.value.trim()
    if (!value || !onSend) return
    onSend(value)
    if (textareaRef.current) {
      textareaRef.current.value = ''
      textareaRef.current.style.height = '40px'
    }
  }

  const wrapperClass =
    variant === 'floating' ? 'absolute bottom-0 left-0 w-full p-gutter md:p-container-padding bg-background z-10' : 'w-full'

  return (
    <div className={wrapperClass}>
      <div className="max-w-4xl mx-auto relative group">
        <div className={`w-full relative flex items-end bg-surface border border-outline-variant rounded-xl p-3 transition-all shadow-lg ${!isStreaming ? 'focus-within:border-primary focus-within:ring-1 focus-within:ring-primary' : 'opacity-80'}`}>
          <textarea
            ref={textareaRef}
            onInput={handleInput}
            disabled={isStreaming}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            className="w-full bg-transparent border-none text-on-surface font-body-md text-body-md resize-none focus:ring-0 p-2 max-h-32 overflow-y-auto focus:outline-none disabled:opacity-50"
            placeholder={isStreaming ? 'Cortex is responding...' : placeholder}
            rows={1}
            style={{ minHeight: '40px' }}
          />
          
          {isStreaming ? (
            <button
              onClick={onStop}
              className="p-2 bg-error text-on-error hover:bg-error-container hover:text-on-error-container rounded-lg transition-colors shrink-0"
              title="Stop generating"
            >
              <Icon name="stop" filled />
            </button>
          ) : (
            <button
              onClick={handleSend}
              className="p-2 bg-primary-container text-on-primary-container hover:bg-primary-fixed rounded-lg transition-colors shrink-0"
            >
              <Icon name="send" filled />
            </button>
          )}
        </div>
        <div className="text-center mt-2">
          <p className="font-label-caps text-label-caps text-on-surface-variant opacity-60 uppercase tracking-widest">
            Cortex AI can make mistakes. Verify critical information.
          </p>
        </div>
      </div>
    </div>
  )
}
