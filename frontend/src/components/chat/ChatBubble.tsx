import { type ReactNode } from 'react'

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

  return (
    <div className="flex justify-start w-full">
      <div className="w-full">
        <div
          className={`flex items-start gap-4 relative overflow-hidden ${
            accent ? 'border-l-4 border-l-tertiary pl-4' : ''
          }`}
        >
          <div className="flex-1 min-w-0 text-on-surface">{children}</div>
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
