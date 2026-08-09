import { useRef } from 'react'
import { Icon } from '../Icon'

type ChatInputProps = {
  placeholder?: string
  onSend?: (value: string) => void
  variant?: 'floating' | 'inline'
}

export function ChatInput({ placeholder = 'Message Cortex...', onSend, variant = 'floating' }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleInput = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }

  const handleSend = () => {
    const value = textareaRef.current?.value.trim()
    if (!value) return
    onSend?.(value)
    if (textareaRef.current) {
      textareaRef.current.value = ''
      textareaRef.current.style.height = '40px'
    }
  }

  const wrapperClass =
    variant === 'floating'
      ? 'absolute bottom-0 left-0 w-full p-gutter md:p-container-padding bg-background z-10 pb-[80px] md:pb-container-padding'
      : 'w-full'

  return (
    <div className={wrapperClass}>
      <div className="max-w-4xl mx-auto relative group">
        <div className="relative flex items-end gap-2 bg-surface border border-outline-variant rounded-xl p-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all shadow-lg">
          <textarea
            ref={textareaRef}
            onInput={handleInput}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            className="w-full bg-transparent border-none text-on-surface font-body-md text-body-md resize-none focus:ring-0 p-2 max-h-32 overflow-y-auto"
            placeholder={placeholder}
            rows={1}
            style={{ minHeight: '40px' }}
          />
          <button
            onClick={handleSend}
            className="p-2 bg-primary-container text-on-primary-container hover:bg-primary-fixed rounded-lg transition-colors flex-shrink-0"
          >
            <Icon name="send" filled />
          </button>
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
