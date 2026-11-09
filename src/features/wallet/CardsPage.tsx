import { CreditCard } from 'lucide-react'

import { EmptyState } from '@/components/domain/EmptyState'

/** Phase 2b brings cards, purchases and invoices. */
export function CardsPage() {
  return (
    <EmptyState
      icon={CreditCard}
      title="Cartões em construção"
      description="Cartões com limite, compras parceladas, faturas e o pagamento da fatura chegam na próxima etapa."
    />
  )
}
