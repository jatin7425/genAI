import { useEffect, useRef, useState } from 'react'
import { extractCompanion, saveCompanion, type Companion } from '../../api/companions'
import { useDialogFocus } from '../../hooks/useDialogFocus'
import { Icon } from '../Icon'
const REQUIRED = ['name', 'age', 'personality', 'relationship'] as const
const OPTIONAL = { height: '', body_type: '', appearance: '', hobbies: '', background: '', communication_style: '' }
export function CompanionEditor({ profile, model, onClose, onSaved }: { profile?: Companion; model: string | null; onClose: () => void; onSaved: (profile: Companion) => void }) {
  const [description, setDescription] = useState(profile?.description ?? '')
  const [attributes, setAttributes] = useState<Record<string, string>>({ ...OPTIONAL, ...(profile?.attributes ?? {}) })
  const [step, setStep] = useState(profile ? 'review' : 'describe'), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [extraKey, setExtraKey] = useState(''), [extraValue, setExtraValue] = useState('')
  const extraction = useRef<AbortController | null>(null)
  useEffect(() => () => extraction.current?.abort(), [])
  const close = () => { if (busy && !extraction.current) return; extraction.current?.abort(); onClose() }
  const ref = useDialogFocus(true, close)
  const missing = REQUIRED.filter(key => !attributes[key]?.trim())
  const validAge = /^\d+$/.test(attributes.age ?? '') && Number(attributes.age) >= 18
  const set = (key: string, value: string) => setAttributes(prev => ({ ...prev, [key]: value }))
  const analyze = async () => { if (!model || !description.trim() || busy) return; setBusy(true); setError(''); const controller = new AbortController(); extraction.current = controller; const timeout = setTimeout(() => controller.abort(), 90000); try { const result = await extractCompanion(description.trim(), model, controller.signal); setAttributes({ ...OPTIONAL, ...result.attributes }); setStep('review') } catch (err) { setError(err instanceof Error && err.name === 'AbortError' ? 'Analysis timed out. Try another model or fill in the details manually.' : err instanceof Error ? err.message : 'Could not extract details.') } finally { clearTimeout(timeout); extraction.current = null; setBusy(false) } }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 backdrop-blur-sm p-3 sm:p-6">
    <div ref={ref} role="dialog" aria-modal="true" aria-label={profile ? 'Edit companion' : 'Create companion'} tabIndex={-1} className="companion-editor w-full max-w-3xl max-h-[92dvh] overflow-y-auto rounded-3xl border border-[#6c516e] bg-[#21182b] text-[#faeef5] p-5 sm:p-8">
      <header className="flex items-start justify-between gap-4"><div><p className="cw-eyebrow">{step === 'describe' ? '01 / Her story' : '02 / Make her yours'}</p><h2 className="text-2xl sm:text-3xl font-serif mt-2">{profile ? 'Refine her character.' : step === 'describe' ? 'Who would you like to meet?' : 'A few details, a whole personality.'}</h2></div><button disabled={busy && !extraction.current} onClick={close} aria-label="Close companion editor"><Icon name="close" /></button></header>
      <p className="text-sm text-[#c6b4c9] mt-3 mb-5">Describe her in your words. Review the extracted facts before saving. Her original description is kept too.</p>
      <label htmlFor="companion-description" className="cw-label">Character description</label><textarea id="companion-description" disabled={busy} maxLength={20000} rows={step === 'describe' ? 7 : 3} value={description} onChange={e => setDescription(e.target.value)} className="cw-input w-full mt-2" placeholder="Her name is Mira. She's 24, 165 cm tall, with an athletic build and curly dark hair. She's warm, witty, loves books and rainy walks, and we've been dating for six months. She speaks English and Hindi…" />
      {step === 'review' && <>
        <div className="rounded-xl bg-[#38223b] p-3 my-5 text-sm text-[#e5c4dc]">{missing.length ? `Please add ${missing.join(', ')} to complete her character.` : 'The essentials are ready. You can change any detail below.'}</div>
        <div className="grid sm:grid-cols-2 gap-4">{REQUIRED.map(key => <div key={key}><label htmlFor={`companion-${key}`} className="cw-label">{key === 'age' ? 'Age (18 or older)' : key === 'relationship' ? 'Relationship with you' : key[0].toUpperCase()+key.slice(1)} <span className="text-[#e4aacd]">*</span></label><input id={`companion-${key}`} disabled={busy} type={key === 'age' ? 'number' : 'text'} min={key === 'age' ? 18 : undefined} maxLength={2000} value={attributes[key] ?? ''} onChange={e => set(key, e.target.value)} className="cw-input w-full mt-2" /></div>)}</div>
        <h3 className="text-sm font-semibold mt-6 mb-3">Everything that makes her, her</h3>
        <div className="space-y-3">{Object.entries(attributes).filter(([key]) => !REQUIRED.includes(key as typeof REQUIRED[number])).map(([key, value]) => <div key={key} className="grid grid-cols-[1fr_auto] sm:grid-cols-[140px_1fr_auto] gap-2 items-start"><label htmlFor={`detail-${key}`} className="text-xs text-[#cbaeca] py-3 break-all">{key.replaceAll('_', ' ')}</label><textarea id={`detail-${key}`} disabled={busy} rows={2} value={value} maxLength={2000} onChange={e => set(key, e.target.value)} className="cw-input col-start-1 sm:col-start-auto w-full" /><button disabled={busy} aria-label={`Remove detail ${key}`} onClick={() => setAttributes(prev => { const next = { ...prev }; delete next[key]; return next })} className="p-3"><Icon name="close" /></button></div>)}</div>
        <div className="mt-4 grid sm:grid-cols-[1fr_1.5fr_auto] gap-2"><input aria-label="Extra detail key" value={extraKey} onChange={e => setExtraKey(e.target.value)} maxLength={100} className="cw-input" placeholder="e.g. favourite_music" /><input aria-label="Extra detail value" value={extraValue} onChange={e => setExtraValue(e.target.value)} maxLength={2000} className="cw-input" placeholder="Her favourite music" /><button disabled={busy || !extraKey.trim() || !extraValue.trim()} className="cw-secondary" onClick={() => { const key = extraKey.trim().toLowerCase().replace(/[^a-z0-9_.]+/g, '_').replace(/^_+|_+$/g, ''); if (!key) return; set(key, extraValue.trim()); setExtraKey(''); setExtraValue('') }}>Add detail</button></div>
      </>}
      {error && <p role="alert" className="mt-4 text-sm text-[#ffb4bd]">{error}</p>}
      <footer className="flex flex-wrap gap-3 justify-end mt-6 pt-5 border-t border-[#49364e]">
        {step === 'describe' ? <><button disabled={busy || !description.trim()} className="cw-secondary" onClick={() => { setStep('review'); setError('') }}>Fill in manually</button><button disabled={busy || !model || !description.trim()} className="cw-primary" onClick={() => void analyze()}>{busy ? 'Discovering her details…' : 'Extract character details'}</button></> : <><button disabled={busy || !model} className="cw-secondary" onClick={() => void analyze()}>Extract again</button><button disabled={busy || missing.length > 0 || !validAge || !description.trim()} className="cw-primary" onClick={async () => { setBusy(true); setError(''); try { onSaved(await saveCompanion(attributes, description.trim(), profile?.id)) } catch (err) { setError(err instanceof Error ? err.message : 'Could not save companion.') } finally { setBusy(false) } }}>{busy ? 'Saving…' : profile ? 'Save her character' : 'Create your companion'}</button></>}
      </footer>
    </div>
  </div>
}
