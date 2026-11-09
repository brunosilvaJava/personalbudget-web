import { ChevronRight, CreditCard, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import type { CreditCardResponse } from '@/api/contracts'
import { EmptyState } from '@/components/domain/EmptyState'
import { ErrorState } from '@/components/domain/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CardFormSheet } from './CardFormSheet'
import { useAllCards, useCardLimit } from './cardQueries'
import { LimitBar } from './LimitBar'

/** Each card with its closing and due days and the limit bar (used x available). */
export function CardsPage() {
  const cards = useAllCards()
  const [creating, setCreating] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  if (cards.isPending) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando cartões">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }
  if (cards.isError) return <ErrorState error={cards.error} onRetry={() => void cards.refetch()} />

  const active = cards.data.filter((card) => card.status === 'ACTIVE')
  const inactive = cards.data.filter((card) => card.status === 'INACTIVE')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Cartões</h2>
        <Button variant="outline" className="h-11" onClick={() => setCreating(true)}>
          <Plus aria-hidden />
          Novo cartão
        </Button>
      </div>
      {active.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Nenhum cartão cadastrado"
          description="Cadastre o cartão para lançar compras nele. A fatura é que tira o dinheiro da conta."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {active.map((card) => (
            <li key={card.code}>
              <CardItem card={card} />
            </li>
          ))}
        </ul>
      )}
      {inactive.length > 0 && (
        <>
          <Button
            variant="ghost"
            className="h-11 justify-start text-muted-foreground"
            onClick={() => setShowInactive(!showInactive)}
            aria-expanded={showInactive}
          >
            {showInactive ? 'Esconder' : 'Mostrar'} inativos ({inactive.length})
          </Button>
          {showInactive && (
            <ul className="flex flex-col gap-3">
              {inactive.map((card) => (
                <li key={card.code}>
                  <CardItem card={card} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <CardFormSheet open={creating} onOpenChange={setCreating} />
    </div>
  )
}

function CardItem({ card }: { card: CreditCardResponse }) {
  const limit = useCardLimit(card.code)
  return (
    <Link
      to={`/carteira/cartoes/${card.code}`}
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/60"
    >
      <div className="flex items-center gap-3">
        <CreditCard className="size-5 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{card.name}</p>
          <p className="text-sm text-muted-foreground">
            Fecha dia {card.closing_day} · vence dia {card.due_day}
            {card.status === 'INACTIVE' && ' · inativo'}
          </p>
        </div>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </div>
      <LimitBar limit={limit.data} />
    </Link>
  )
}
