import { NavLink } from 'react-router'

import { cn } from '@/lib/utils'
import { NAV_ITEMS } from './nav-items'

export function BottomNav() {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid grid-cols-4">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 px-0.5 text-[11px] font-medium tracking-tight text-muted-foreground transition-colors',
                  isActive && 'text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('size-5', isActive && 'stroke-[2.5]')} aria-hidden />
                  <span className="max-w-full truncate">{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
