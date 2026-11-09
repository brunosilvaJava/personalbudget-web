import { Outlet } from 'react-router'

import { PageHeader } from '@/components/layout/PageHeader'
import { TabsNav } from '@/components/layout/TabsNav'

const TABS = [
  { to: 'fixas', label: 'Fixas' },
  { to: 'parceladas', label: 'Parceladas' },
] as const

/** "Recorrentes" has two tabs, each its own route: /recorrentes/fixas and /recorrentes/parceladas. */
export function RecurringLayout() {
  return (
    <>
      <PageHeader title="Recorrentes" description="Contas fixas e compras parceladas" />
      <TabsNav label="Tipo de recorrente" tabs={TABS} />
      <Outlet />
    </>
  )
}
