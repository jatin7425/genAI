import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Icon } from '../Icon'
import { FilePreview } from './Attachments'
import { ATTACHMENT_ACCEPT, deleteDraftAttachment, uploadAttachment, type ChatAttachment } from '../../api/attachments'

const SLASH_COMMANDS = [
  { name: '/createstory', args: '<your story idea, characters, and your role>', description: 'Start an interactive story. The narrator opens it and you steer.', icon: 'menu_book' },
]

type PendingFile ={ key: string; file: File; attachment?: ChatAttachment; error?: string; uploading: boolean }
type ChatInputProps = {
  placeholder?: string; onSend?: (value: string, attachments?: ChatAttachment[]) => void; onStop?: () => void
  isStreaming?: boolean; variant?: 'floating' | 'inline'
}
export function ChatInput({ placeholder = 'Message Cortex…', onSend, onStop, isStreaming = false, variant = 'floating' }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null), fileRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(''), [files, setFiles] = useState<PendingFile[]>([])
  const [error, setError] = useState(''), [dragging, setDragging] = useState(false)
  const filesRef = useRef(files), controllers = useRef(new Map<string, AbortController>())
  filesRef.current = files
  useEffect(() => () => {
    controllers.current.forEach(controller => controller.abort())
    filesRef.current.forEach(item => { if (item.attachment) void deleteDraftAttachment(item.attachment.id).catch(() => {}) })
  }, [])
  const upload = (item: PendingFile) => {
    const controller = new AbortController(); controllers.current.set(item.key, controller)
    setFiles(previous => previous.map(f => f.key === item.key ? { ...f, uploading: true, error: undefined } : f))
    uploadAttachment(item.file, controller.signal).then(attachment => {
      if (!controller.signal.aborted) setFiles(previous => previous.map(f => f.key === item.key ? { ...f, attachment, uploading: false } : f))
    }).catch(cause => {
      if (!controller.signal.aborted) setFiles(previous => previous.map(f => f.key === item.key ? { ...f, uploading: false, error: cause instanceof Error ? cause.message : 'Upload failed.' } : f))
    }).finally(() => controllers.current.delete(item.key))
  }
  const addFiles = (selected: File[]) => {
    if (isStreaming) return
    setError('')
    const allowed = ATTACHMENT_ACCEPT.split(',')
    const added: PendingFile[] = []
    for (const file of selected) {
      const extension = '.' + file.name.split('.').at(-1)?.toLowerCase()
      if (!allowed.includes(extension)) { setError('That format is not supported. Use PDF, DOCX, text, CSV, JSON, or an image.'); continue }
      if (file.size > 10 * 1024 * 1024) { setError('Each file must be 10 MB or smaller.'); continue }
      if (filesRef.current.length + added.length >= 6) { setError('Attach up to six files per message.'); break }
      added.push({ key: crypto.randomUUID(), file, uploading: true })
    }
    filesRef.current = [...filesRef.current, ...added]
    setFiles(filesRef.current); added.forEach(upload)
  }
  const remove = (item: PendingFile) => {
    controllers.current.get(item.key)?.abort()
    filesRef.current = filesRef.current.filter(f => f.key !== item.key); setFiles(filesRef.current)
    if (item.attachment) void deleteDraftAttachment(item.attachment.id).catch(() => {})
  }
  const blocked = files.some(file => file.uploading || file.error)
  // Suggest commands while the user is still typing the command word.
  const [commandIndex, setCommandIndex] = useState(0), [commandsDismissed, setCommandsDismissed] = useState(false)
  const commandMatches = /^\/\S*$/.test(value) && !commandsDismissed ? SLASH_COMMANDS.filter(c => c.name.startsWith(value.toLowerCase())) : []
  const chooseCommand = (name: string) => { setValue(`${name} `); setCommandIndex(0); textareaRef.current?.focus() }
  const handleCommandKeys = (event: KeyboardEvent) => {
    if (!commandMatches.length) return false
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setCommandIndex(i => (i + (event.key === 'ArrowDown' ? 1 : commandMatches.length - 1)) % commandMatches.length)
    } else if (event.key === 'Tab' || (event.key === 'Enter' && !event.shiftKey)) {
      event.preventDefault()
      chooseCommand(commandMatches[Math.min(commandIndex, commandMatches.length - 1)].name)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setCommandsDismissed(true)
    } else return false
    return true
  }
  const handleSend = () => {
    if (isStreaming || blocked || (!value.trim() && !files.length) || !onSend) return
    const attachments = files.flatMap(file => file.attachment ? [file.attachment] : [])
    const text = value.trim() || 'Please describe or summarize the attached files.'
    filesRef.current = []; setFiles([]); setValue(''); setError('')
    onSend(text, attachments)
    if (textareaRef.current) textareaRef.current.style.height = '64px'
  }
  return (
    <div className={variant === 'floating' ? 'absolute bottom-0 left-0 w-full p-4 md:p-6 bg-background z-10' : 'w-full'}>
      <div className="max-w-[820px] mx-auto">
        <div className={`composer relative ${dragging ? 'ring-2 ring-primary' : ''}`}
          onDragOver={event => { event.preventDefault(); if (!isStreaming) setDragging(true) }}
          onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false) }}
          onDrop={event => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)) }}>
          {dragging && <div className="absolute inset-0 z-10 rounded-[20px] bg-surface/95 border-2 border-dashed border-primary grid place-items-center pointer-events-none text-primary text-sm">Drop files here to attach them</div>}
          <input ref={fileRef} type="file" multiple accept={ATTACHMENT_ACCEPT} aria-label="Choose attachments" className="hidden" onChange={event => { addFiles(Array.from(event.target.files ?? [])); event.target.value = '' }} />
          {files.length > 0 && <div className="flex gap-2 overflow-x-auto mb-3 pb-1">
            {files.map(item => <div key={item.key} className={`relative shrink-0 w-52 flex gap-3 p-3 pr-7 rounded-xl border ${item.error ? 'border-error/50 bg-error/5' : 'border-outline-variant bg-surface-container'}`}>
              {item.file.type.startsWith('image/') ? <FilePreview file={item.file} /> : <Icon name="description" className="text-primary text-[26px] self-center" />}
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{item.file.name}</p><p className="text-[10px] text-on-surface-variant mt-1">{item.uploading ? 'Uploading…' : `${Math.ceil(item.file.size / 1024)} KB`}</p>
                {item.error && <p role="alert" className="text-[10px] text-error mt-1">{item.error}</p>}
                {item.error && <button type="button" onClick={() => upload(item)} className="text-[10px] text-error underline mt-1" title={item.error}>Upload failed · Retry</button>}
                {item.attachment?.truncated && <p className="text-[10px] text-tertiary mt-1">File text was shortened</p>}
              </div>
              <button type="button" aria-label={`Remove ${item.file.name}`} onClick={() => remove(item)} className="absolute top-1 right-1 p-1 text-on-surface-variant hover:text-error"><Icon name="close" className="text-[14px]" /></button>
            </div>)}
          </div>}
          {commandMatches.length > 0 && <div role="listbox" id="slash-commands" aria-label="Commands" className="absolute left-3 right-3 bottom-full mb-2 z-20 rounded-xl border border-outline-variant bg-surface shadow-[0_12px_32px_rgba(20,40,25,0.16)] overflow-hidden py-1">
            <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold tracking-wider uppercase text-on-surface-variant">Commands</p>
            {commandMatches.map((command, index) => <button type="button" role="option" key={command.name} aria-selected={index === commandIndex}
              onMouseDown={event => { event.preventDefault(); chooseCommand(command.name) }} onMouseEnter={() => setCommandIndex(index)}
              className={`w-full flex items-start gap-3 px-3 py-2 text-left ${index === commandIndex ? 'bg-surface-container-high' : ''}`}>
              <Icon name={command.icon} className="text-[17px] text-primary mt-0.5" />
              <span className="min-w-0"><span className="block text-sm"><span className="font-medium">{command.name}</span> <span className="text-on-surface-variant text-xs">{command.args}</span></span>
                <span className="block text-xs text-on-surface-variant">{command.description}</span></span>
            </button>)}
            <p className="px-3 pt-1 pb-1.5 text-[10px] text-on-surface-variant/80">↑↓ to choose · Tab or Enter to select · Esc to close</p>
          </div>}
          <textarea ref={textareaRef} value={value}
            aria-controls={commandMatches.length ? 'slash-commands' : undefined} aria-autocomplete="list"
            onChange={event => { setValue(event.target.value); setCommandsDismissed(false); event.target.style.height = '64px'; event.target.style.height = `${Math.min(event.target.scrollHeight, 180)}px` }}
            onPaste={event => { const pasted = Array.from(event.clipboardData.files); if (pasted.length) { event.preventDefault(); addFiles(pasted) } }}
            onKeyDown={event => { if (handleCommandKeys(event)) return; if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); handleSend() } }}
            disabled={isStreaming} aria-label="Message Cortex"
            className="w-full min-h-16 max-h-44 bg-transparent resize-none outline-none text-sm leading-relaxed placeholder:text-on-surface-variant/70 disabled:opacity-60"
            placeholder={isStreaming ? 'Cortex is working on your response…' : placeholder} rows={2} />
          {error && <p role="alert" className="text-xs text-error mb-2">{error}</p>}
          {files.some(item => item.file.type.startsWith('image/')) && <p className="text-[10px] text-on-surface-variant mb-2">For images, choose a model that supports vision.</p>}
          <div className="flex justify-between items-center gap-3 mt-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={isStreaming || files.length >= 6} aria-label="Attach files or images" title="Attach files or images · up to 6 files, 10 MB each" className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-surface-container-high text-on-surface-variant disabled:opacity-40"><Icon name="add" className="text-[22px]" /></button>
            <div className="flex items-center gap-3"><span className="hidden sm:inline text-[10px] text-on-surface-variant/70">Shift + Enter for a new line</span>
              <button type="button" onClick={isStreaming ? onStop : handleSend} disabled={isStreaming ? !onStop : blocked || (!value.trim() && !files.length) || !onSend} aria-label={isStreaming ? 'Stop generating' : 'Send message'} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${isStreaming ? 'bg-error text-on-error' : 'bg-primary text-on-primary hover:bg-primary-fixed'}`}><Icon name={isStreaming ? 'stop' : 'arrow_upward'} className="text-[19px]" /></button>
            </div>
          </div>
        </div>
        <p className="text-center mt-3 text-[10px] text-on-surface-variant/70">A thoughtful assistant, not a final authority. Double-check what matters.</p>
      </div>
    </div>
  )
}
