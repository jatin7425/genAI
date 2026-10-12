import { useState } from 'react'
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
  const [query, setQuery] = useState('')
  const matches = profiles.filter(profile => `${profile.attributes.name} ${profile.attributes.personality} ${profile.attributes.relationship}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <section className="cw-gallery" aria-label="Companion gallery">
    <header className="cw-gallery-heading">
      <div><p className="cw-eyebrow"><span className="cw-tiny-spark">✦</span> A world of your own</p><h1>Someone worth<br/><em>coming back to.</em></h1><p>Your characters. Your stories. A little closer, every conversation.</p></div>
      <div className="cw-gallery-controls"><ModelSwitcher activeModel={model} onSelectModel={onModel} /><button className="cw-primary" disabled={loading} onClick={onCreate} aria-label="Create a companion"><Icon name="add" />Create companion</button></div>
    </header>
    {loading && <p role="status" className="cw-gallery-loading">Opening your world…</p>}
    {!loading && profiles.length === 0 && <div className="cw-gallery-empty"><span className="cw-orbit"><Icon name="auto_awesome" /></span><p className="cw-eyebrow mt-7">A character. A connection. A story.</p><h2>Meet someone<br /><em>you imagined.</em></h2><p>Give her a name, a personality, and a story. The little details make your conversations feel like her.</p><button disabled={!model} className="cw-primary mt-6" onClick={onCreate}>Create your AI girlfriend<Icon name="arrow_forward" /></button></div>}
    {!!profiles.length && <div className="cw-collection-bar"><div><h2>Your companions <span>{profiles.length.toString().padStart(2, '0')}</span></h2><p>Pick up where you left off.</p></div><label className="cw-companion-search"><Icon name="search" /><input aria-label="Search companions" placeholder="Find a companion…" value={query} onChange={event => setQuery(event.target.value)}/></label></div>}
    {!loading && !!profiles.length && !matches.length && <p className="cw-gallery-loading">No companions match your search.</p>}
    <div className="cw-gallery-grid">{matches.map((profile, index) => <article key={profile.id} className="cw-gallery-card">
      <Link to={`/secret-world/${encodeURIComponent(profile.id)}`} aria-label={`Chat with ${profile.attributes.name}`} className="cw-gallery-card-link">
        <div className={`cw-card-portrait tone-${index % 3}`}><CompanionPhoto profileId={profile.id} imageId={profile.profile_picture?.id} alt={profile.attributes.name} /><div className="cw-card-spark"><Icon name="auto_awesome" />AI companion</div></div>
        <div className="cw-card-content"><div className="cw-card-name"><h2>{profile.attributes.name}</h2><span>{profile.attributes.age}</span></div><p className="cw-card-relationship">{profile.attributes.relationship}</p><p className="cw-card-personality">{profile.attributes.personality}</p><span className="cw-card-chat">Continue your story<Icon name="arrow_forward" /></span></div>
      </Link>
      <div className="cw-gallery-card-actions"><button onClick={() => onEdit(profile)} aria-label={`Edit ${profile.attributes.name}`}><Icon name="edit" />Edit details</button><button onClick={() => onPhotos(profile)} aria-label={`Photos of ${profile.attributes.name}`}><Icon name="photo_library" /><span>Photos</span></button><button onClick={() => onDelete(profile)} aria-label={`Delete ${profile.attributes.name}`}><Icon name="delete" /></button></div>
    </article>)}</div>
  </section>
}
