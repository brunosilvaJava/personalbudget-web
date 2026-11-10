import { Outlet } from 'react-router'

import { PageHeader } from '@/components/layout/PageHeader'
import { TabsNav } from '@/components/layout/TabsNav'

const TABS = [
  { to: 'contas', label: 'Contas' },
  { to: 'cartoes', label: 'Cartões' },
  { to: 'transferencias', label: 'Transferências' },
  { to: 'terceiros', label: 'Terceiros' },
] as const

/** "Carteira": where the money really is. "Contas" here only means bank accounts and wallets. */
export function WalletLayout() {
  return (
    <>
      <PageHeader title="Carteira" description="Contas, cartões, transferências e terceiros" />
      <TabsNav label="Seções da carteira" tabs={TABS} />
      <Outlet />
    </>
  )
}
