import { Repeat } from 'lucide-react'

import { EmptyState } from '@/components/domain/EmptyState'

export function FixedBillsPage() {
  return (
    <EmptyState
      icon={Repeat}
      title="Contas fixas em construção"
      description="Cadastro, recorrência, ativar e inativar chegam na Fase 3."
    />
  )
}
