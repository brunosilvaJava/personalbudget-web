import { ChartLine } from 'lucide-react'

import { EmptyState } from '@/components/domain/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'

export function DailyBalancePage() {
  return (
    <>
      <PageHeader title="Caixa diário" description="Saldo real e projetado, dia a dia" />
      <EmptyState
        icon={ChartLine}
        title="Caixa diário em construção"
        description="O gráfico real x projetado e a lista por dia chegam na Fase 3."
      />
    </>
  )
}
