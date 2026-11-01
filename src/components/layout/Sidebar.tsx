import { NavLink } from 'react-router'

import { cn } from '@/lib/utils'
import { LaunchButton } from './LaunchButton'
import { NAV_ITEMS } from './nav-items'

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r px-4 py-6 lg:flex">
      <div className="flex items-center gap-2 px-2">
        <img src="/favicon.svg" alt="" className="size-7" />
        <span className="text-lg font-semibold">PersonalBudget</span>
      </div>
      <LaunchButton variant="wide" />
      <nav aria-label="Navegação principal">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                    isActive && 'bg-accent text-accent-foreground',
                  )
                }
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
