import { useEffect, useState } from 'react'
import { Icon } from '../Icon'
import { fetchModels } from '../../api/models'

type ModelSwitcherProps = {
  activeModel: string | null
  onSelectModel: (model: string) => void
}

export function ModelSwitcher({ activeModel, onSelectModel }: ModelSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    setLoadError(null)
    fetchModels()
      .then((fetched) => {
        setModels(fetched)
        if (!activeModel && fetched.length > 0) onSelectModel(fetched[0])
      })
      .catch(() => setLoadError("Couldn't load models. Check your connection."))
      .finally(() => setLoading(false))
  }

  useEffect(load, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative mr-unit">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 bg-surface-container border border-outline-variant rounded-lg px-2 sm:px-3 py-2 hover:bg-surface-container-high transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
      >
        <Icon name="tune" className="text-on-surface-variant text-[18px]" />
        <span className="hidden sm:inline font-body-md text-on-surface font-medium text-sm max-w-[100px] truncate">
          {activeModel ?? 'Model'}
        </span>
        <Icon name="keyboard_arrow_down" className="text-on-surface-variant" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-unit w-56 bg-surface-container-high border border-outline-variant rounded-xl shadow-[0px_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-md overflow-hidden flex flex-col py-2 z-10">
          <div className="px-4 py-2 border-b border-outline-variant mb-2">
            <span className="font-label-caps text-label-caps text-on-surface-variant">MODE / MODEL</span>
          </div>

          {loading && <div className="px-4 py-2 text-on-surface-variant text-xs">Loading models...</div>}

          {loadError && (
            <div className="px-4 py-2 flex flex-col items-start gap-1.5">
              <p className="text-on-surface-variant text-xs">{loadError}</p>
              <button onClick={load} className="text-primary text-xs font-medium hover:underline">
                Try again
              </button>
            </div>
          )}

          {models.map((model) => {
            const isActive = model === activeModel
            return (
              <button
                key={model}
                onClick={() => {
                  onSelectModel(model)
                  setOpen(false)
                }}
                className={`flex items-center gap-3 px-4 py-2 text-left w-full transition-colors relative hover:bg-surface-container-high ${
                  isActive ? 'bg-surface-container-highest text-on-surface font-medium' : 'text-on-surface-variant'
                }`}
              >
                {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                <span className="flex-1 truncate text-sm">{model}</span>
                {isActive && <Icon name="check_circle" filled className="text-primary text-sm" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
