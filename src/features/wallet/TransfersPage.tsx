import { ArrowRight, ArrowRightLeft, Plus, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'

import type { AccountTransferResponse } from '@/api/contracts'
import { ConfirmDialog } from '@/components/domain/ConfirmDialog'
import { EmptyState } from '@/components/domain/EmptyState'
import { ErrorState } from '@/components/domain/ErrorState'
import { FormAlert } from '@/components/domain/FormAlert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PeriodPicker } from '@/features/period/PeriodPicker'
import { monthPeriod, readPeriod, writePeriod } from '@/features/period/period'
import { errorMessage } from '@/lib/api-errors'
import { currentMonth, dateOf } from '@/lib/dates'
import { formatDate, formatMoney } from '@/lib/format'
import { useOnline } from '@/lib/online'
import { cn } from '@/lib/utils'
import { useAccountLookup, useReverseTransfer, useTransfers } from './queries'
import { TransferFormSheet } from './TransferFormSheet'

/** Transfers of the period (the month by default), reversed ones struck through. */
export function TransfersPage() {
  const online = useOnline()
  const [searchParams, setSearchParams] = useSearchParams()
  const defaultPeriod = monthPeriod(currentMonth())
  const period = readPeriod(searchParams) ?? defaultPeriod
  const transfers = useTransfers(period.start, period.end)
  const accounts = useAccountLookup()
  const reverse = useReverseTransfer()
  const [creating, setCreating] = useState(false)
  const [toReverse, setToReverse] = useState<AccountTransferResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const name = (code: string) => accounts.get(code)?.name ?? '…'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <PeriodPicker
          period={period}
          defaultPeriod={defaultPeriod}
          onChange={(next) => setSearchParams(writePeriod(searchParams, next), { replace: true })}
          className="flex-1 rounded-lg border bg-card p-1"
        />
        <Button className="h-11" onClick={() => setCreating(true)} disabled={!online}>
          <Plus aria-hidden />
          Nova transferência
        </Button>
      </div>
      {error && <FormAlert message={error} />}

      {transfers.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : transfers.isError ? (
        <ErrorState error={transfers.error} onRetry={() => void transfers.refetch()} />
      ) : transfers.data.length === 0 ? (
        <EmptyState
          icon={ArrowRightLeft}
          title="Nenhuma transferência no período"
          description="Mover dinheiro entre contas não é despesa nem receita: só muda o saldo das duas."
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {transfers.data.map((transfer) => {
            const reversed = transfer.reversed_at !== null
            return (
              <li key={transfer.code} className="flex items-center gap-3 px-4 py-3">
                <div className={cn('min-w-0 flex-1', reversed && 'text-muted-foreground')}>
                  <p className="flex flex-wrap items-center gap-1.5 font-medium">
                    <span className={cn(reversed && 'line-through')}>
                      {name(transfer.from_account_code)}
                    </span>
                    <ArrowRight className="size-4 text-muted-foreground" aria-label="para" />
                    <span className={cn(reversed && 'line-through')}>
                      {name(transfer.to_account_code)}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(transfer.effective_date)}
                    {transfer.description && ` · ${transfer.description}`}
                  </p>
                  {reversed && (
                    <Badge variant="muted" className="mt-1">
                      estornada em {formatDate(dateOf(transfer.reversed_at!))}
                    </Badge>
                  )}
                </div>
                <span
                  className={cn(
                    'font-medium tabular-nums',
                    reversed && 'text-muted-foreground line-through',
                  )}
                >
                  {formatMoney(transfer.amount)}
                </span>
                {!reversed && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`Estornar transferência de ${formatMoney(transfer.amount)}`}
                    onClick={() => setToReverse(transfer)}
                    disabled={!online}
                  >
                    <Undo2 aria-hidden />
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <TransferFormSheet open={creating} onOpenChange={setCreating} />
      <ConfirmDialog
        open={toReverse !== null}
        onOpenChange={(open) => !open && setToReverse(null)}
        title="Estornar transferência?"
        description={
          toReverse &&
          `${formatMoney(toReverse.amount)} voltam de ${name(toReverse.to_account_code)} para ${name(toReverse.from_account_code)}. O registro fica no histórico.`
        }
        confirmLabel="Estornar"
        pending={reverse.isPending}
        onConfirm={() => {
          if (!toReverse) return
          setError(null)
          reverse.mutateAsync(toReverse.code).then(
            () => {
              setToReverse(null)
              toast.success('Transferência estornada.')
            },
            (reverseError) => {
              setToReverse(null)
              setError(errorMessage(reverseError))
            },
          )
        }}
      />
    </div>
  )
}
