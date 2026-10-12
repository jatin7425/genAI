import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Icon } from '../components/Icon'
import { ModelSwitcher } from '../components/chat/ModelSwitcher'
import { CompanionDrawer } from '../components/companion/CompanionDrawer'
import { fetchModels } from '../api/models'
import { WorldUnlockModal } from '../components/companion/WorldUnlockModal'
import { CompanionPhotos } from '../components/companion/CompanionPhotos'
import { CompanionPhoto } from '../components/companion/CompanionPhoto'
import { CompanionGallery } from '../components/companion/CompanionGallery'
import { CompanionEditor } from '../components/companion/CompanionEditor'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { fetchCompanions, fetchCompanionThreads, deleteCompanion, streamCompanion, hasWorldToken, lockWorld, type Companion, type CompanionThread, type CompanionTurn } from '../api/companions'
import '../companion.css'
export function CompanionScreen() {
  const navigate = useNavigate(), { isAuthenticated } = useAuth()
  const { companionId } = useParams<{ companionId: string }>()
  const [unlocked, setUnlocked] = useState(hasWorldToken), [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState<Companion[]>([])
  const selected = profiles.find(profile => profile.id === companionId) ?? null
  const [loadingThreads, setLoadingThreads] = useState(false), [historyOpen, setHistoryOpen] = useState(false)
  const [threads, setThreads] = useState<CompanionThread[]>([]), [threadId, setThreadId] = useState<string | null>(null), [turns, setTurns] = useState<CompanionTurn[]>([])
  const [model, setModel] = useState<string | null>(() => sessionStorage.getItem('cortex.companionModel')), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [thinking, setThinking] = useState(''), [error, setError] = useState('')
  const [editor, setEditor] = useState<'new' | Companion | null>(null), [pendingDelete, setPendingDelete] = useState<Companion | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [photoProfileId, setPhotoProfileId] = useState<string | null>(null)
  const photoProfile = profiles.find(profile => profile.id === photoProfileId)
  const controller = useRef<AbortController | null>(null), bottom = useRef<HTMLDivElement>(null)
  const selectedRef = useRef(selected?.id)
  selectedRef.current = selected?.id
  useEffect(() => { if (!isAuthenticated) navigate('/login', { replace: true }) }, [isAuthenticated, navigate])
  useEffect(() => { const locked = () => { controller.current?.abort(); setUnlocked(false); setProfiles([]); setTurns([]); setBusy(false); setPhotoProfileId(null); setSettingsOpen(false); setHistoryOpen(false) }; window.addEventListener('secret_world_locked', locked); return () => { controller.current?.abort(); window.removeEventListener('secret_world_locked', locked) } }, [])
  useEffect(() => { let cancelled = false; if (!unlocked || !isAuthenticated) { setLoading(false); return } setLoading(true); fetchCompanions().then(items => { if (!cancelled) { setProfiles(items); setError('') } }).catch(err => { if (!cancelled) setError(err.message) }).finally(() => { if (!cancelled) setLoading(false) }); return () => { cancelled = true } }, [unlocked, isAuthenticated])
  useEffect(() => {
    let cancelled = false
    controller.current?.abort()
    setBusy(false); setTurns([]); setThreadId(null); setThreads([]); setMessage(''); setThinking(''); setHistoryOpen(false); setSettingsOpen(false); setError('')
    if (!selected) { setLoadingThreads(false); return }
    setLoadingThreads(true)
    fetchCompanionThreads(selected.id).then(items => {
      if (!cancelled) {
        setThreads(items)
        if (items[0]) { setThreadId(items[0].id); setTurns(items[0].turns) }
      }
    }).catch(err => { if (!cancelled) setError(err.message) }).finally(() => { if (!cancelled) setLoadingThreads(false) })
    return () => { cancelled = true }
  }, [selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!unlocked) return
    let cancelled = false
    fetchModels().then(models => { if (!cancelled) setModel(current => current && models.includes(current) ? current : models[0] ?? null) }).catch(() => { if (!cancelled) setError('Could not load models. Try refreshing the page.') })
    return () => { cancelled = true }
  }, [unlocked])
  useEffect(() => { if (model) sessionStorage.setItem('cortex.companionModel', model) }, [model])
  const closeWorld = () => { controller.current?.abort(); void lockWorld().catch(() => {}).finally(() => navigate('/chat')) }
  const fullscreen = () => { const element = document.querySelector<HTMLElement>('.cw-chat-world'); if (!element?.requestFullscreen) { setError('Full-screen mode is not available in this browser. Chat already fills the page.'); return } void element.requestFullscreen().then(() => setSettingsOpen(false)).catch(() => setError('The browser could not enter full-screen mode.')) }
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [turns, thinking])
  const send = () => {
    if (!selected || !model || busy || loadingThreads || !message.trim()) return
    const text = message.trim(), id = crypto.randomUUID(), profileId = selected.id
    let currentThread = threadId
    const abort = new AbortController(); controller.current = abort
    setTurns(prev => [...prev, { id: crypto.randomUUID(), kind: 'user', text }]); setMessage(''); setBusy(true); setError('')
    const addReply = (text: string, append = false) => setTurns(prev => prev.some(t => t.id === id) ? prev.map(t => t.id === id ? { ...t, text: append ? t.text + text : text } : t) : [...prev, { id, kind: 'agent', text }])
    const finished = () => { setBusy(false); setThinking(''); if (!abort.signal.aborted) void fetchCompanionThreads(profileId).then(items => { if (!abort.signal.aborted && selectedRef.current === profileId) setThreads(items) }).catch(() => {}) }
    void streamCompanion(profileId, text, model, currentThread, {
      onSession: value => { if (abort.signal.aborted) return; currentThread = value; setThreadId(value) }, onThinking: value => { if (!abort.signal.aborted) setThinking(value) },
      onToken: token => { if (abort.signal.aborted) return; setThinking(''); addReply(token, true) },
      onQuestion: question => { if (abort.signal.aborted) return; addReply(question); finished() },
      onDone: result => { if (abort.signal.aborted) return; if (result.answer) addReply(result.answer); if (result.status !== 'done' || result.note) setError(result.provider_issue?.message || result.note || 'The reply could not finish. Try again.'); finished() },
      onError: err => { setError(err.message); finished() },
    }, abort.signal)
  }
  if (!isAuthenticated) return null
  return <div className={`companion-world ${companionId ? 'cw-chat-world' : 'cw-gallery-world'}`}>
    {!unlocked && <WorldUnlockModal onClose={() => navigate('/chat')} onUnlocked={() => setUnlocked(true)} />}
    {!companionId && <header className="cw-topbar"><button aria-label="Back to Cortex" onClick={() => navigate('/chat')} className="cw-back"><Icon name="arrow_back" /><span>Cortex</span></button><span className="cw-logo"><Icon name="auto_awesome" />Secret world<span className="cw-brand-label">COMPANIONS</span></span>{unlocked && <button aria-label="Lock secret world" onClick={closeWorld} className="cw-round"><Icon name="lock" /></button>}</header>}
    {unlocked && error && <div role="alert" className="cw-error">{error}</div>}
    {unlocked && !companionId && <CompanionGallery profiles={profiles} loading={loading} model={model} onModel={setModel} onCreate={() => setEditor('new')} onEdit={setEditor} onDelete={setPendingDelete} onPhotos={profile => setPhotoProfileId(profile.id)} />}
    {unlocked && companionId && !selected && <main className="cw-missing-profile"><p role="status">{loading ? 'Opening your conversation…' : 'This companion could not be found.'}</p><button className="cw-secondary" aria-label="Back to companions" onClick={() => navigate('/secret-world')}>Back to companions</button></main>}
    {unlocked && companionId && selected && <main className="cw-chat-page">
      <div className="cw-chat-backdrop" aria-hidden="true">{selected.chat_background_id && <CompanionPhoto profileId={selected.id} imageId={selected.chat_background_id} alt="Chat background" />}<div className="cw-chat-veil" /></div>
      <section className="cw-main" aria-label="Companion chat">
        <header className="cw-chat-header">
          <button aria-label="Back to companions" onClick={() => navigate('/secret-world')} className="cw-round cw-chat-back"><Icon name="arrow_back" /></button>
          <button className="cw-chat-identity" aria-label="Open companion profile" onClick={() => setPhotoProfileId(selected.id)}><span className="cw-avatar small"><CompanionPhoto profileId={selected.id} imageId={selected.profile_picture?.id} alt={selected.attributes.name} /></span><span><h1>{selected.attributes.name}</h1><span className="cw-chat-subtitle">{selected.attributes.relationship}<span className="cw-ai-label">AI companion</span></span></span></button>
          <div className="cw-chat-actions"><button aria-label="Conversation history" aria-expanded={historyOpen} aria-controls="companion-history" onClick={() => setHistoryOpen(true)} className="cw-round" title="Conversations"><Icon name="chat_bubble" /></button><button aria-label="Companion photos" onClick={() => setPhotoProfileId(selected.id)} className="cw-round" title="Photos & background"><Icon name="photo_library" /></button><button aria-label="Chat settings" onClick={() => setSettingsOpen(true)} className="cw-round" title="Chat settings"><Icon name="tune" /></button></div>
        </header>
        <div className="cw-messages" role="log" aria-label="Chat messages"><div className="cw-message-column">
          {!turns.length && <div className="cw-empty-chat"><span className="cw-empty-avatar"><CompanionPhoto profileId={selected.id} imageId={selected.profile_picture?.id} alt={selected.attributes.name} /></span><p className="cw-eyebrow">Your story starts here</p><h2>Hey, I'm {selected.attributes.name}.</h2><p>{selected.attributes.personality}</p><div className="cw-conversation-starters">{['How was your day?', 'Tell me about yourself', 'Let’s start a story'].map(text => <button disabled={busy || loadingThreads} key={text} onClick={() => { setMessage(text); document.querySelector<HTMLTextAreaElement>('[aria-label="Message your companion"]')?.focus() }}>{text}<Icon name="arrow_forward" /></button>)}</div></div>}
          {!!turns.length && <p className="cw-chat-chapter">Your conversation with {selected.attributes.name}</p>}
          {turns.map(turn => <div key={turn.id} className={`cw-message ${turn.kind}`}><span className="cw-message-author">{turn.kind === 'user' ? 'You' : selected.attributes.name}</span><p>{turn.text}</p></div>)}
          {busy && <div role="status" className="cw-thinking"><span className="cw-typing-dots"><i/><i/><i/></span>{thinking || `${selected.attributes.name} is thinking…`}</div>}<div ref={bottom} />
        </div></div>
        <div className="cw-composer-area"><form className="cw-composer" onSubmit={e => { e.preventDefault(); send() }}><textarea aria-label="Message your companion" rows={1} maxLength={20000} disabled={busy || loadingThreads} value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder={`Message ${selected.attributes.name}…`} /><button disabled={busy || loadingThreads || !message.trim() || !model} aria-label="Send companion message" className="cw-round send"><Icon name={busy ? 'progress_activity' : 'arrow_upward'} className={busy ? 'animate-spin' : ''} /></button></form><p className="cw-composer-note">{model || 'Choose a model in settings'}<span>·</span>AI companion</p></div>
      </section>
      {historyOpen && <CompanionDrawer label="Conversations" onClose={() => setHistoryOpen(false)}><aside id="companion-history" aria-label="Companion conversation history"><p className="cw-drawer-description">Your chapters with {selected.attributes.name}.</p><button disabled={busy || loadingThreads} className="cw-primary cw-new-chapter" aria-label="New companion conversation" onClick={() => { setThreadId(null); setTurns([]); setError(''); setHistoryOpen(false) }}><Icon name="add" />Start a new chapter</button>{loadingThreads && <p role="status">Loading conversations…</p>}<div className="cw-thread-list">{threads.map(thread => <button disabled={busy} key={thread.id} onClick={() => { setThreadId(thread.id); setTurns(thread.turns); setError(''); setHistoryOpen(false) }} className={`cw-thread ${threadId === thread.id ? 'selected' : ''}`}><Icon name="chat_bubble" /><span>{thread.turns.find(t => t.kind === 'user')?.text.slice(0, 55) || 'New conversation'}</span>{threadId === thread.id && <Icon name="check" />}</button>)}</div>{!threads.length && !loadingThreads && <p className="cw-drawer-description">Your first conversation starts here.</p>}</aside></CompanionDrawer>}
      {settingsOpen && <CompanionDrawer label="Chat settings" onClose={() => setSettingsOpen(false)}><div className="cw-settings-profile"><span className="cw-avatar"><CompanionPhoto profileId={selected.id} imageId={selected.profile_picture?.id} alt={selected.attributes.name}/></span><div><h3>{selected.attributes.name}</h3><p>{selected.attributes.age} · {selected.attributes.relationship}</p></div></div><div className="cw-setting-model"><span className="cw-eyebrow">Conversation model</span><ModelSwitcher activeModel={model} onSelectModel={setModel} disabled={busy}/></div><div className="cw-setting-actions"><button onClick={() => { setSettingsOpen(false); setPhotoProfileId(selected.id) }} aria-label="Change chat background"><Icon name="wallpaper"/><span>Chat background<small>Choose from her uploaded photos</small></span><Icon name="arrow_forward"/></button><button disabled={busy} aria-label="Edit companion details" onClick={() => { setSettingsOpen(false); setEditor(selected) }}><Icon name="edit"/><span>Edit character<small>Personality, story & details</small></span><Icon name="arrow_forward"/></button><button aria-label="Enter full screen" onClick={fullscreen}><Icon name="fullscreen"/><span>Enter full screen</span></button><button aria-label="Lock secret world" onClick={closeWorld}><Icon name="lock"/><span>Lock secret world</span></button><button disabled={busy} className="cw-danger" aria-label="Delete companion" onClick={() => { setSettingsOpen(false); setPendingDelete(selected) }}><Icon name="delete"/><span>Delete companion</span></button></div></CompanionDrawer>}
    </main>}
    {editor && <CompanionEditor profile={editor === 'new' ? undefined : editor} model={model} onClose={() => setEditor(null)} onSaved={profile => { setProfiles(prev => [profile, ...prev.filter(p => p.id !== profile.id)]); const created = editor === 'new'; setEditor(null); setError(''); if (created) setPhotoProfileId(profile.id); if (created || companionId) navigate(`/secret-world/${encodeURIComponent(profile.id)}`) }} />}
    {unlocked && photoProfile && <CompanionPhotos profile={photoProfile} onClose={() => setPhotoProfileId(null)} onChanged={profile => setProfiles(prev => prev.map(p => p.id === profile.id ? profile : p))} />}
    {pendingDelete && <ConfirmDialog title="Delete companion?" description={`This deletes ${pendingDelete.attributes.name}'s character details, photos, and conversations.`} confirmLabel="Delete" onCancel={() => setPendingDelete(null)} onConfirm={() => { const profile = pendingDelete; void deleteCompanion(profile.id).then(() => { setProfiles(prev => prev.filter(p => p.id !== profile.id)); if (companionId === profile.id) navigate('/secret-world'); setPendingDelete(null) }).catch(err => setError(err.message)) }} />}
  </div>
}
