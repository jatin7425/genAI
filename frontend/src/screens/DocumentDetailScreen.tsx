import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { fetchDocumentChunks } from '../api/documents'
import type { APIChunk } from '../api/documents'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'

export function DocumentDetailScreen() {
  const { docId } = useParams<{ docId: string }>()
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
      if (reset) setError(err.message || 'Failed to load chunks')
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
    <div className="flex h-full flex-col overflow-y-auto bg-surface p-6 md:p-8 custom-scrollbar">
      <h1 className="mb-6 text-2xl font-bold text-on-surface">
        Document Chunks
      </h1>
      
      {loading && (
        <div className="flex items-center gap-3 text-secondary">
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          Loading chunks...
        </div>
      )}
      
      {error && (
        <div className="rounded-xl bg-error/10 p-4 text-error">
          <p className="font-medium">Error loading chunks</p>
          <p className="text-sm">{error}</p>
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
