import { useEffect, useState } from 'react'
import { Icon } from '../Icon'
import { fetchPersonas } from '../../api/personas'

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('')
}

function PersonaAvatar({ name, size = 'w-8 h-8' }: { name: string; size?: string }) {
  return (
    <div
      className={`${size} rounded-full bg-primary-container flex items-center justify-center text-on-primary-container text-xs font-bold shrink-0`}
    >
      {initialsFor(name) || '?'}
    </div>
  )
}

type PersonaSwitcherProps = {
  activePersona: string
  onSelectPersona?: (name: string) => void
  onCreateNew?: () => void
  refreshKey?: number
}

export function PersonaSwitcher({ activePersona, onSelectPersona, onCreateNew, refreshKey }: PersonaSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [personas, setPersonas] = useState<string[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    fetchPersonas()
      .then(setPersonas)
      .catch((err) => setLoadError(err.message))
  }, [refreshKey])

  return (
    <div className="relative mr-stack-md">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 bg-surface-container border border-outline-variant rounded-lg px-4 py-2 hover:bg-surface-container-high transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
      >
        <PersonaAvatar name={activePersona} size="w-6 h-6" />
        <span className="font-body-md text-on-surface font-medium">{activePersona}</span>
        <Icon name="keyboard_arrow_down" className="text-on-surface-variant" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-unit w-64 bg-[#222222] border border-outline-variant rounded-xl shadow-[0px_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-md overflow-hidden flex flex-col py-2 z-10">
          <div className="px-4 py-2 border-b border-outline-variant mb-2">
            <span className="font-label-caps text-label-caps text-on-surface-variant">ACTIVE PERSONAS</span>
          </div>

          {loadError && <div className="px-4 py-2 text-error text-xs">{loadError}</div>}

          {personas.map((name) => {
            const isActive = name === activePersona
            return (
              <button
                key={name}
                onClick={() => {
                  onSelectPersona?.(name)
                  setOpen(false)
                }}
                className={`flex items-center gap-3 px-4 py-2 text-left w-full transition-colors relative hover:bg-surface-container-high ${
                  isActive ? 'bg-surface-container-highest' : ''
                }`}
              >
                {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                <PersonaAvatar name={name} />
                <div className="flex flex-col">
                  <span className={isActive ? 'text-on-surface font-medium' : 'text-on-surface-variant'}>{name}</span>
                </div>
                {isActive && <Icon name="check_circle" filled className="text-primary ml-auto text-sm" />}
              </button>
            )
          })}

          <div className="border-t border-outline-variant mt-2 pt-2">
            <button
              onClick={() => {
                onCreateNew?.()
                setOpen(false)
              }}
              className="flex items-center gap-3 px-4 py-2 hover:bg-surface-container-high text-left w-full transition-colors text-primary"
            >
              <div className="w-8 h-8 rounded-full bg-primary-container/20 border border-primary flex items-center justify-center">
                <Icon name="add" className="text-primary" />
              </div>
              <span className="font-medium">Create New Persona</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
