import { Outlet } from 'react-router'

import { PageHeader } from '@/components/layout/PageHeader'
import { TabsNav } from '@/components/layout/TabsNav'

const TABS = [
  { to: 'agenda', label: 'Agenda' },
  { to: 'calendario', label: 'Calendário' },
] as const

/** "Receita": the schedule of the main income and the holiday calendar its dates depend on. */
export function IncomeLayout() {
  return (
    <>
      <PageHeader title="Receita" description="Agenda de receita e calendário de feriados" />
      <TabsNav label="Seções da receita" tabs={TABS} />
      <Outlet />
    </>
  )
}
