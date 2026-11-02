import { NavLink, Outlet } from 'react-router'

import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'

const TABS = [
  { to: 'fixas', label: 'Fixas' },
  { to: 'parceladas', label: 'Parceladas' },
] as const

/** "Contas" has two tabs, each its own route: /contas/fixas and /contas/parceladas. */
export function AccountsLayout() {
  return (
    <>
      <PageHeader title="Contas" description="Contas fixas e compras parceladas" />
      <nav aria-label="Tipo de conta" className="mb-6 inline-flex rounded-lg bg-muted p-1">
        {TABS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex min-h-10 min-w-28 items-center justify-center rounded-md px-4 text-sm font-medium text-muted-foreground transition-colors',
                isActive && 'bg-background text-foreground shadow-sm',
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  )
}
