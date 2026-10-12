import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { fetchPersonas, deletePersona } from '../api/personas'
import { CreatePersonaModal } from '../components/persona/CreatePersonaModal'
import { PersonaAvatar } from '../components/persona/PersonaAvatar'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { showToast } from '../utils/toastState'

const DEFAULT_PERSONA = 'Default Assistant'

export function SettingScreen() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
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
    <div className="workspace-page flex h-full flex-col overflow-y-auto bg-background p-6 md:p-8 custom-scrollbar">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-xs text-primary font-medium mb-3">Make yourself at home</p>
        <h1 className="mb-3 text-3xl font-semibold tracking-tight text-on-surface">Your workspace, your way.</h1>
        <p className="mb-10 text-sm text-on-surface-variant">Fine-tune the experience and choose how Cortex works with you.</p>
        <section className="mb-10">
          <h2 className="text-sm font-semibold mb-3">Appearance</h2>
          <div className="flex items-center justify-between gap-4 p-5 bg-surface border border-outline-variant rounded-2xl">
            <div><p className="text-sm font-medium">A different light</p><p className="text-xs text-on-surface-variant mt-1">Choose the workspace that feels right.</p></div>
            <div className="flex p-1 bg-surface-container rounded-xl">
              {[false, true].map(value => <button key={String(value)} aria-pressed={dark === value} onClick={() => {
                setDark(value)
                document.documentElement.classList.toggle('dark', value)
                localStorage.setItem('cortex.theme', value ? 'dark' : 'light')
              }} className={`px-3 py-2 rounded-lg text-xs ${dark === value ? 'bg-surface shadow-sm text-primary font-semibold' : 'text-on-surface-variant'}`}>{value ? 'Dark' : 'Light'}</button>)}
            </div>
          </div>
        </section>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-on-surface">Personas</h2>
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
            <Icon name="progress_activity" className="animate-spin text-[18px]" />
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
          <div className="grid sm:grid-cols-2 gap-3">
            {personas.map((name) => {
              const isDefault = name === DEFAULT_PERSONA
              return (
                <div
                  key={name}
                  className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface px-4 py-5"
                >
                  <PersonaAvatar name={name} size="w-9 h-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-on-surface">{name}</p>
                    {isDefault && <p className="text-xs text-on-surface-variant">Default persona</p>}
                  </div>
                  <button
                    onClick={() => setPendingDelete(name)}
                    disabled={isDefault}
                    aria-label={`Delete ${name}`}
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
