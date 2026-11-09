import { ArrowLeft, ChevronRight, Pencil, Plus, ReceiptText } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'

import type { CardInvoiceSummaryResponse, CreditCardResponse } from '@/api/contracts'
import { EmptyState } from '@/components/domain/EmptyState'
import { ErrorState } from '@/components/domain/ErrorState'
import { FormAlert } from '@/components/domain/FormAlert'
import { LoadError } from '@/components/domain/LoadError'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage } from '@/lib/api-errors'
import { formatMoney, formatShortDate, formatShortMonth } from '@/lib/format'
import { useOnline } from '@/lib/online'
import { CardFormSheet } from './CardFormSheet'
import { useCard, useCardInvoices, useCardLimit, useSetCardActive } from './cardQueries'
import { INVOICE_STATE_LABEL } from './labels'
import { LimitBar } from './LimitBar'
import { PurchaseSheet } from './PurchaseSheet'

/** One card: limit, actions and its invoices, newest first. */
export function CardPage() {
  const { code = '' } = useParams()
  const card = useCard(code)
  return (
    <>
      <Button asChild variant="ghost" className="mb-2 -ml-3 h-11">
        <Link to="/carteira/cartoes">
          <ArrowLeft aria-hidden />
          Cartões
        </Link>
      </Button>
      {card.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : card.isError ? (
        <LoadError error={card.error} onRetry={() => void card.refetch()} />
      ) : (
        <CardView card={card.data} />
      )}
    </>
  )
}

function CardView({ card }: { card: CreditCardResponse }) {
  const online = useOnline()
  const limit = useCardLimit(card.code)
  const invoices = useCardInvoices(card.code)
  const setActive = useSetCardActive()
  const [editing, setEditing] = useState(false)
  const [buying, setBuying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const active = card.status === 'ACTIVE'

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{card.name}</h1>
          {!active && <Badge variant="muted">inativo</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          Fecha dia {card.closing_day} · vence dia {card.due_day}
        </p>
      </header>
      <div className="rounded-lg border bg-card p-4">
        <LimitBar limit={limit.data} />
      </div>
      <div className="flex flex-wrap gap-2">
        {active && (
          <Button className="h-11" onClick={() => setBuying(true)} disabled={!online}>
            <Plus aria-hidden />
            Nova compra
          </Button>
        )}
        <Button variant="outline" className="h-11" onClick={() => setEditing(true)}>
          <Pencil aria-hidden />
          Editar
        </Button>
        <Button
          variant="outline"
          className="h-11"
          disabled={setActive.isPending || !online}
          onClick={() =>
            setActive.mutate(
              { code: card.code, active: !active },
              {
                onSuccess: () => toast.success(active ? 'Cartão inativado.' : 'Cartão ativado.'),
                onError: (mutationError) => setError(errorMessage(mutationError)),
              },
            )
          }
        >
          {active ? 'Inativar' : 'Ativar'}
        </Button>
      </div>
      {error && <FormAlert message={error} />}

      <section aria-labelledby="invoices-title" className="flex flex-col gap-2">
        <h2 id="invoices-title" className="font-medium">
          Faturas
        </h2>
        {invoices.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : invoices.isError ? (
          <ErrorState error={invoices.error} onRetry={() => void invoices.refetch()} />
        ) : invoices.data.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="Nenhuma fatura ainda"
            description="A primeira compra cria a fatura do mês em que ela cai."
          />
        ) : (
          <ul className="divide-y overflow-hidden rounded-lg border bg-card">
            {invoices.data.map((invoice) => (
              <li key={invoice.code}>
                <InvoiceRow invoice={invoice} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <CardFormSheet open={editing} onOpenChange={setEditing} card={card} />
      <PurchaseSheet open={buying} onOpenChange={setBuying} cardCode={card.code} />
    </div>
  )
}

export function InvoiceStateBadge({ state }: { state: CardInvoiceSummaryResponse['state'] }) {
  return (
    <Badge variant={state === 'PAID' ? 'muted' : state === 'CLOSED' ? 'warning' : 'outline'}>
      {INVOICE_STATE_LABEL[state]}
    </Badge>
  )
}

function InvoiceRow({ invoice }: { invoice: CardInvoiceSummaryResponse }) {
  return (
    <Link
      to={`/carteira/faturas/${invoice.code}`}
      className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/60"
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-medium capitalize">
          {formatShortMonth(invoice.reference_month)}
          <InvoiceStateBadge state={invoice.state} />
        </p>
        <p className="text-sm text-muted-foreground">
          Fecha {formatShortDate(invoice.closing_date)} · vence {formatShortDate(invoice.due_date)}
        </p>
      </div>
      <div className="flex flex-col items-end">
        <span className="font-medium tabular-nums">{formatMoney(invoice.total_amount)}</span>
        {invoice.paid_amount > 0 && invoice.state !== 'PAID' && (
          <span className="text-xs text-muted-foreground tabular-nums">
            pago {formatMoney(invoice.paid_amount)}
          </span>
        )}
      </div>
      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
    </Link>
  )
}
