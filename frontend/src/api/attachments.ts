import { API_V1 } from './config'
import { authFetch } from './http'

export type ChatAttachment = { id: string; name: string; size: number; mime: string; kind: 'image' | 'file'; truncated?: boolean }
export const ATTACHMENT_ACCEPT = '.pdf,.docx,.txt,.md,.csv,.json,.log,.py,.js,.ts,.html,.css,.png,.jpg,.jpeg,.webp,.gif'
export async function uploadAttachment(file: File, signal?: AbortSignal): Promise<ChatAttachment> {
  const body = new FormData(); body.append('file', file)
  const response = await authFetch(`${API_V1}/attachments`, { method: 'POST', body, signal }, true)
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(typeof data?.detail === 'string' ? data.detail : `Upload failed (${response.status}). Try again.`)
  }
  return response.json()
}
export async function deleteDraftAttachment(id: string) {
  await authFetch(`${API_V1}/attachments/${encodeURIComponent(id)}`, { method: 'DELETE' }, true)
}
export async function attachmentBlob(id: string, signal?: AbortSignal) {
  const response = await authFetch(`${API_V1}/attachments/${encodeURIComponent(id)}/content`, { signal }, true)
  if (!response.ok) throw new Error('This attachment is unavailable. Please reattach it.')
  return response.blob()
}
