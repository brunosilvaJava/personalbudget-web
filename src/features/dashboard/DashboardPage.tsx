import { LayoutDashboard } from 'lucide-react'

import { EmptyState } from '@/components/domain/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { ApiStatus } from '@/features/system/ApiStatus'

export function DashboardPage() {
  return (
    <>
      <PageHeader title="Início" description="Resumo do mês" />
      <div className="flex flex-col gap-4">
        <ApiStatus />
        <EmptyState
          icon={LayoutDashboard}
          title="Dashboard em construção"
          description="Saldo atual e projetado, receitas, despesas e alerta de saldo negativo chegam na Fase 2."
        />
      </div>
    </>
  )
}
