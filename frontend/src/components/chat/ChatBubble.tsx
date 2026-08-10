import { Children, type ReactNode } from 'react'

type ChatBubbleProps = {
  role: 'user' | 'agent'
  children: ReactNode
  accent?: boolean
}

export function ChatBubble({ role, children, accent = false }: ChatBubbleProps) {
  if (role === 'user') {
    return (
      <div className="flex justify-end w-full">
        <div className="bg-primary-container text-on-primary-container p-4 rounded-xl rounded-tr-none max-w-[80%] font-body-md text-body-md">
          {children}
        </div>
      </div>
    )
  }

  // First child is always the leading icon; the rest is the message content.
  const [icon, ...content] = Children.toArray(children)

  return (
    <div className="flex justify-start w-full">
      <div className="flex flex-col gap-1 max-w-[92%] sm:max-w-[80%]">
        <div className="sm:hidden shrink-0 pl-1">{icon}</div>
        <div
          className={`bg-surface border border-outline-variant p-4 rounded-xl rounded-tl-none flex items-start gap-4 shadow-sm relative overflow-hidden ${
            accent ? 'border-l-4 border-l-tertiary' : ''
          }`}
        >
          <div className="hidden sm:block shrink-0">{icon}</div>
          <div className="flex-1 min-w-0">{content}</div>
        </div>
      </div>
    </div>
  )
}

export function ThinkingTrace({ query, resultLine }: { query: string; resultLine: string }) {
  return (
    <div className="flex flex-col gap-2 pl-4 border-l-2 border-outline-variant opacity-60 font-code-sm text-code-sm text-on-surface-variant">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
        <span>Executing search query: "{query}"</span>
      </div>
      <div className="pl-6">&gt; {resultLine}</div>
    </div>
  )
}
