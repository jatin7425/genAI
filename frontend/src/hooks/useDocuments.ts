import { useCallback, useState } from 'react'

export type UploadedDocument = {
  id: string
  name: string
  size: number
  type: string
  uploadedAt: number
  url: string
}

export function useDocuments() {
  const [documents, setDocuments] = useState<UploadedDocument[]>([])

  const addFiles = useCallback((files: FileList | File[]) => {
    const newDocs: UploadedDocument[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: Date.now(),
      url: URL.createObjectURL(file),
    }))
    setDocuments((prev) => [...newDocs, ...prev])
  }, [])

  const removeDocument = useCallback((id: string) => {
    setDocuments((prev) => {
      const target = prev.find((d) => d.id === id)
      if (target) URL.revokeObjectURL(target.url)
      return prev.filter((d) => d.id !== id)
    })
  }, [])

  return { documents, addFiles, removeDocument }
}
