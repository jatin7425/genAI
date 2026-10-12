import type { ReactNode } from 'react'
import { useDialogFocus } from '../../hooks/useDialogFocus'
import { Icon } from '../Icon'

export function CompanionDrawer({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const ref = useDialogFocus(true, onClose)
  return <div className="cw-drawer-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose() }}><div ref={ref} className="cw-drawer" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}><header className="cw-drawer-header"><h2>{label}</h2><button className="cw-round" aria-label={`Close ${label.toLowerCase()}`} onClick={onClose}><Icon name="close" /></button></header>{children}</div></div>
}
