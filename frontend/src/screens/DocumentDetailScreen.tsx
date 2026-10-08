import { useEffect, useState, useCallback } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { fetchDocumentChunks } from '../api/documents'
import type { APIChunk } from '../api/documents'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'

type DocumentNavState = { filename?: string; status?: string; chunkCount?: number }

export function DocumentDetailScreen() {
  const { docId } = useParams<{ docId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { filename, status, chunkCount } = (location.state as DocumentNavState | null) ?? {}

  const [chunks, setChunks] = useState<APIChunk[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const loadChunks = useCallback(async (reset = false) => {
    if (!docId) return
    if ((!reset && !hasMore) || loadingMore) return
    
    if (reset) {
      setLoading(true)
      setError(null)
    } else {
      setLoadingMore(true)
    }

    try {
      const skip = reset ? 0 : chunks.length
      const data = await fetchDocumentChunks(docId, skip, 20)
      
      setChunks(prev => {
        const newChunks = reset ? data.items : [...prev, ...data.items]
        return newChunks.sort((a, b) => a.chunk_index - b.chunk_index)
      })
      setHasMore(data.has_more)
    } catch (err: any) {
      if (reset) setError("Couldn't load this document's content. Check your connection and try again.")
      else console.error('Failed to load more chunks:', err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [docId, chunks.length, hasMore, loadingMore])

  useEffect(() => {
    loadChunks(true)
  }, [docId]) // Intentional: don't include loadChunks to avoid loops

  const observerTarget = useInfiniteScroll(loadChunks, hasMore, loadingMore)

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background p-6 md:p-8 custom-scrollbar">
      <div className="mb-6">
        <button
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          className="mb-3 flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <Icon name="arrow_back" className="text-[18px]" />
          Back
        </button>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-highest">
            <Icon name="description" className="text-[20px] text-on-surface-variant" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-on-surface">{filename || 'Document'}</h1>
            <p className="text-sm text-on-surface-variant">
              {typeof chunkCount === 'number' ? `${chunkCount} chunks` : status ? status : 'Document chunks'}
            </p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-secondary">
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          Loading chunks...
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-error/10 p-4 text-error flex flex-col items-start gap-3">
          <div>
            <p className="font-medium">Couldn't load this document</p>
            <p className="text-sm opacity-90">{error}</p>
          </div>
          <button
            onClick={() => loadChunks(true)}
            className="rounded-lg bg-error/15 px-3 py-1.5 text-sm font-medium text-error hover:bg-error/25 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && chunks.length === 0 && (
        <div className="text-secondary">No chunks found for this document.</div>
      )}
      
      {!loading && !error && chunks.length > 0 && (
        <div className="flex flex-col gap-4">
          {chunks.map((chunk) => (
            <div key={chunk._id} className="flex flex-col gap-2 rounded-xl bg-surface-container p-5">
              <div className="flex items-center gap-3 text-sm text-secondary">
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {chunk.modality.toUpperCase()}
                </span>
                <span>Index: {chunk.chunk_index}</span>
                <span>Page: {chunk.page}</span>
              </div>
              <p className="whitespace-pre-wrap text-on-surface leading-relaxed text-sm">
                {typeof chunk.text === 'object' ? JSON.stringify(chunk.text, null, 2) : String(chunk.text)}
              </p>
              {chunk.embedding_length !== undefined && chunk.embedding_length > 0 && (
                <div className="mt-2 text-xs text-secondary/60">
                  Embedding shape: [{chunk.embedding_length}]
                </div>
              )}
            </div>
          ))}
          {hasMore && (
            <div ref={observerTarget} className="py-4 text-center text-secondary text-sm">
              {loadingMore ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                  Loading more chunks...
                </span>
              ) : (
                'Scroll for more'
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
