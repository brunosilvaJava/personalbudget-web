import { ArrowLeft, HandCoins } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'

import type { ReceivableResponse, ReceivableStatus, ThirdPartyResponse } from '@/api/contracts'
import { EmptyState } from '@/components/domain/EmptyState'
import { ErrorState } from '@/components/domain/ErrorState'
import { LoadError } from '@/components/domain/LoadError'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMoney, formatShortDate } from '@/lib/format'
import { fromCents, toCents } from '@/lib/money'
import { useOnline } from '@/lib/online'
import { DueDateSheet } from './DueDateSheet'
import { useReceivables, useThirdParty } from './receivableQueries'
import { ReceiptSheet } from './ReceiptSheet'
import { WriteOffSheet } from './WriteOffSheet'

const STATUS_LABEL: Record<ReceivableStatus, string> = {
  PENDING: 'A receber',
  LATE: 'Atrasado',
  PAID_OUT: 'Recebido',
  WRITTEN_OFF: 'Baixado',
}

/** A receivable still waiting for money. */
const isOpen = (receivable: ReceivableResponse) =>
  receivable.status === 'PENDING' || receivable.status === 'LATE'

/** One third party: what they owe, receivable by receivable, and the money received from them. */
export function ThirdPartyPage() {
  const { code = '' } = useParams()
  const party = useThirdParty(code)
  return (
    <>
      <Button asChild variant="ghost" className="mb-2 -ml-3 h-11">
        <Link to="/carteira/terceiros">
          <ArrowLeft aria-hidden />
          Terceiros
        </Link>
      </Button>
      {party.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : party.isError ? (
        <LoadError error={party.error} onRetry={() => void party.refetch()} />
      ) : (
        <ThirdPartyView thirdParty={party.data} />
      )}
    </>
  )
}

function ThirdPartyView({ thirdParty }: { thirdParty: ThirdPartyResponse }) {
  const online = useOnline()
  const receivables = useReceivables(thirdParty.code)
  const [receiving, setReceiving] = useState(false)
  const [dueOf, setDueOf] = useState<ReceivableResponse | null>(null)
  const [writeOffOf, setWriteOffOf] = useState<ReceivableResponse | null>(null)
  const open = (receivables.data ?? []).filter(isOpen)
  const remaining = fromCents(
    open.reduce((sum, receivable) => sum + toCents(receivable.remaining_amount), 0),
  )

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{thirdParty.name}</h1>
          {thirdParty.status === 'INACTIVE' && <Badge variant="muted">inativo</Badge>}
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          {thirdParty.open_count === 0
            ? 'Nada a receber'
            : `A receber ${formatMoney(thirdParty.open_amount)}`}
          {thirdParty.late_amount > 0 && ` · ${formatMoney(thirdParty.late_amount)} atrasado`}
        </p>
      </header>

      <Button
        className="h-12 text-base"
        disabled={!online || open.length === 0}
        onClick={() => setReceiving(true)}
      >
        <HandCoins aria-hidden />
        Registrar recebimento
      </Button>

      <section aria-labelledby="receivables-title" className="flex flex-col gap-2">
        <h2 id="receivables-title" className="font-medium">
          Valores a receber
        </h2>
        {receivables.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : receivables.isError ? (
          <ErrorState error={receivables.error} onRetry={() => void receivables.refetch()} />
        ) : receivables.data.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="Nada a receber ainda"
            description="Cada parcela de uma compra deste terceiro vira um valor a receber."
          />
        ) : (
          <ul className="divide-y overflow-hidden rounded-lg border bg-card">
            {receivables.data.map((receivable) => (
              <li key={receivable.code} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{receivable.description}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                    <Badge
                      variant={
                        receivable.status === 'LATE'
                          ? 'warning'
                          : isOpen(receivable)
                            ? 'outline'
                            : 'muted'
                      }
                    >
                      {STATUS_LABEL[receivable.status]}
                    </Badge>
                    {isOpen(receivable) && (
                      <span>vence {formatShortDate(receivable.due_date)}</span>
                    )}
                  </p>
                </div>
                <div className="flex flex-col items-end text-right">
                  <span className="font-medium tabular-nums">
                    {formatMoney(
                      isOpen(receivable) ? receivable.remaining_amount : receivable.amount,
                    )}
                  </span>
                  {isOpen(receivable) && receivable.received_amount > 0 && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      recebido {formatMoney(receivable.received_amount)} de{' '}
                      {formatMoney(receivable.amount)}
                    </span>
                  )}
                </div>
                {isOpen(receivable) && (
                  <div className="flex flex-col items-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Alterar vencimento de ${receivable.description}`}
                      disabled={!online}
                      onClick={() => setDueOf(receivable)}
                    >
                      Vencimento
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      aria-label={`Dar baixa em ${receivable.description}`}
                      disabled={!online}
                      onClick={() => setWriteOffOf(receivable)}
                    >
                      Dar baixa
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ReceiptSheet
        open={receiving}
        onOpenChange={setReceiving}
        thirdParty={thirdParty}
        remaining={remaining}
      />
      <WriteOffSheet
        open={writeOffOf !== null}
        onOpenChange={(next) => !next && setWriteOffOf(null)}
        receivable={writeOffOf}
        thirdPartyName={thirdParty.name}
      />
      <DueDateSheet
        open={dueOf !== null}
        onOpenChange={(next) => !next && setDueOf(null)}
        receivable={dueOf}
      />
    </div>
  )
}
