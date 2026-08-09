import type { ReactNode } from 'react'
import { Icon } from '../Icon'

type TopAppBarProps = {
  onMenuClick?: () => void
  rightSlot?: ReactNode
  showMenuButton?: boolean
}

export function TopAppBar({ onMenuClick, rightSlot, showMenuButton = true }: TopAppBarProps) {
  return (
    <header className="flex justify-between items-center px-gutter h-16 w-full bg-background border-b border-outline-variant z-10">
      <div className="flex items-center gap-3">
        {showMenuButton && (
          <button
            onClick={onMenuClick}
            className="text-on-surface-variant hover:text-on-surface active:scale-95 transition-transform md:hidden"
          >
            <Icon name="menu" className="text-[24px]" />
          </button>
        )}
        <span className="font-headline-md text-headline-md font-bold text-on-surface md:hidden">Cortex</span>
      </div>
      <div className="flex items-center gap-2">{rightSlot}</div>
    </header>
  )
}
