import { useEffect, useState } from 'react'
import { attachmentBlob, type ChatAttachment } from '../../api/attachments'
import { Icon } from '../Icon'
import { showToast } from '../../utils/toastState'

export function FilePreview({ file }: { file: File }) {
  const [url, setUrl] = useState('')
  useEffect(() => { const value = URL.createObjectURL(file); setUrl(value); return () => URL.revokeObjectURL(value) }, [file])
  return <img src={url} alt={file.name} className="w-12 h-12 object-cover rounded-lg shrink-0" />
}
function SavedImage({ attachment }: { attachment: ChatAttachment }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const controller = new AbortController(); let value = ''
    attachmentBlob(attachment.id, controller.signal).then(blob => {
      if (controller.signal.aborted) return
      value = URL.createObjectURL(blob); setUrl(value)
    }).catch(() => {})
    return () => { controller.abort(); if (value) URL.revokeObjectURL(value) }
  }, [attachment.id])
  return url ? <img src={url} alt={attachment.name} className="max-h-48 max-w-full rounded-xl object-contain" /> : <Icon name="description" className="text-[24px]" />
}
export function Attachments({ attachments }: { attachments?: ChatAttachment[] }) {
  if (!attachments?.length) return null
  const download = async (attachment: ChatAttachment) => {
    try {
      const blob = await attachmentBlob(attachment.id), url = URL.createObjectURL(blob)
      const link = document.createElement('a'); link.href = url; link.download = attachment.name
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) { showToast(error instanceof Error ? error.message : 'Download failed.', 'error') }
  }
  return <div className="flex flex-wrap gap-2 justify-end mb-2 max-w-full">
    {attachments.map(attachment => <button key={attachment.id} type="button" onClick={() => download(attachment)} aria-label={`Download ${attachment.name}`} className="max-w-[250px] rounded-xl border border-outline-variant bg-surface p-3 text-left hover:border-primary transition-colors">
      {attachment.kind === 'image' ? <SavedImage attachment={attachment} /> : <div className="flex items-center gap-3"><Icon name="description" className="text-[24px] text-primary" /><span className="min-w-0"><span className="block text-xs font-medium truncate">{attachment.name}</span><span className="block text-[10px] text-on-surface-variant mt-1">{Math.ceil(attachment.size / 1024)} KB · Download</span></span></div>}
      {attachment.kind === 'image' && <span className="block truncate text-[10px] text-on-surface-variant mt-2">{attachment.name}</span>}
    </button>)}
  </div>
}
