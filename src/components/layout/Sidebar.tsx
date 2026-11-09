import { NavLink } from 'react-router'

import { cn } from '@/lib/utils'
import { LaunchButton } from './LaunchButton'
import { MORE_ITEMS, NAV_ITEMS, type NavItem } from './nav-items'

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto border-r px-4 py-6 lg:flex">
      <div className="flex items-center gap-2 px-2">
        <img src="/favicon.svg" alt="" className="size-7" />
        <span className="text-lg font-semibold">PersonalBudget</span>
      </div>
      <LaunchButton variant="wide" />
      <nav aria-label="Menu lateral" className="flex flex-col gap-4">
        <SidebarList items={NAV_ITEMS.filter((item) => item.to !== '/mais')} />
        <SidebarList items={MORE_ITEMS} />
        <SidebarList items={NAV_ITEMS.filter((item) => item.to === '/mais')} />
      </nav>
    </aside>
  )
}

/** On the desktop everything is one click away: "Mais" keeps only the settings. */
function SidebarList({ items }: { items: readonly NavItem[] }) {
  return (
    <ul className="flex flex-col gap-1 border-t pt-4 first:border-t-0 first:pt-0">
      {items.map(({ to, label, icon: Icon, end }) => (
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
  )
}
