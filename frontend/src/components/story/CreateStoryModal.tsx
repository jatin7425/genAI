import { useState } from 'react'
import { useDialogFocus } from '../../hooks/useDialogFocus'
import { Icon } from '../Icon'
import type { StoryCharacter, StoryDraft } from '../../api/stories'

type CreateStoryModalProps = {
  initialIdea?: string
  onClose: () => void
  onCreate: (draft: StoryDraft) => Promise<void>
}

const field = 'w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-on-surface-variant/60'
const label = 'font-label-caps text-label-caps text-on-surface-variant'

export function CreateStoryModal({ initialIdea = '', onClose, onCreate }: CreateStoryModalProps) {
  const [title, setTitle] = useState('')
  const [premise, setPremise] = useState(initialIdea)
  const [inStory, setInStory] = useState(false)
  const [userRole, setUserRole] = useState('')
  const [characters, setCharacters] = useState<StoryCharacter[]>([])
  const [fleshOut, setFleshOut] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useDialogFocus(true, () => { if (!submitting) onClose() })

  const editCharacter = (index: number, patch: Partial<StoryCharacter>) =>
    setCharacters(list => list.map((c, i) => i === index ? { ...c, ...patch } : c))

  const canSubmit = premise.trim().length > 0 && (!inStory || userRole.trim().length > 0) && !submitting

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await onCreate({
        title: title.trim(),
        premise: premise.trim(),
        user_role: inStory ? userRole.trim() : '',
        characters: characters.filter(c => c.name.trim()).map(c => ({ name: c.name.trim(), description: c.description.trim() })),
        // Sending the idea as a description asks the model to fill in what's blank.
        description: fleshOut ? premise.trim() : '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The story could not be created.')
      setSubmitting(false)
    }
  }

  return (
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="create-story-title" className="bg-surface border border-outline-variant rounded-2xl shadow-[0_20px_80px_rgba(20,40,25,0.18)] max-h-[90dvh] w-full max-w-2xl flex flex-col">
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary grid place-items-center"><Icon name="menu_book" className="text-[19px]" /></div>
          <div>
            <h2 id="create-story-title" className="font-semibold text-lg text-on-surface">New story</h2>
            <p className="text-xs text-on-surface-variant">Set the scene. The narrator opens the story and you steer it.</p>
          </div>
        </div>
        <button onClick={onClose} disabled={submitting} aria-label="Close story setup" className="p-1 text-on-surface-variant hover:text-on-surface"><Icon name="close" /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-4 flex flex-col gap-5">
        <div className="space-y-2">
          <label htmlFor="story-premise" className={label}>STORY IDEA &amp; OPENING NARRATIVE</label>
          <textarea id="story-premise" value={premise} onChange={e => setPremise(e.target.value)} rows={5} maxLength={6000}
            className={`${field} resize-y min-h-[120px] leading-relaxed`}
            placeholder="A lighthouse keeper on a storm-cut island finds a stranger washed ashore who knows her name…" />
          <label className="flex items-center gap-2 text-xs text-on-surface-variant cursor-pointer">
            <input type="checkbox" checked={fleshOut} onChange={e => setFleshOut(e.target.checked)} className="accent-primary" />
            Let the narrator flesh out the title and cast from this idea
          </label>
        </div>

        <div className="space-y-2">
          <label htmlFor="story-title" className={label}>TITLE <span className="normal-case tracking-normal font-normal">(optional)</span></label>
          <input id="story-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} className={field} placeholder="The Keeper of Gull Rock" />
        </div>

        <fieldset className="space-y-2">
          <legend className={`${label} mb-2`}>YOUR PART IN THE STORY</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[{ value: false, title: 'Just guide the narrator', text: 'Direct the story from outside.' }, { value: true, title: 'I’m a character', text: 'Play a role inside the story.' }].map(option => (
              <label key={String(option.value)} className={`flex gap-3 rounded-xl border px-3 py-3 cursor-pointer transition-colors ${inStory === option.value ? 'border-primary bg-primary/5' : 'border-outline-variant hover:bg-surface-container'}`}>
                <input type="radio" name="story-role" checked={inStory === option.value} onChange={() => setInStory(option.value)} className="mt-1 accent-primary" />
                <span><span className="block text-sm font-medium text-on-surface">{option.title}</span><span className="block text-xs text-on-surface-variant">{option.text}</span></span>
              </label>
            ))}
          </div>
          {inStory && <input aria-label="Your character" value={userRole} onChange={e => setUserRole(e.target.value)} maxLength={1500} className={field} placeholder="Who you play, e.g. Mara, the lighthouse keeper — stubborn, haunted by her brother’s disappearance" />}
        </fieldset>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={label}>CHARACTERS</span>
            <button type="button" onClick={() => setCharacters(list => [...list, { name: '', description: '' }])} disabled={characters.length >= 30} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-40"><Icon name="add" className="text-[15px]" />Add character</button>
          </div>
          {!characters.length && <p className="text-xs text-on-surface-variant rounded-xl border border-dashed border-outline-variant px-3 py-4 text-center">No characters yet. Add your own, or let the narrator introduce them as the story unfolds.</p>}
          {characters.map((character, index) => (
            <div key={index} className="rounded-xl border border-outline-variant p-3 flex flex-col gap-2">
              <div className="flex gap-2">
                <input aria-label={`Character ${index + 1} name`} value={character.name} onChange={e => editCharacter(index, { name: e.target.value })} maxLength={80} className={field} placeholder="Name" />
                <button type="button" onClick={() => setCharacters(list => list.filter((_, i) => i !== index))} aria-label={`Remove character ${index + 1}`} className="p-2 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10"><Icon name="delete" className="text-[16px]" /></button>
              </div>
              <textarea aria-label={`Character ${index + 1} description`} value={character.description} onChange={e => editCharacter(index, { description: e.target.value })} rows={2} maxLength={1500} className={`${field} resize-y`} placeholder="Appearance, personality, motives, relationships…" />
            </div>
          ))}
        </div>
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
      </div>

      <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-outline-variant">
        <p className="hidden sm:block text-[11px] text-on-surface-variant">Tip: type <code className="font-code-sm">/createstory</code> followed by your idea in any chat.</p>
        <div className="flex gap-2 ml-auto">
          <button onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm rounded-lg hover:bg-surface-container-high">Cancel</button>
          <button onClick={submit} disabled={!canSubmit} className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-on-primary hover:bg-primary-fixed disabled:opacity-50 disabled:cursor-not-allowed">{submitting ? 'Setting the scene…' : 'Begin story'}</button>
        </div>
      </div>
    </div>
  )
}
