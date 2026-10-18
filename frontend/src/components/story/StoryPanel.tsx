import { useEffect, useRef, useState } from 'react'
import { Icon } from '../Icon'
import { initialsFor } from '../../utils/personaInitials'
import { showToast } from '../../utils/toastState'
import type { Story, StoryCharacter } from '../../api/stories'

type StoryPanelProps = {
  story: Story
  onClose: () => void
  onUpdate: (fields: Partial<Pick<Story, 'title' | 'premise' | 'user_role'>>) => Promise<unknown>
  onSaveCharacter: (character: StoryCharacter, originalName?: string) => Promise<unknown>
  onRemoveCharacter: (name: string) => Promise<unknown>
}

const field = 'w-full bg-surface border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-on-surface-variant/60'
const NEW_BADGE_MS = 6000

async function attempt(action: () => Promise<unknown>) {
  try { await action(); return true } catch (err) {
    showToast(err instanceof Error ? err.message : 'The story could not be updated.', 'error')
    return false
  }
}

/** Story bible: the narrator reads this every turn, so edits here steer the story. */
export function StoryPanel({ story, onClose, onUpdate, onSaveCharacter, onRemoveCharacter }: StoryPanelProps) {
  const [editingSetup, setEditingSetup] = useState(false)
  const [editing, setEditing] = useState<string | null>(null) // character name, or '' for a new one
  const fresh = useFreshNames(story)

  return (
    <aside aria-label="Story cast" className="h-full w-full flex flex-col bg-surface-container-low border-r border-outline-variant">
      <div className="flex items-start gap-2 px-4 pt-4 pb-3 border-b border-outline-variant">
        <Icon name="menu_book" className="text-[18px] text-primary mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold tracking-wider uppercase text-on-surface-variant">Story mode</p>
          <h2 className="font-semibold text-sm leading-snug break-words">{story.title}</h2>
        </div>
        <button onClick={() => setEditingSetup(v => !v)} aria-label="Edit story setup" title="Edit story setup" className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high"><Icon name="edit" className="text-[15px]" /></button>
        <button onClick={onClose} aria-label="Hide story panel" title="Hide story panel" className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high"><Icon name="close" className="text-[15px]" /></button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-4">
        {editingSetup
          ? <SetupForm story={story} onCancel={() => setEditingSetup(false)} onSave={async fields => { if (await attempt(() => onUpdate(fields))) setEditingSetup(false) }} />
          : <section className="flex flex-col gap-3">
              <Collapsible label="Premise" text={story.premise || 'No premise yet.'} />
              <div>
                <p className="text-[10px] font-semibold tracking-wider uppercase text-on-surface-variant mb-1">Your part</p>
                <p className="text-xs leading-relaxed text-on-surface">{story.user_role || <span className="text-on-surface-variant">Guiding the narrator from outside the story.</span>}</p>
              </div>
            </section>}

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase text-on-surface-variant"><Icon name="group" className="text-[13px]" />Cast · {story.characters.length}</p>
            <button onClick={() => setEditing('')} disabled={editing !== null || story.characters.length >= 30} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-40"><Icon name="add" className="text-[14px]" />Add</button>
          </div>
          {editing === '' && <CharacterForm onCancel={() => setEditing(null)} onSave={async c => { if (await attempt(() => onSaveCharacter(c))) setEditing(null) }} />}
          {!story.characters.length && editing === null && <p className="text-xs text-on-surface-variant leading-relaxed">The narrator adds characters here as they appear, so none are forgotten.</p>}
          {story.characters.map(character => editing === character.name
            ? <CharacterForm key={character.name} initial={character} onCancel={() => setEditing(null)} onSave={async c => { if (await attempt(() => onSaveCharacter(c, character.name))) setEditing(null) }} />
            : <CharacterCard key={character.name} character={character} isNew={fresh.has(character.name)}
                onEdit={() => setEditing(character.name)}
                onRemove={() => void attempt(() => onRemoveCharacter(character.name)).then(ok => ok && showToast(`Removed ${character.name} from the cast.`, 'success'))} />)}
        </section>
      </div>
      <p className="px-4 py-3 border-t border-outline-variant text-[10px] leading-relaxed text-on-surface-variant">The narrator reads this every turn. Changes here shape what happens next.</p>
    </aside>
  )
}

/** Names added since the panel first showed this story, e.g. by the narrator mid-turn. */
function useFreshNames(story: Story) {
  const known = useRef<{ id: string; names: Set<string> } | null>(null)
  const timers = useRef<number[]>([])
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  useEffect(() => {
    const names = new Set(story.characters.map(c => c.name))
    if (known.current?.id !== story.session_id) {
      known.current = { id: story.session_id, names }
      setFresh(new Set())
      return
    }
    const added = [...names].filter(name => !known.current!.names.has(name))
    known.current.names = names
    if (!added.length) return
    setFresh(prev => new Set([...prev, ...added]))
    // Not tied to effect cleanup: story updates arrive often and must not cancel this.
    timers.current.push(window.setTimeout(() => setFresh(prev => new Set([...prev].filter(name => !added.includes(name)))), NEW_BADGE_MS))
  }, [story])
  return fresh
}

function Collapsible({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(v => !v)} aria-expanded={open} className="w-full flex items-center justify-between text-[10px] font-semibold tracking-wider uppercase text-on-surface-variant mb-1">
        {label}<Icon name="expand_more" className={`text-[14px] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <p className={`text-xs leading-relaxed text-on-surface whitespace-pre-wrap ${open ? '' : 'line-clamp-3'}`}>{text}</p>
    </div>
  )
}

function CharacterCard({ character, isNew, onEdit, onRemove }: { character: StoryCharacter; isNew: boolean; onEdit: () => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`group rounded-xl border p-2.5 transition-colors ${isNew ? 'border-primary bg-primary/5' : 'border-outline-variant bg-surface'}`}>
      <div className="flex items-start gap-2.5">
        <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 text-primary grid place-items-center text-[11px] font-semibold">{initialsFor(character.name)}</div>
        <button onClick={() => setOpen(v => !v)} aria-expanded={open} className="min-w-0 flex-1 text-left">
          <p className="flex items-center gap-1.5 text-sm font-medium leading-tight break-words"><span>{character.name}</span>{isNew && <span className="text-[9px] font-semibold uppercase tracking-wider text-on-primary bg-primary rounded px-1 py-0.5">New</span>}</p>
          <p className={`mt-0.5 text-xs leading-relaxed text-on-surface-variant whitespace-pre-wrap ${open ? '' : 'line-clamp-2'}`}>{character.description || 'No details yet.'}</p>
        </button>
        <div className="flex flex-col md:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button onClick={onEdit} aria-label={`Edit ${character.name}`} className="p-1 rounded text-on-surface-variant hover:text-on-surface"><Icon name="edit" className="text-[13px]" /></button>
          <button onClick={onRemove} aria-label={`Remove ${character.name}`} className="p-1 rounded text-on-surface-variant hover:text-error"><Icon name="delete" className="text-[13px]" /></button>
        </div>
      </div>
    </div>
  )
}

function CharacterForm({ initial, onCancel, onSave }: { initial?: StoryCharacter; onCancel: () => void; onSave: (character: StoryCharacter) => Promise<void> }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    await onSave({ name: name.trim(), description: description.trim() })
    setSaving(false)
  }
  return (
    <div className="rounded-xl border border-primary/50 bg-surface p-2.5 flex flex-col gap-2">
      <input autoFocus aria-label="Character name" value={name} onChange={e => setName(e.target.value)} maxLength={80} className={field} placeholder="Name" />
      <textarea aria-label="Character description" value={description} onChange={e => setDescription(e.target.value)} rows={4} maxLength={1500} className={`${field} resize-y`} placeholder="Appearance, personality, motives, relationships…" />
      <div className="flex justify-end gap-1.5">
        <button onClick={onCancel} className="px-2.5 py-1 text-xs rounded-lg hover:bg-surface-container-high">Cancel</button>
        <button onClick={save} disabled={!name.trim() || saving} className="px-2.5 py-1 text-xs font-medium rounded-lg bg-primary text-on-primary disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  )
}

function SetupForm({ story, onCancel, onSave }: { story: Story; onCancel: () => void; onSave: (fields: Pick<Story, 'title' | 'premise' | 'user_role'>) => Promise<void> }) {
  const [title, setTitle] = useState(story.title)
  const [premise, setPremise] = useState(story.premise)
  const [userRole, setUserRole] = useState(story.user_role)
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    await onSave({ title: title.trim(), premise: premise.trim(), user_role: userRole.trim() })
    setSaving(false)
  }
  return (
    <section className="rounded-xl border border-primary/50 bg-surface p-2.5 flex flex-col gap-2">
      <label className="text-[10px] font-semibold tracking-wider uppercase text-on-surface-variant">Title<input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} className={`${field} mt-1 normal-case tracking-normal font-normal`} /></label>
      <label className="text-[10px] font-semibold tracking-wider uppercase text-on-surface-variant">Premise<textarea value={premise} onChange={e => setPremise(e.target.value)} rows={5} maxLength={6000} className={`${field} mt-1 resize-y normal-case tracking-normal font-normal`} /></label>
      <label className="text-[10px] font-semibold tracking-wider uppercase text-on-surface-variant">Your part<textarea value={userRole} onChange={e => setUserRole(e.target.value)} rows={2} maxLength={1500} placeholder="Leave empty to guide from outside" className={`${field} mt-1 resize-y normal-case tracking-normal font-normal`} /></label>
      <div className="flex justify-end gap-1.5">
        <button onClick={onCancel} className="px-2.5 py-1 text-xs rounded-lg hover:bg-surface-container-high">Cancel</button>
        <button onClick={save} disabled={saving} className="px-2.5 py-1 text-xs font-medium rounded-lg bg-primary text-on-primary disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </section>
  )
}
