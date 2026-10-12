import { useEffect, useState } from 'react'
import { fetchMemory, saveMemory, removeMemory, type MemoryEntry } from '../api/memory'
import { ConfirmDialog } from './ui/ConfirmDialog'
export function GlobalMemory() {
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const load = async () => { setLoading(true); setError(''); try { setEntries(await fetchMemory()) } catch (e) { setError(e instanceof Error ? e.message : 'Could not load memory.') } finally { setLoading(false) } }
  useEffect(() => { void load() }, [])
  const mutate = async (action: () => Promise<void>) => { setBusy(true); setError(''); try { await action(); await load() } catch (e) { setError(e instanceof Error ? e.message : 'Memory update failed.') } finally { setBusy(false) } }
  return <section className="mt-10 mb-8">
    <h2 className="text-sm font-semibold mb-2">Shared memory</h2>
    <p className="text-xs text-on-surface-variant mb-4">Details about you, shared across sessions and personas. Each session keeps its own conversation history. Ask the assistant to remember or forget a detail, or manage it here.</p>
    {loading && <p role="status" className="text-sm">Loading memory…</p>}
    {error && <div role="alert" className="text-error text-sm mb-3">{error} <button onClick={() => void load()} className="underline">Try again</button></div>}
    {!loading && !error && entries.length === 0 && <p className="text-sm text-on-surface-variant mb-3">No saved details yet.</p>}
    <div className="space-y-2">{entries.map(entry => <div key={entry.key} className="p-4 rounded-xl bg-surface border border-outline-variant">
      <p className="font-medium text-sm break-words">{entry.key}</p><p className="text-sm text-on-surface-variant whitespace-pre-wrap break-words">{entry.value}</p>
      <div className="flex gap-3 mt-2"><button disabled={busy} aria-label={`Edit memory ${entry.key}`} onClick={() => { setKey(entry.key); setValue(entry.value); setEditing(true) }} className="text-primary text-xs">Edit</button><button disabled={busy} aria-label={`Delete memory ${entry.key}`} onClick={() => void mutate(() => removeMemory(entry.key))} className="text-error text-xs">Delete</button></div>
    </div>)}</div>
    <form className="mt-4 space-y-2" onSubmit={e => { e.preventDefault(); void mutate(async () => { await saveMemory(key.trim(), value.trim()); setKey(''); setValue(''); setEditing(false) }) }}>
      <label className="block text-xs" htmlFor="memory-key">Memory key</label>
      <input id="memory-key" maxLength={100} required disabled={busy || editing} value={key} onChange={e => setKey(e.target.value)} placeholder="preferred_language" className="w-full border border-outline-variant rounded-lg bg-surface p-2 text-sm" />
      <label className="block text-xs" htmlFor="memory-value">Memory value</label>
      <textarea id="memory-value" maxLength={2000} required disabled={busy} value={value} onChange={e => setValue(e.target.value)} placeholder="English and Hindi" className="w-full border border-outline-variant rounded-lg bg-surface p-2 text-sm" />
      <div className="flex flex-wrap gap-3"><button disabled={busy || loading || !key.trim() || !value.trim()} className="bg-primary text-on-primary rounded-lg px-3 py-2 text-sm disabled:opacity-50">{busy ? 'Saving…' : editing ? 'Save memory' : 'Add memory'}</button>
      {editing && <button type="button" onClick={() => { setKey(''); setValue(''); setEditing(false) }} className="text-sm">Cancel</button>}
      {entries.length > 0 && <button type="button" disabled={busy} onClick={() => setConfirmClear(true)} className="text-error text-sm">Clear shared memory</button>}</div>
    </form>
    {confirmClear && <ConfirmDialog title="Clear shared memory?" description="This removes saved details about you across all sessions. Conversation histories stay available." confirmLabel="Clear memory" busy={busy} onCancel={() => setConfirmClear(false)} onConfirm={() => void mutate(async () => { await removeMemory(); setConfirmClear(false) })} />}
  </section>
}
