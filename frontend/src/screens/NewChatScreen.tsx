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
    <div className="flex-1 flex flex-col relative overflow-hidden bg-background">
      <div className="flex-1 overflow-y-auto p-gutter md:p-container-padding pb-32 flex flex-col items-center">
        <div className="my-auto flex flex-col items-center w-full max-w-7xl">
          <div className="w-16 h-16 md:w-24 md:h-24 mb-4 md:mb-8 rounded-xl md:rounded-2xl bg-surface-container flex items-center justify-center border border-outline-variant shadow-lg relative overflow-hidden group">
            <div className="absolute inset-0 bg-primary-container/15 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
            <Icon
              name="graphic_eq"
              filled
              className="text-primary text-[32px] md:text-[48px] relative z-10 group-hover:scale-110 transition-transform duration-500"
            />
          </div>

          <h2 className="text-2xl md:font-headline-lg md:text-headline-lg font-bold text-on-surface mb-6 md:mb-12 text-center max-w-2xl tracking-tight px-4">
            How can I help you today?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-gutter w-full px-4 md:px-0 max-md:pb-14">
            {prompts === null
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="p-4 md:p-container-padding bg-surface border border-outline-variant rounded-xl flex flex-col gap-2 md:gap-3 h-full animate-pulse"
                  >
                    <div className="w-5 h-5 md:w-6 md:h-6 rounded bg-surface-container-highest" />
                    <div className="space-y-2 mt-1">
                      <div className="h-4 w-2/3 rounded bg-surface-container-highest" />
                      <div className="h-3 w-full rounded bg-surface-container-highest" />
                    </div>
                  </div>
                ))
              : prompts.map((prompt, i) => (
                  <button
                    key={prompt.title}
                    onClick={() => onSelectPrompt(prompt.title)}
                    className="text-left p-4 md:p-container-padding bg-surface border border-outline-variant rounded-xl hover:bg-surface-container-high hover:border-outline transition-all duration-300 group flex flex-col gap-2 md:gap-3 h-full"
                  >
                    <Icon
                      name={prompt.icon}
                      className={`${ICON_COLORS[i % ICON_COLORS.length]} text-[20px] md:text-[24px] opacity-80 group-hover:opacity-100 transition-opacity`}
                    />
                    <div>
                      <h3 className="font-semibold text-base md:font-body-lg md:text-body-lg text-on-surface mb-1">{prompt.title}</h3>
                      <p className="text-xs md:font-body-md md:text-body-md text-on-surface-variant opacity-70 group-hover:opacity-100 transition-opacity leading-relaxed">
                        {prompt.description}
                      </p>
                    </div>
                  </button>
                ))}
          </div>
        </div>
      </div>

      <ChatInput onSend={onSend} variant="floating" />
    </div>
  )
}
