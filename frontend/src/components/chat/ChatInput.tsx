import { useRef, useState } from 'react'
import { Icon } from '../Icon'

type ChatInputProps = {
  placeholder?: string; onSend?: (value: string) => void; onStop?: () => void
  isStreaming?: boolean; variant?: 'floating' | 'inline'
}
export function ChatInput({ placeholder = 'Message Cortex…', onSend, onStop, isStreaming = false, variant = 'floating' }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [value, setValue] = useState('')
  const handleSend = () => {
    if (isStreaming || !value.trim() || !onSend) return
    onSend(value.trim())
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = '64px'
  }
  return (
    <div className={variant === 'floating' ? 'absolute bottom-0 left-0 w-full p-4 md:p-6 bg-background z-10' : 'w-full'}>
      <div className="max-w-[820px] mx-auto">
        <div className="composer">
          <textarea ref={textareaRef} value={value}
            onChange={e => {
              setValue(e.target.value)
              e.target.style.height = '64px'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleSend() }
            }}
            disabled={isStreaming} aria-label="Message Cortex"
            className="w-full min-h-16 max-h-44 bg-transparent resize-none outline-none text-sm leading-relaxed placeholder:text-on-surface-variant/70 disabled:opacity-60"
            placeholder={isStreaming ? 'Cortex is working on your response…' : placeholder} rows={2} />
          <div className="flex justify-between items-center gap-3 mt-2">
            <span className="inline-flex items-center gap-2 text-xs text-on-surface-variant"><Icon name="auto_awesome" className="text-[15px] text-primary" /> Your thinking partner</span>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-[10px] text-on-surface-variant/70">Shift + Enter for a new line</span>
              <button type="button" onClick={isStreaming ? onStop : handleSend}
                disabled={isStreaming ? !onStop : !value.trim() || !onSend}
                aria-label={isStreaming ? 'Stop generating' : 'Send message'}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${isStreaming ? 'bg-error text-on-error' : 'bg-primary text-on-primary hover:bg-primary-fixed'}`}>
                <Icon name={isStreaming ? 'stop' : 'arrow_upward'} className="text-[19px]" />
              </button>
            </div>
          </div>
        </div>
        <p className="text-center mt-3 text-[10px] text-on-surface-variant/70">A thoughtful assistant, not a final authority. Double-check what matters.</p>
      </div>
    </div>
  )
}
