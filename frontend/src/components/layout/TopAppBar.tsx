import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Icon } from '../Icon'

type TopAppBarProps = { onMenuClick?: () => void; rightSlot?: ReactNode; showMenuButton?: boolean }
export function TopAppBar({ onMenuClick, rightSlot, showMenuButton = true }: TopAppBarProps) {
  const { pathname } = useLocation()
  const label = pathname.startsWith('/settings') ? 'Settings' : 'Your workspace'
  return (
    <header className="shrink-0 flex justify-between items-center px-5 md:px-8 h-[72px] w-full bg-background border-b border-outline-variant/70 z-10 gap-2">
      <div className="flex items-center gap-3 min-w-0">
        {showMenuButton && <button onClick={onMenuClick} aria-label="Open navigation" className="p-2 -ml-2 text-on-surface-variant hover:text-primary md:hidden"><Icon name="menu" className="text-[22px]" /></button>}
        <span className="text-sm font-semibold md:hidden">Cortex</span>
        <div className="hidden md:flex items-center gap-2 text-xs text-on-surface-variant"><Icon name="auto_awesome" className="text-[15px] text-primary" />{label}</div>
      </div>
      <div className="flex items-center gap-2 min-w-0">{rightSlot}</div>
    </header>
  )
}
