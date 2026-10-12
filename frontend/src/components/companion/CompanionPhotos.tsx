import { useState } from 'react'
import { removeCompanionPhoto, uploadCompanionPhoto, type Companion, type CompanionPhoto as Photo } from '../../api/companions'
import { useDialogFocus } from '../../hooks/useDialogFocus'
import { CompanionPhoto } from './CompanionPhoto'
import { Icon } from '../Icon'

export function CompanionPhotos({ profile, onChanged, onClose }: { profile: Companion; onChanged: (profile: Companion) => void; onClose: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState(''), [viewing, setViewing] = useState<Photo | null>(null)
  const close = () => { if (!busy) { if (viewing) setViewing(null); else onClose() } }
  const ref = useDialogFocus(true, close)
  const upload = async (files: FileList | null, role: 'profile' | 'gallery') => {
    if (!files?.length || busy) return
    const chosen = Array.from(files)
    setError(''); setStatus('')
    if (role === 'gallery' && (profile.photos?.length ?? 0) + chosen.length > 20) { setError('Keep up to 20 gallery photos. Remove one before adding another.'); return }
    if (chosen.some(file => !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 10 * 1024 * 1024 || !file.size)) { setError('Choose PNG, JPEG, WebP, or GIF images, up to 10 MB each.'); return }
    setBusy(true); let saved = 0
    try {
      for (const file of chosen) { setStatus(`Uploading ${saved + 1} of ${chosen.length}…`); onChanged(await uploadCompanionPhoto(profile.id, file, role)); saved++ }
      setStatus(role === 'profile' ? 'Profile picture saved.' : `${saved} photo${saved === 1 ? '' : 's'} saved.`)
    } catch (err) { setStatus(saved ? `${saved} photos saved.` : ''); setError(err instanceof Error ? err.message : 'Could not upload photos. Try again.') }
    finally { setBusy(false) }
  }
  const remove = async (photo: Photo) => {
    setBusy(true); setError(''); setStatus('')
    try { onChanged(await removeCompanionPhoto(profile.id, photo.id)); setStatus('Photo removed.') }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not remove photo.') }
    finally { setBusy(false) }
  }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 backdrop-blur-sm p-3 sm:p-6">
    <div ref={ref} role="dialog" aria-modal="true" aria-label={`${profile.attributes.name}'s photos`} tabIndex={-1} className="cw-photos-dialog">
      <header><div><p className="cw-eyebrow">Her photo collection</p><h2>{profile.attributes.name}'s photos</h2></div><button className="cw-round" disabled={busy} onClick={close} aria-label={viewing ? 'Back to photo collection' : 'Close photos'}><Icon name={viewing ? 'arrow_back' : 'close'} /></button></header>
      {viewing ? <div className="cw-photo-view"><CompanionPhoto profileId={profile.id} imageId={viewing.id} alt={viewing.name} /><p>{viewing.name}</p></div> : <>
        <p className="cw-photos-help">Upload her profile picture and favourite photos. PNG, JPEG, WebP or GIF, up to 10 MB each. Photos are saved as still images.</p>
        <section className="cw-profile-photo-section" aria-label="Profile picture">
          <div className="cw-profile-preview">{profile.profile_picture ? <button aria-label="View profile picture" onClick={() => setViewing(profile.profile_picture!)}><CompanionPhoto profileId={profile.id} imageId={profile.profile_picture.id} alt={`${profile.attributes.name}'s profile picture`} /></button> : <span>{profile.attributes.name[0]}</span>}</div>
          <div><h3>Profile picture</h3><p>Shown on her card and in chat.</p><label className={`cw-secondary cw-upload-label ${busy ? 'disabled' : ''}`}>{profile.profile_picture ? 'Replace picture' : 'Upload picture'}<input aria-label="Upload profile picture" type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onChange={e => { void upload(e.target.files, 'profile'); e.target.value = '' }} /></label>{profile.profile_picture && <button className="cw-photo-remove" disabled={busy} onClick={() => void remove(profile.profile_picture!)}>Remove profile picture</button>}</div>
        </section>
        <div className="cw-photo-gallery-heading"><h3>Photo gallery <span>{profile.photos?.length ?? 0}/20</span></h3><label className={`cw-secondary cw-upload-label ${busy ? 'disabled' : ''}`}>Add photos<input aria-label="Upload gallery photos" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple disabled={busy || (profile.photos?.length ?? 0) >= 20} onChange={e => { void upload(e.target.files, 'gallery'); e.target.value = '' }} /></label></div>
        {!profile.photos?.length && <p className="cw-photos-empty">Her collection starts with your first upload.</p>}
        <div className="cw-photo-grid">{profile.photos?.map(photo => <article key={photo.id}><button className="cw-photo-thumb" aria-label={`View ${photo.name}`} onClick={() => setViewing(photo)}><CompanionPhoto profileId={profile.id} imageId={photo.id} alt={photo.name} /></button><div><span title={photo.name}>{photo.name}</span><button className="cw-round" disabled={busy} aria-label={`Remove ${photo.name}`} onClick={() => void remove(photo)}><Icon name="delete" /></button></div></article>)}</div>
      </>}
      {status && <p role="status" className="cw-photo-status">{status}</p>}{error && <p role="alert" className="cw-photo-error">{error}</p>}
    </div>
  </div>
}
