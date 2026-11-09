import { NavLink } from 'react-router'

import { cn } from '@/lib/utils'

/** Tabs that are routes (/recorrentes/fixas, /carteira/contas...): a link per tab. */
export function TabsNav({
  label,
  tabs,
}: {
  label: string
  tabs: readonly { to: string; label: string }[]
}) {
  return (
    <nav aria-label={label} className="mb-6 flex rounded-lg bg-muted p-1 sm:inline-flex">
      {tabs.map(({ to, label: tabLabel }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'flex min-h-10 flex-1 items-center justify-center rounded-md px-4 text-sm font-medium text-muted-foreground transition-colors sm:min-w-28',
              isActive && 'bg-background text-foreground shadow-sm',
            )
          }
        >
          {tabLabel}
        </NavLink>
      ))}
    </nav>
  )
}
