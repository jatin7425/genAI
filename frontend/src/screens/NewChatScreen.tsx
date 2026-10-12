import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { ChatInput } from '../components/chat/ChatInput'
import { fetchSuggestions, type Suggestion } from '../api/suggestions'
import type { ChatOutletContext } from '../layouts/ChatLayout'

const FALLBACK_PROMPTS: Suggestion[] = [
  { icon: 'travel_explore', title: 'Explore an idea', description: 'Research a topic and turn what you find into clear insights.' },
  { icon: 'code', title: 'Build something', description: 'Work through a coding problem, one step at a time.' },
  { icon: 'lightbulb', title: 'Make a plan', description: 'Bring structure to your next project or big decision.' },
]

export function NewChatScreen() {
  const { onSend, onSelectPrompt } = useOutletContext<ChatOutletContext>()
  const [prompts, setPrompts] = useState(FALLBACK_PROMPTS)
  useEffect(() => {
    let cancelled = false
    fetchSuggestions().then(fetched => {
      if (!cancelled && fetched.length) setPrompts(fetched.slice(0, 3))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-5 md:px-10 flex flex-col">
      <div className="w-full max-w-[820px] mx-auto my-auto py-10 md:py-14">
        <div className="flex flex-col items-center text-center mb-8 md:mb-10">
          <div className="welcome-orbit"><Icon name="graphic_eq" className="text-[32px]" /></div>
          <p className="text-[11px] tracking-[0.18em] uppercase font-semibold text-primary mb-4">A little clarity. A lot of possibility.</p>
          <h1 className="welcome-title text-on-surface">Where should we begin?</h1>
          <p className="mt-4 text-on-surface-variant text-sm md:text-base max-w-md leading-relaxed">A question, a rough idea, a bigger ambition.<br className="hidden sm:block" /> Give it a starting point. We’ll take it from there.</p>
        </div>
        <ChatInput variant="inline" onSend={onSend} placeholder="Ask anything, or think out loud…" />
        <div className="mt-9 md:mt-12">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium text-on-surface-variant">A few starting points</p>
            <span className="text-[11px] text-on-surface-variant">Made for curious minds</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {prompts.map((prompt, i) => (
              <button key={prompt.title} onClick={() => onSelectPrompt(`${prompt.title}. ${prompt.description}`)} className="prompt-card group">
                <div className="flex justify-between items-center mb-4">
                  <Icon name={prompt.icon} className={`text-[21px] ${i === 1 ? 'text-tertiary' : 'text-primary'}`} />
                  <Icon name="arrow_forward" className="text-[16px] text-outline opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity" />
                </div>
                <h2 className="font-semibold text-[13px] mb-2">{prompt.title}</h2>
                <p className="text-xs text-on-surface-variant leading-relaxed">{prompt.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
