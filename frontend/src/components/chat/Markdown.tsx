import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { stripToolTagWrapper } from '../../utils/text'
import { Icon } from '../Icon'

function ThinkingAccordion({ title, icon, content }: { title: string; icon: string; content: string }) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div className="mb-4 my-2 rounded-2xl overflow-hidden bg-surface-container-lowest border border-outline-variant shadow-sm transition-all duration-300">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-container-low transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="bg-secondary/10 p-1.5 rounded-lg flex items-center justify-center">
            <Icon name={icon} filled className="text-secondary text-[18px]" />
          </div>
          <span className="font-medium text-body-md text-on-surface">{title}</span>
        </div>
        <Icon 
          name="expand_more" 
          className={`text-on-surface-variant text-[20px] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>
      
      <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden flex flex-col">
          <div className="border-t border-outline-variant/50 mx-4 mt-2 shrink-0" />
          <div className="px-4 pb-4 pt-3 text-on-surface-variant text-sm font-body-sm leading-relaxed max-h-[300px] overflow-y-auto">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-5 mb-3">{children}</ul>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}

const sharedComponents = {
  p: ({ children }: any) => <p className="mb-3 leading-relaxed">{children}</p>,
  strong: ({ children }: any) => <strong className="font-semibold text-on-surface">{children}</strong>,
  em: ({ children }: any) => <em className="italic">{children}</em>,
  ul: ({ children }: any) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
  li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }: any) => <h1 className="font-headline-md text-headline-md text-on-surface mt-4 mb-2">{children}</h1>,
  h2: ({ children }: any) => <h2 className="font-headline-md text-headline-md text-on-surface mt-4 mb-2">{children}</h2>,
  h3: ({ children }: any) => <h3 className="font-body-lg text-body-lg font-semibold text-on-surface mt-3 mb-1">{children}</h3>,
  a: ({ children, href }: any) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-secondary underline underline-offset-2 hover:opacity-80">
      {children}
    </a>
  ),
  code: ({ children }: any) => <code className="font-code-sm text-code-sm bg-surface-container-high px-1.5 py-0.5 rounded">{children}</code>,
  pre: ({ children }: any) => <pre className="font-code-sm text-code-sm bg-surface-container-high p-3 rounded-lg overflow-x-auto mb-3">{children}</pre>,
  blockquote: ({ children }: any) => <blockquote className="border-l-2 border-outline-variant pl-3 italic text-on-surface-variant mb-3">{children}</blockquote>,
  hr: () => <hr className="border-outline-variant my-3" />,
}

export function Markdown({ children }: { children: string }) {
  const content = stripToolTagWrapper(children)

  const regex = /((?:🤔 \*\*Thinking Process:\*\*|🔍 \*\*Web Search Thinking:\*\*)\n(?:> .*(?:\n|$))+)/g
  const parts = content.split(regex)

  let lastThinkingIndex = -1
  parts.forEach((part, index) => {
    if (part && (part.startsWith('🤔 **Thinking Process:**') || part.startsWith('🔍 **Web Search Thinking:**'))) {
      lastThinkingIndex = index
    }
  })

  return (
    <div className="font-body-lg text-body-md sm:text-body-lg text-on-surface [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      {parts.map((part, index) => {
        if (!part) return null

        if (part.startsWith('🤔 **Thinking Process:**') || part.startsWith('🔍 **Web Search Thinking:**')) {
          if (index !== lastThinkingIndex) return null

          const isWebSearch = part.startsWith('🔍')
          const title = isWebSearch ? 'Web Search Thinking' : 'Thinking Process'
          const icon = isWebSearch ? 'travel_explore' : 'psychology'
          
          const blockquoteContent = part.replace(/^.*\n/, '').replace(/^> ?/gm, '')

          return <ThinkingAccordion key={index} title={title} icon={icon} content={blockquoteContent} />
        }

        return (
          <ReactMarkdown key={index} remarkPlugins={[remarkGfm]} components={sharedComponents}>
            {part}
          </ReactMarkdown>
        )
      })}
    </div>
  )
}
