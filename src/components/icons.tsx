import type { LucideIcon, LucideProps } from 'lucide-react'

// All icons use a 1px stroke
export function Icon({ icon: Glyph, size = 16, ...rest }: LucideProps & { icon: LucideIcon }) {
  return <Glyph size={size} strokeWidth={1} absoluteStrokeWidth aria-hidden {...rest} />
}
