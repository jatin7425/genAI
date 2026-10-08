import { Icon } from '../Icon'

type ConfirmDialogProps = {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-2xl bg-surface-container-high border border-outline-variant p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
            danger ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'
          }`}
        >
          <Icon name={danger ? 'warning' : 'help'} filled className="text-2xl" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-on-surface">{title}</h2>
        <p className="mb-6 text-sm text-on-surface-variant leading-relaxed">{description}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-highest transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              danger ? 'bg-error text-on-error hover:bg-error/90' : 'bg-primary text-on-primary hover:bg-primary/90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
