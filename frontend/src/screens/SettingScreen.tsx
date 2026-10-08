import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { fetchPersonas, deletePersona } from '../api/personas'
import { CreatePersonaModal } from '../components/persona/CreatePersonaModal'
import { PersonaAvatar } from '../components/persona/PersonaAvatar'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { showToast } from '../utils/toastState'

const DEFAULT_PERSONA = 'Default Assistant'

export function SettingScreen() {
  const [personas, setPersonas] = useState<string[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(() => {
    setLoadError(null)
    fetchPersonas()
      .then(setPersonas)
      .catch(() => setLoadError("Couldn't load personas. Check your connection."))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await deletePersona(pendingDelete)
      setPersonas((prev) => prev?.filter((p) => p !== pendingDelete) ?? prev)
      showToast(`Deleted "${pendingDelete}".`, 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete persona.', 'error')
    } finally {
      setDeleting(false)
      setPendingDelete(null)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background p-6 md:p-8 custom-scrollbar">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="mb-1 text-2xl font-bold text-on-surface">Settings</h1>
        <p className="mb-8 text-on-surface-variant">Manage the personas available in your conversations.</p>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant/70">Personas</h2>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90"
          >
            <Icon name="add" className="text-[16px]" />
            New Persona
          </button>
        </div>

        {personas === null && !loadError && (
          <div className="flex items-center gap-3 py-6 text-sm text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
            Loading personas...
          </div>
        )}

        {loadError && (
          <div className="flex flex-col items-start gap-3 rounded-xl bg-error/10 p-4 text-error">
            <p className="text-sm">{loadError}</p>
            <button
              onClick={load}
              className="rounded-lg bg-error/15 px-3 py-1.5 text-sm font-medium text-error transition-colors hover:bg-error/25"
            >
              Try again
            </button>
          </div>
        )}

        {personas && personas.length > 0 && (
          <div className="flex flex-col gap-2">
            {personas.map((name) => {
              const isDefault = name === DEFAULT_PERSONA
              return (
                <div
                  key={name}
                  className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container px-4 py-3"
                >
                  <PersonaAvatar name={name} size="w-9 h-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-on-surface">{name}</p>
                    {isDefault && <p className="text-xs text-on-surface-variant">Default persona</p>}
                  </div>
                  <button
                    onClick={() => setPendingDelete(name)}
                    disabled={isDefault}
                    title={isDefault ? "The default persona can't be deleted" : 'Delete persona'}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-on-surface-variant"
                  >
                    <Icon name="delete" className="text-[18px]" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <CreatePersonaModal
            onClose={() => setCreateOpen(false)}
            onCreated={(name) => {
              setCreateOpen(false)
              load()
              showToast(`Created "${name}".`, 'success')
            }}
          />
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete persona?"
          description={`"${pendingDelete}" will be permanently deleted. This can't be undone.`}
          confirmLabel={deleting ? 'Deleting...' : 'Delete'}
          busy={deleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}
