import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { ChatInput } from '../components/chat/ChatInput'
import { fetchSuggestions, type Suggestion } from '../api/suggestions'
import type { ChatOutletContext } from '../layouts/ChatLayout'

const ICON_COLORS = ['text-secondary', 'text-tertiary', 'text-primary']

const FALLBACK_PROMPTS: Suggestion[] = [
  {
    icon: 'search_insights',
    title: 'Research AI trends',
    description: 'Summarize recent breakthroughs in LLM architectures.',
  },
  {
    icon: 'bar_chart',
    title: 'Analyze my data',
    description: 'Connect to database and run anomaly detection.',
  },
  {
    icon: 'route',
    title: 'Plan a travel route',
    description: 'Optimize a multi-city itinerary for efficiency.',
  },
]

export function NewChatScreen() {
  const { onSend, onSelectPrompt } = useOutletContext<ChatOutletContext>()
  const [prompts, setPrompts] = useState<Suggestion[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchSuggestions()
      .then((fetched) => {
        if (!cancelled) setPrompts(fetched)
      })
      .catch(() => {
        if (!cancelled) setPrompts(FALLBACK_PROMPTS)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-gutter md:p-container-padding relative">
      <div className="w-24 h-24 mb-stack-md rounded-2xl bg-surface-container flex items-center justify-center border border-outline-variant shadow-lg relative overflow-hidden group">
        <div className="absolute inset-0 bg-primary-container/15 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
        <Icon
          name="graphic_eq"
          filled
          className="text-primary text-[48px] relative z-10 group-hover:scale-110 transition-transform duration-500"
        />
      </div>

      <h2 className="font-headline-lg text-headline-lg text-on-surface mb-stack-lg text-center max-w-2xl tracking-tight">
        How can I help you today?
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-unit md:gap-gutter w-full max-w-4xl px-4 md:px-0 mb-24 max-md:pb-14">
        {prompts === null
          ? Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="p-container-padding bg-surface border border-outline-variant rounded-xl flex flex-col gap-3 h-full animate-pulse"
              >
                <div className="w-6 h-6 rounded bg-surface-container-highest" />
                <div className="space-y-2">
                  <div className="h-4 w-2/3 rounded bg-surface-container-highest" />
                  <div className="h-3 w-full rounded bg-surface-container-highest" />
                </div>
              </div>
            ))
          : prompts.map((prompt, i) => (
              <button
                key={prompt.title}
                onClick={() => onSelectPrompt(prompt.title)}
                className="text-left p-container-padding bg-surface border border-outline-variant rounded-xl hover:bg-surface-container-high hover:border-outline transition-all duration-300 group flex flex-col gap-3 h-full"
              >
                <Icon
                  name={prompt.icon}
                  className={`${ICON_COLORS[i % ICON_COLORS.length]} opacity-80 group-hover:opacity-100 transition-opacity`}
                />
                <div>
                  <h3 className="font-body-lg text-body-lg text-on-surface mb-1">{prompt.title}</h3>
                  <p className="font-body-md text-body-md text-on-surface-variant opacity-70 group-hover:opacity-100 transition-opacity">
                    {prompt.description}
                  </p>
                </div>
              </button>
            ))}
      </div>

      <ChatInput onSend={onSend} />
    </div>
  )
}
