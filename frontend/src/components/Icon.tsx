type IconProps = {
  name: string
  filled?: boolean
  className?: string
}

export function Icon({ name, filled = false, className = '' }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{ fontVariationSettings: `'FILL' ${filled ? 1 : 0}` }}
    >
      {name}
    </span>
  )
}
