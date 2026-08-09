export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`
}

export function iconForFile(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['pdf'].includes(ext)) return 'picture_as_pdf'
  if (['doc', 'docx'].includes(ext)) return 'description'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'table_chart'
  if (['ppt', 'pptx'].includes(ext)) return 'slideshow'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image'
  if (['txt', 'md'].includes(ext)) return 'article'
  if (['zip', 'rar', '7z'].includes(ext)) return 'folder_zip'
  return 'draft'
}
