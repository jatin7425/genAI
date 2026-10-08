import { initialsFor } from '../../utils/personaInitials'

export function PersonaAvatar({ name, size = 'w-8 h-8' }: { name: string; size?: string }) {
  return (
    <div
      className={`${size} rounded-full bg-primary-container flex items-center justify-center text-on-primary-container text-xs font-bold shrink-0`}
    >
      {initialsFor(name) || '?'}
    </div>
  )
}
