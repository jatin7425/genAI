import { useState } from 'react'
import { useDialogFocus } from '../../hooks/useDialogFocus'
import { unlockWorld } from '../../api/companions'
import { Icon } from '../Icon'
export function WorldUnlockModal({ onClose, onUnlocked }: { onClose: () => void; onUnlocked: () => void }) {
  const [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const ref = useDialogFocus(true, () => { if (!busy) onClose() })
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Unlock secret world" tabIndex={-1} className="w-full max-w-sm rounded-3xl bg-[#20192c] text-[#f9eafa] border border-[#665073] p-7 shadow-2xl">
      <div className="flex justify-between items-center"><span className="text-[#d2addb]"><Icon name="lock" /></span><button aria-label="Close secret world" disabled={busy} onClick={onClose}><Icon name="close" /></button></div>
      <h2 className="text-2xl font-serif mt-5 mb-2">A world just for you.</h2><p className="text-sm text-[#c7b8d1] mb-6">Enter the password to open the companion studio.</p>
      <form onSubmit={async e => { e.preventDefault(); if (busy || !password) return; setBusy(true); setError(''); try { await unlockWorld(password); setPassword(''); onUnlocked() } catch (err) { setError(err instanceof Error ? err.message : 'Could not unlock.') } finally { setBusy(false) } }}>
        <label htmlFor="world-password" className="text-xs block mb-2">Secret world password</label><input id="world-password" type="password" autoComplete="off" value={password} disabled={busy} onChange={e => setPassword(e.target.value)} className="w-full bg-[#120e1a] text-white rounded-xl px-4 py-3 border border-[#665073] focus:outline-none focus:ring-2 focus:ring-[#d5a2bd]" />
        {error && <p role="alert" className="text-[#ffb4bd] text-sm mt-3">{error}</p>}
        <button disabled={busy || !password} className="w-full rounded-xl px-4 py-3 mt-5 bg-[#e5bbd1] text-[#2d1833] font-semibold disabled:opacity-50">{busy ? 'Opening…' : 'Enter secret world'}</button>
      </form>
    </div>
  </div>
}
