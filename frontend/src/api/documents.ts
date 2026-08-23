import { authFetch } from './http'
import { API_V1 } from './config'

export type APIDocument = {
  _id: string
  owner_id: string
  filename?: string
  ' '?: string // fallback for malformed response
  content_hash: string
  status: 'indexed' | 'failed' | 'pending' | string
  chunk_count: number
  pipeline_version: number
  created_at: string
  indexed_at?: string
  error?: string
}

export type PaginatedResponse<T> = {
  items: T[]
  total: number
  has_more: boolean
}

export async function fetchDocuments(skip = 0, limit = 20): Promise<PaginatedResponse<APIDocument>> {
  const res = await authFetch(`${API_V1}/documents/list?skip=${skip}&limit=${limit}`, {}, true)
  if (!res.ok) throw new Error(`Failed to fetch documents: ${res.status}`)
  return res.json()
}

export async function deleteDocument(docId: string): Promise<void> {
  const res = await authFetch(`${API_V1}/documents/delete?doc_id=${docId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error(`Failed to delete document: ${res.status}`)
}

export type APIChunk = {
  _id: string
  document_id: string
  chunk_index: number
  modality: string
  text: string
  page: number
  embedding_length?: number
}

export async function fetchDocumentChunks(docId: string, skip = 0, limit = 20): Promise<PaginatedResponse<APIChunk>> {
  const res = await authFetch(`${API_V1}/documents/chunks/list/${docId}?skip=${skip}&limit=${limit}`, {}, true)
  if (!res.ok) throw new Error(`Failed to fetch document chunks: ${res.status}`)
  return res.json()
}
