import { ArrowLeftRight } from 'lucide-react'
import { useSearchParams } from 'react-router'

import { EmptyState } from '@/components/domain/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'

export function MovementsPage() {
  const [searchParams] = useSearchParams()
  const launching = searchParams.get('lancar') === '1'

  return (
    <>
      <PageHeader title="Movimentações" description="Receitas e despesas do período" />
      <EmptyState
        icon={ArrowLeftRight}
        title={launching ? 'Lançamento rápido em construção' : 'Movimentações em construção'}
        description={
          launching
            ? 'Lançar uma despesa já paga em até 3 toques chega na Fase 1.'
            : 'Lista por dia, filtros, lançar, editar, marcar como pago e excluir chegam na Fase 1.'
        }
      />
    </>
  )
}
