import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { stripToolTagWrapper } from '../../utils/text'

export function Markdown({ children }: { children: string }) {
  const content = stripToolTagWrapper(children)
  return (
    <div className="font-body-lg text-body-md sm:text-body-lg text-on-surface [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-on-surface">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }) => <h1 className="font-headline-md text-headline-md text-on-surface mt-4 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="font-headline-md text-headline-md text-on-surface mt-4 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="font-body-lg text-body-lg font-semibold text-on-surface mt-3 mb-1">{children}</h3>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-secondary underline underline-offset-2 hover:opacity-80"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="font-code-sm text-code-sm bg-surface-container-high px-1.5 py-0.5 rounded">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="font-code-sm text-code-sm bg-surface-container-high p-3 rounded-lg overflow-x-auto mb-3">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-outline-variant pl-3 italic text-on-surface-variant mb-3">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-outline-variant my-3" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
