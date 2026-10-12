import { useEffect, useState } from 'react'
import { companionPhotoBlob } from '../../api/companions'

export function CompanionPhoto({ profileId, imageId, alt, className = '' }: { profileId: string; imageId?: string; alt: string; className?: string }) {
  const [source, setSource] = useState<{ id: string; url: string } | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  useEffect(() => {
    if (!imageId) return
    const controller = new AbortController(); let url: string | undefined
    companionPhotoBlob(profileId, imageId, controller.signal).then(blob => {
      if (controller.signal.aborted) return
      url = URL.createObjectURL(blob); setSource({ id: imageId, url })
    }).catch(() => { if (!controller.signal.aborted) setFailed(imageId) })
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url) }
  }, [profileId, imageId])
  if (!imageId) return <span aria-hidden="true">{alt.slice(0, 1)}</span>
  if (source?.id === imageId) return <img className={className} src={source.url} alt={alt} onError={() => { setSource(null); setFailed(imageId) }} />
  return <span className="cw-photo-placeholder" role="img" aria-label={failed === imageId ? `${alt}: unavailable` : `Loading ${alt}`}>{failed === imageId ? 'Photo unavailable' : 'Loading…'}</span>
}
