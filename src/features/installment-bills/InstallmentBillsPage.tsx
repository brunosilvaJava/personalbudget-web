import { ReceiptText } from 'lucide-react'

import { EmptyState } from '@/components/domain/EmptyState'

export function InstallmentBillsPage() {
  return (
    <EmptyState
      icon={ReceiptText}
      title="Parceladas em construção"
      description="Cadastro com valor por parcela e total da compra chega na Fase 4."
    />
  )
}
