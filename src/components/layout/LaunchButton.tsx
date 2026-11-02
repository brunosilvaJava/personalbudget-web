import { Plus } from 'lucide-react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LAUNCH_PATH } from './nav-items'

interface LaunchButtonProps {
  /** round floating button (phone) or full-width button (sidebar) */
  variant?: 'floating' | 'wide'
  className?: string
}

export function LaunchButton({ variant = 'floating', className }: LaunchButtonProps) {
  if (variant === 'wide') {
    return (
      <Button asChild size="lg" className={cn('h-11 w-full', className)}>
        <Link to={LAUNCH_PATH}>
          <Plus aria-hidden />
          Lançar
        </Link>
      </Button>
    )
  }

  return (
    <Button
      asChild
      size="icon"
      className={cn(
        'z-20 size-14 rounded-full shadow-lg [&_svg:not([class*=size-])]:size-6',
        className,
      )}
    >
      <Link to={LAUNCH_PATH} aria-label="Lançar">
        <Plus aria-hidden />
      </Link>
    </Button>
  )
}
