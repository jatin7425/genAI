import { useState, useRef, useEffect } from 'react'
import { Icon } from '../Icon'
import { API_V1, API_BASE_URL } from '../../api/config'
import { authFetch } from '../../api/http'

type UploadDocumentModalProps = {
  onClose: () => void
}

type ProgressState = {
  stage: string
  current: number
  total: number
  progress: number
  message: string
}

export function UploadDocumentModal({ onClose }: UploadDocumentModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progressState, setProgressState] = useState<ProgressState | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  // Cleanup websocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  const handleUpload = async () => {
    if (!file) return

    setIsUploading(true)
    setError(null)
    setProgressState(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await authFetch(`${API_V1}/documents/ingest`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        throw new Error(`Upload failed: ${res.statusText}`)
      }

      const data = await res.json()
      
      if (data.web_socket_connection) {
        const wsUrl = `${API_BASE_URL.replace(/^http/, 'ws')}${data.web_socket_connection}`
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            if (msg.type === 'progress') {
              setProgressState(msg)
              if (msg.stage === 'completed') {
                window.dispatchEvent(new CustomEvent('api_mutation'))
                setTimeout(() => onClose(), 1500)
              } else if (msg.stage === 'error') {
                setError(msg.message)
                window.dispatchEvent(new CustomEvent('api_mutation'))
                setTimeout(() => onClose(), 3000)
              }
            }
          } catch (e) {
            console.error('Failed to parse websocket message', e)
          }
        }
        
        ws.onerror = () => {
          setError('Lost connection to ingestion progress.')
          setTimeout(() => onClose(), 3000)
        }

        ws.onclose = () => {
          wsRef.current = null
        }
      } else {
        // Fallback if no websocket connection provided
        window.dispatchEvent(new CustomEvent('api_mutation'))
        onClose()
      }
      
      setIsUploading(false)
    } catch (err: any) {
      setError(err.message || 'Failed to upload document')
      setIsUploading(false)
      setTimeout(() => onClose(), 3000)
    }
  }

  const isIngesting = !!progressState
  const hasError = !!error

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-on-surface">Upload Document</h2>
          <button 
            onClick={onClose} 
            disabled={(isUploading || isIngesting) && !hasError && progressState?.stage !== 'completed'}
            className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-50"
          >
            <Icon name="close" />
          </button>
        </div>

        {isUploading || isIngesting ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            {hasError ? (
              <>
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-error/10 text-error">
                  <Icon name="error" className="text-3xl" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-on-surface">Upload Failed</h3>
                <p className="mb-6 text-sm text-on-surface-variant max-w-[280px]">{error}</p>
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="rounded-lg px-6 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-high"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleUpload}
                    className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-on-primary hover:bg-primary/90"
                  >
                    Retry
                  </button>
                </div>
              </>
            ) : progressState?.stage === 'completed' ? (
              <>
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon name="check_circle" className="text-3xl" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-on-surface">Upload Complete!</h3>
                <p className="text-sm text-on-surface-variant">Your document is ready.</p>
              </>
            ) : (
              <div className="w-full px-4">
                <div className="mb-6 flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary animate-pulse">
                    <span className="material-symbols-outlined text-3xl animate-spin">
                      {isUploading ? 'progress_activity' : 'autorenew'}
                    </span>
                  </div>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-on-surface">
                  {isUploading ? 'Uploading file...' : 'Processing Document...'}
                </h3>
                <p className="mb-6 h-10 text-sm text-on-surface-variant line-clamp-2">
                  {progressState?.message || 'Please wait while we set things up.'}
                </p>
                
                {/* Progress Bar */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs font-bold text-primary">
                    <span>{progressState ? `${progressState.progress}%` : '0%'}</span>
                    {progressState && progressState.total > 0 && (
                      <span>{progressState.current} / {progressState.total}</span>
                    )}
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
                    <div 
                      className="h-full bg-primary transition-all duration-300 ease-out"
                      style={{ width: `${progressState?.progress || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="mb-6">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={(e) => {
                  const selected = e.target.files?.[0]
                  if (selected) {
                    setFile(selected)
                    setError(null)
                    setProgressState(null)
                  }
                }}
              />
              
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`
                  flex cursor-pointer flex-col items-center justify-center gap-2 
                  rounded-xl border-2 border-dashed p-8 transition-colors
                  ${file ? 'border-primary bg-primary/5' : 'border-outline-variant hover:bg-surface-container-high'}
                `}
              >
                <Icon 
                  name={file ? 'description' : 'upload_file'} 
                  className={`text-4xl ${file ? 'text-primary' : 'text-on-surface-variant'}`} 
                />
                <p className="text-center text-sm font-medium text-on-surface">
                  {file ? file.name : 'Click to select a file'}
                </p>
                {file && (
                  <p className="text-xs text-on-surface-variant">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-high"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!file}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:opacity-50"
              >
                Upload
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
