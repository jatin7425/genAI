import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Icon } from '../components/Icon'
import { ModelSwitcher } from '../components/chat/ModelSwitcher'
import { WorldUnlockModal } from '../components/companion/WorldUnlockModal'
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
  const [model, setModel] = useState<string | null>(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [thinking, setThinking] = useState(''), [error, setError] = useState('')
  const [editor, setEditor] = useState<'new' | Companion | null>(null), [pendingDelete, setPendingDelete] = useState<Companion | null>(null)
  const controller = useRef<AbortController | null>(null), bottom = useRef<HTMLDivElement>(null)
  const selectedRef = useRef(selected?.id)
  selectedRef.current = selected?.id
  useEffect(() => { if (!isAuthenticated) navigate('/login', { replace: true }) }, [isAuthenticated, navigate])
  useEffect(() => { const locked = () => { controller.current?.abort(); setUnlocked(false); setProfiles([]); setTurns([]); setBusy(false) }; window.addEventListener('secret_world_locked', locked); return () => { controller.current?.abort(); window.removeEventListener('secret_world_locked', locked) } }, [])
  useEffect(() => { let cancelled = false; if (!unlocked || !isAuthenticated) { setLoading(false); return } setLoading(true); fetchCompanions().then(items => { if (!cancelled) { setProfiles(items); setError('') } }).catch(err => { if (!cancelled) setError(err.message) }).finally(() => { if (!cancelled) setLoading(false) }); return () => { cancelled = true } }, [unlocked, isAuthenticated])
  useEffect(() => {
    let cancelled = false
    controller.current?.abort()
    setBusy(false); setTurns([]); setThreadId(null); setThreads([]); setMessage(''); setThinking(''); setHistoryOpen(false); setError('')
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
  return <div className={`companion-world ${companionId ? "cw-chat-world" : "min-h-dvh"}`}>
    {!unlocked && <WorldUnlockModal onClose={() => navigate('/chat')} onUnlocked={() => setUnlocked(true)} />}
    <header className="cw-topbar"><button aria-label={companionId ? 'Back to companions' : 'Back to Cortex'} onClick={() => navigate(companionId ? '/secret-world' : '/chat')} className="cw-back"><Icon name="arrow_back" /><span>{companionId ? 'All companions' : 'Back to Cortex'}</span></button><span className="cw-logo"><Icon name="auto_awesome" /> Secret world</span>{unlocked && <button aria-label="Lock secret world" onClick={() => { controller.current?.abort(); void lockWorld().catch(() => {}).finally(() => navigate('/chat')) }} className="cw-back"><Icon name="lock" /><span className="hidden sm:inline">Lock world</span></button>}</header>
    {unlocked && error && <div role="alert" className="cw-error">{error}</div>}
    {unlocked && !companionId && <CompanionGallery profiles={profiles} loading={loading} model={model} onModel={setModel} onCreate={() => setEditor('new')} onEdit={setEditor} onDelete={setPendingDelete} />}
    {unlocked && companionId && !selected && <main className="cw-gallery"><p role="status">{loading ? 'Opening your conversation…' : 'This companion could not be found.'}</p>{!loading && <button className="cw-secondary mt-5" onClick={() => navigate('/secret-world')}>Back to companions</button>}</main>}
    {unlocked && companionId && selected && <main className="cw-layout cw-chat-page">
      <aside id="companion-history" className={`cw-sidebar ${historyOpen ? 'history-open' : ''}`} aria-label="Companion conversation history">
        <div className="flex justify-between items-center mb-4"><div><p className="cw-eyebrow">Your conversations</p><h2 className="font-serif text-xl mt-2">Chapters with {selected.attributes.name}.</h2></div><button disabled={busy || loadingThreads} aria-label="New companion conversation" className="cw-round" onClick={() => { setThreadId(null); setTurns([]); setError(''); setHistoryOpen(false) }}><Icon name="add" /></button></div>
        {loadingThreads && <p role="status" className="text-sm opacity-60">Loading conversations…</p>}
        <div className="space-y-1">{threads.map(thread => <button disabled={busy} key={thread.id} onClick={() => { setThreadId(thread.id); setTurns(thread.turns); setError(''); setHistoryOpen(false) }} className={`cw-thread ${threadId === thread.id ? 'selected' : ''}`}>{thread.turns.find(t => t.kind === 'user')?.text.slice(0, 55) || 'New conversation'}</button>)}</div>
        {!threads.length && !loadingThreads && <p className="cw-sidebar-note">Your first conversation starts here.</p>}
      </aside>
      <section className="cw-main" aria-label="Companion chat">
          <div className="cw-chat-header"><div className="flex gap-3 items-center min-w-0"><span className="cw-avatar small">{selected.attributes.name[0]}</span><div className="min-w-0"><h1 className="text-xl font-serif truncate">{selected.attributes.name}</h1><p className="text-xs opacity-60 truncate">{selected.attributes.relationship}</p></div></div><div className="flex gap-2 items-center"><button aria-label="Conversation history" aria-expanded={historyOpen} aria-controls="companion-history" onClick={() => setHistoryOpen(v => !v)} className="cw-round cw-history-toggle"><Icon name="chat_bubble" /></button><ModelSwitcher activeModel={model} onSelectModel={setModel} disabled={busy} /><button disabled={busy} aria-label="Edit companion details" onClick={() => setEditor(selected)} className="cw-round"><Icon name="edit" /></button><button disabled={busy} aria-label="Delete companion" onClick={() => setPendingDelete(selected)} className="cw-round"><Icon name="delete" /></button></div></div>
          <div className="cw-messages">{!turns.length && <div className="cw-empty-chat"><p className="font-serif text-2xl mb-3">A new chapter with {selected.attributes.name}.</p><p>Say hello, share your day, or start a story together.</p></div>}{turns.map(turn => <div key={turn.id} className={`cw-message ${turn.kind}`}><span className="cw-message-author">{turn.kind === 'user' ? 'You' : selected.attributes.name}</span><p>{turn.text}</p></div>)}{busy && thinking && <p role="status" className="cw-thinking">{thinking}</p>}<div ref={bottom} /></div>
          <form className="cw-composer" onSubmit={e => { e.preventDefault(); send() }}><textarea aria-label="Message your companion" rows={2} maxLength={20000} disabled={busy || loadingThreads} value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder={`Message ${selected.attributes.name}…`} /><button disabled={busy || loadingThreads || !message.trim() || !model} aria-label="Send companion message" className="cw-round send"><Icon name={busy ? 'progress_activity' : 'arrow_upward'} className={busy ? 'animate-spin' : ''} /></button></form>
      </section>
    </main>}
    {editor && <CompanionEditor profile={editor === 'new' ? undefined : editor} model={model} onClose={() => setEditor(null)} onSaved={profile => { setProfiles(prev => [profile, ...prev.filter(p => p.id !== profile.id)]); const created = editor === 'new'; setEditor(null); setError(''); if (created || companionId) navigate(`/secret-world/${encodeURIComponent(profile.id)}`) }} />}
    {pendingDelete && <ConfirmDialog title="Delete companion?" description={`This deletes ${pendingDelete.attributes.name}'s character details and conversations.`} confirmLabel="Delete" onCancel={() => setPendingDelete(null)} onConfirm={() => { const profile = pendingDelete; void deleteCompanion(profile.id).then(() => { setProfiles(prev => prev.filter(p => p.id !== profile.id)); if (companionId === profile.id) navigate('/secret-world'); setPendingDelete(null) }).catch(err => setError(err.message)) }} />}
  </div>
}
