import { useRef, useState, type DragEvent } from 'react'
import { Icon } from '../Icon'
import { formatFileSize, iconForFile } from '../../utils/file'
import type { UploadedDocument } from '../../hooks/useDocuments'

function relativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

type SettingsModalProps = {
  documents: UploadedDocument[]
  onUpload: (files: FileList | File[]) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export function SettingsModal({ documents, onUpload, onDelete, onClose }: SettingsModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) onUpload(e.dataTransfer.files)
  }

  return (
    <div className="bg-[#222222] border border-outline-variant rounded-xl shadow-[0px_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-md w-full max-w-2xl flex flex-col overflow-hidden max-h-[85vh]">
      <div className="flex items-center justify-between p-stack-md border-b border-outline-variant">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Settings</h2>
          <p className="text-on-surface-variant text-sm mt-1">Manage documents available to Cortex.</p>
        </div>
        <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
          <Icon name="close" />
        </button>
      </div>

      <div className="p-stack-md overflow-y-auto flex flex-col gap-stack-sm">
        <label className="font-label-caps text-label-caps text-on-surface-variant">DOCUMENTS</label>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-stack-lg cursor-pointer transition-colors ${
            dragOver ? 'border-primary bg-surface-container-high' : 'border-outline-variant hover:border-outline hover:bg-surface-container'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center">
            <Icon name="upload_file" className="text-on-surface-variant text-[24px]" />
          </div>
          <p className="text-on-surface font-medium">Click to upload or drag and drop</p>
          <p className="text-on-surface-variant text-xs">PDF, DOCX, TXT, CSV, images — any file type</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) onUpload(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        <div className="flex flex-col gap-1 mt-unit">
          {documents.length === 0 ? (
            <p className="text-on-surface-variant text-sm text-center py-stack-sm opacity-70">
              No documents uploaded yet.
            </p>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.id}
                className="group flex items-center gap-3 p-3 rounded-lg hover:bg-surface-container-high transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center shrink-0">
                  <Icon name={iconForFile(doc.name)} className="text-secondary text-[20px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-on-surface font-medium truncate">{doc.name}</p>
                  <p className="text-on-surface-variant text-xs">
                    {formatFileSize(doc.size)} &middot; {relativeTime(doc.uploadedAt)}
                  </p>
                </div>
                <a
                  href={doc.url}
                  download={doc.name}
                  className="opacity-0 group-hover:opacity-100 p-2 text-on-surface-variant hover:text-on-surface rounded-lg transition-all shrink-0"
                >
                  <Icon name="download" className="text-[18px]" />
                </a>
                <button
                  onClick={() => onDelete(doc.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-on-surface-variant hover:text-error rounded-lg transition-all shrink-0"
                >
                  <Icon name="delete" className="text-[18px]" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="p-stack-md flex justify-end bg-surface-container-low border-t border-outline-variant">
        <button
          onClick={onClose}
          className="px-4 py-2 font-body-md bg-primary text-on-primary rounded-lg hover:bg-primary-fixed transition-colors font-medium"
        >
          Done
        </button>
      </div>
    </div>
  )
}
