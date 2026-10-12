import { Link } from 'react-router-dom'
import type { Companion } from '../../api/companions'
import { CompanionPhoto } from './CompanionPhoto'
import { Icon } from '../Icon'
import { ModelSwitcher } from '../chat/ModelSwitcher'

type Props = {
  profiles: Companion[]
  loading: boolean
  model: string | null
  onModel: (model: string) => void
  onCreate: () => void
  onEdit: (profile: Companion) => void
  onDelete: (profile: Companion) => void
  onPhotos: (profile: Companion) => void
}

export function CompanionGallery({ profiles, loading, model, onModel, onCreate, onEdit, onDelete, onPhotos }: Props) {
  return <section className="cw-gallery" aria-label="Companion gallery">
    <header className="cw-gallery-heading">
      <div><p className="cw-eyebrow">Your little universe</p><h1>Your companions.</h1><p>Choose a story to return to, or create someone new.</p></div>
      <div className="cw-gallery-controls"><ModelSwitcher activeModel={model} onSelectModel={onModel} /><button className="cw-primary" disabled={loading} onClick={onCreate} aria-label="Create a companion"><Icon name="add" />Create companion</button></div>
    </header>
    {loading && <p role="status" className="cw-gallery-loading">Opening your world…</p>}
    {!loading && profiles.length === 0 && <div className="cw-gallery-empty"><span className="cw-orbit"><Icon name="auto_awesome" /></span><p className="cw-eyebrow mt-7">A character. A connection. A story.</p><h2>Meet someone<br /><em>you imagined.</em></h2><p>Give her a name, a personality, and a story. The little details make your conversations feel like her.</p><button disabled={!model} className="cw-primary mt-6" onClick={onCreate}>Create your AI girlfriend<Icon name="arrow_forward" /></button></div>}
    <div className="cw-gallery-grid">{profiles.map((profile, index) => <article key={profile.id} className="cw-gallery-card">
      <Link to={`/secret-world/${encodeURIComponent(profile.id)}`} aria-label={`Chat with ${profile.attributes.name}`} className="cw-gallery-card-link">
        <div className={`cw-card-portrait tone-${index % 3}`}><CompanionPhoto profileId={profile.id} imageId={profile.profile_picture?.id} alt={profile.attributes.name} /><div className="cw-card-spark"><Icon name="auto_awesome" /></div></div>
        <div className="cw-card-content"><div className="cw-card-name"><h2>{profile.attributes.name}</h2><span>{profile.attributes.age}</span></div><p className="cw-card-relationship">{profile.attributes.relationship}</p><p className="cw-card-personality">{profile.attributes.personality}</p><span className="cw-card-chat">Start a conversation<Icon name="arrow_forward" /></span></div>
      </Link>
      <div className="cw-gallery-card-actions"><button onClick={() => onEdit(profile)} aria-label={`Edit ${profile.attributes.name}`}><Icon name="edit" />Edit details</button><button onClick={() => onPhotos(profile)} aria-label={`Photos of ${profile.attributes.name}`}><Icon name="photo_library" /><span>Photos</span></button><button onClick={() => onDelete(profile)} aria-label={`Delete ${profile.attributes.name}`}><Icon name="delete" /></button></div>
    </article>)}</div>
  </section>
}
