import { useState } from 'react'
import { Icon } from '../Icon'
import { createPersona } from '../../api/personas'

type CreatePersonaModalProps = {
  onClose?: () => void
  onCreated?: (name: string) => void
}

const MAX_CONTEXT_TOKENS = 128_000

export function CreatePersonaModal({ onClose, onCreated }: CreatePersonaModalProps) {
  const [name, setName] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // rough estimate matching the design's "120 tokens" placeholder scale
  const estimatedTokens = Math.round(systemPrompt.length / 4)
  const usagePercent = Math.min(100, (estimatedTokens / MAX_CONTEXT_TOKENS) * 100)

  const canSubmit = name.trim().length > 0 && systemPrompt.trim().length > 0 && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await createPersona(name.trim(), systemPrompt.trim())
      onCreated?.(name.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create persona')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-surface-container-high border border-outline-variant rounded-xl shadow-[0px_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-md w-full max-w-4xl flex flex-col md:flex-row overflow-hidden">
      <div className="flex-1 p-stack-md border-r border-outline-variant flex flex-col gap-stack-sm overflow-y-auto">
        <div className="flex items-center justify-between mb-unit">
          <h2 className="font-headline-md text-headline-md text-on-surface">Create Persona</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <Icon name="close" />
          </button>
        </div>
        <p className="text-on-surface-variant mb-stack-sm">
          Define the name and system prompt (behavior rules) for a new persona.
        </p>

        <div className="space-y-unit">
          <label className="font-label-caps text-label-caps text-on-surface-variant">IDENTITY</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder-on-surface-variant/50"
            placeholder="Persona Name (e.g., Data Analyst)"
            type="text"
          />
        </div>

        <div className="space-y-unit flex-1 flex flex-col mt-stack-sm">
          <label className="font-label-caps text-label-caps text-on-surface-variant flex justify-between items-center">
            <span>SYSTEM PROMPT (BEHAVIOR RULES)</span>
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="w-full flex-1 min-h-[200px] bg-surface-container border border-outline-variant rounded-lg p-3 text-on-surface font-code-sm text-code-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            placeholder="You are a senior data analyst. Your primary goal is to interpret raw JSON logs and provide actionable insights. Always structure your responses with a summary followed by bullet points..."
          />
        </div>

        {error && <p className="text-error text-sm">{error}</p>}
      </div>

      <div className="w-full md:w-[320px] bg-surface-container-low flex flex-col">
        <div className="p-stack-md flex-1 flex flex-col border-b border-outline-variant">
          <h3 className="font-label-caps text-label-caps text-on-surface-variant mb-stack-sm">LIVE PREVIEW</h3>
          <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <div className="bg-surface-container-high px-4 py-3 border-b border-outline-variant flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-surface-container-lowest border border-outline-variant flex items-center justify-center animate-pulse">
                <Icon name="person" className="text-on-surface-variant text-sm" />
              </div>
              <div className="flex flex-col">
                <span className="text-on-surface font-medium text-sm">{name || 'New Persona'}</span>
                <span className="text-primary text-[10px] flex items-center gap-1 font-code-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" /> Ready
                </span>
              </div>
            </div>
            <div className="p-4 bg-background min-h-[120px] flex flex-col gap-3">
              <div className="w-3/4 h-8 bg-surface-container-highest rounded-lg rounded-tl-none animate-pulse" />
              <div className="w-1/2 h-4 bg-surface-container-highest rounded-lg animate-pulse" />
            </div>
          </div>

          <div className="mt-stack-md p-4 bg-surface-container rounded-lg border border-outline-variant">
            <h4 className="text-on-surface text-sm font-medium mb-1">Context Window</h4>
            <p className="text-on-surface-variant text-xs mb-2">Estimated token usage based on system prompt.</p>
            <div className="w-full bg-surface-container-highest rounded-full h-1.5 mb-1">
              <div className="bg-primary h-1.5 rounded-full" style={{ width: `${Math.max(2, usagePercent)}%` }} />
            </div>
            <div className="flex justify-between text-[10px] font-code-sm text-on-surface-variant">
              <span>{estimatedTokens} tokens</span>
              <span>Max: 128k</span>
            </div>
          </div>
        </div>

        <div className="p-stack-md flex justify-end gap-3 bg-surface-container-low">
          <button
            onClick={onClose}
            className="px-4 py-2 font-body-md text-on-surface hover:bg-surface-container-high rounded-lg transition-colors border border-transparent"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 font-body-md bg-primary text-on-primary-container rounded-lg hover:bg-primary-container transition-colors shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Initializing...' : 'Initialize Persona'}
          </button>
        </div>
      </div>
    </div>
  )
}
