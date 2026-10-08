import { useEffect, useState } from 'react'
import { Icon } from '../Icon'
import { fetchPersonas } from '../../api/personas'
import { PersonaAvatar } from './PersonaAvatar'

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
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    setLoadError(null)
    fetchPersonas()
      .then(setPersonas)
      .catch(() => setLoadError("Couldn't load personas. Check your connection."))
      .finally(() => setLoading(false))
  }

  useEffect(load, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative mr-stack-md">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 bg-surface-container border border-outline-variant rounded-lg px-2 sm:px-4 py-2 hover:bg-surface-container-high transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
      >
        <PersonaAvatar name={activePersona} size="w-6 h-6" />
        <span className="hidden sm:inline font-body-md text-on-surface font-medium max-w-[120px] truncate">
          {activePersona}
        </span>
        <Icon name="keyboard_arrow_down" className="text-on-surface-variant" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-unit w-64 bg-surface-container-high border border-outline-variant rounded-xl shadow-[0px_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-md overflow-hidden flex flex-col py-2 z-10">
          <div className="px-4 py-2 border-b border-outline-variant mb-2">
            <span className="font-label-caps text-label-caps text-on-surface-variant">ACTIVE PERSONAS</span>
          </div>

          {loading && <div className="px-4 py-2 text-on-surface-variant text-xs">Loading personas...</div>}

          {loadError && (
            <div className="px-4 py-2 flex flex-col items-start gap-1.5">
              <p className="text-on-surface-variant text-xs">{loadError}</p>
              <button onClick={load} className="text-primary text-xs font-medium hover:underline">
                Try again
              </button>
            </div>
          )}

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
