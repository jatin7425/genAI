import { Icon } from '../Icon'

type BottomNavKey = 'history' | 'chat' | 'details'

const ITEMS: { key: BottomNavKey; icon: string; label: string }[] = [
  { key: 'history', icon: 'menu', label: 'History' },
  { key: 'chat', icon: 'chat_bubble', label: 'Chat' },
  { key: 'details', icon: 'info', label: 'Details' },
]

type BottomNavProps = {
  active: BottomNavKey
  onSelect?: (key: BottomNavKey) => void
}

export function BottomNav({ active, onSelect }: BottomNavProps) {
  return (
    <nav className="flex justify-around items-center h-16 px-gutter bg-surface-container-high/80 backdrop-blur-md border-t border-outline-variant fixed bottom-0 w-full z-50 md:hidden shadow-lg">
      {ITEMS.map((item) => {
        const isActive = item.key === active
        return (
          <button
            key={item.key}
            onClick={() => onSelect?.(item.key)}
            className={`flex flex-col items-center justify-center active:bg-surface-bright transition-colors ${
              isActive
                ? 'text-primary bg-primary-container/20 rounded-xl px-4 py-1 w-20'
                : 'text-on-surface-variant p-2 rounded-lg w-16'
            }`}
          >
            <Icon name={item.icon} filled={isActive} className="mb-1" />
            <span className="font-label-caps text-label-caps">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
