import { ArrowLeft, Pencil, PiggyBank, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'

import type {
  BudgetEnvelopeResponse,
  CycleEnvelopesResponse,
  PayCycleResponse,
} from '@/api/contracts'
import { ConfirmDialog } from '@/components/domain/ConfirmDialog'
import { EmptyState } from '@/components/domain/EmptyState'
import { ErrorState } from '@/components/domain/ErrorState'
import { LoadError } from '@/components/domain/LoadError'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CycleStatusBadge } from '@/features/pay-cycles/CycleBadges'
import { describeCycleDates } from '@/features/pay-cycles/rules'
import { usePayCycle } from '@/features/period/queries'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { EnvelopeFormSheet } from './EnvelopeFormSheet'
import { useCycleEnvelopes, useDeleteEnvelope } from './queries'
import {
  describeConsumption,
  describeRemaining,
  envelopeState,
  readOnlyReason,
  usedShare,
  type EnvelopeState,
} from './rules'

/** The envelopes of one cycle: what was planned per category and how much of it is spent. */
export function EnvelopesPage() {
  const { code = '' } = useParams()
  const cycle = usePayCycle(code)

  return (
    <>
      <Button asChild variant="ghost" className="mb-2 -ml-3 h-11">
        <Link to={`/ciclos/${code}`}>
          <ArrowLeft aria-hidden />
          Ciclo
        </Link>
      </Button>
      {cycle.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : cycle.isError ? (
        <LoadError error={cycle.error} onRetry={() => void cycle.refetch()} />
      ) : (
        <EnvelopesView cycle={cycle.data} />
      )}
    </>
  )
}

function EnvelopesView({ cycle }: { cycle: PayCycleResponse }) {
  const envelopes = useCycleEnvelopes(cycle.code)
  // The sheet and the dialog live here, not in the cards: a refreshed list takes a card off the
  // screen, and with it the dialog it opened. `envelope` is kept while closing so the title holds.
  const [sheet, setSheet] = useState<{ open: boolean; envelope?: BudgetEnvelopeResponse }>({
    open: false,
  })
  const [removal, setRemoval] = useState<{ open: boolean; envelope?: BudgetEnvelopeResponse }>({
    open: false,
  })
  const remove = useDeleteEnvelope()
  const reason = readOnlyReason(cycle)
  const taken = new Set(envelopes.data?.envelopes.map((envelope) => envelope.category_code))

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Envelopes · {cycle.label}</h1>
          <CycleStatusBadge status={cycle.status} />
        </div>
        <p className="text-sm text-muted-foreground">{describeCycleDates(cycle)}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada envelope separa uma parte do ciclo para uma categoria de despesa. O que ainda não foi
          gasto fica reservado na previsão de caixa.
        </p>
      </header>

      {reason && (
        <p role="note" className="rounded-lg border bg-muted/40 p-3 text-sm">
          {reason}
        </p>
      )}

      {envelopes.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : envelopes.isError ? (
        <ErrorState error={envelopes.error} onRetry={() => void envelopes.refetch()} />
      ) : (
        <>
          <Totals data={envelopes.data} />
          {!reason && (
            <Button className="h-11 self-start" onClick={() => setSheet({ open: true })}>
              <Plus aria-hidden />
              Novo envelope
            </Button>
          )}
          {envelopes.data.envelopes.length === 0 ? (
            <EmptyState
              icon={PiggyBank}
              title="Nenhum envelope neste ciclo"
              description={
                reason
                  ? 'Este ciclo não teve envelopes.'
                  : 'Crie um para separar, por exemplo, o que vai para o mercado.'
              }
            />
          ) : (
            <ul className="flex flex-col gap-3" aria-label="Envelopes do ciclo">
              {envelopes.data.envelopes.map((envelope) => (
                <EnvelopeCard
                  key={envelope.code}
                  envelope={envelope}
                  readOnly={reason !== null}
                  onEdit={() => setSheet({ open: true, envelope })}
                  onDelete={() => setRemoval({ open: true, envelope })}
                />
              ))}
            </ul>
          )}
          <EnvelopeFormSheet
            open={sheet.open}
            onOpenChange={(open) => setSheet((current) => ({ ...current, open }))}
            cycleCode={cycle.code}
            envelope={sheet.envelope}
            takenCategories={taken}
          />
          <ConfirmDialog
            open={removal.open}
            onOpenChange={(open) => setRemoval((current) => ({ ...current, open }))}
            title="Excluir este envelope?"
            description={`O envelope de ${removal.envelope?.category_name ?? ''} deixa de reservar dinheiro neste ciclo. Os gastos da categoria não mudam.`}
            confirmLabel="Excluir"
            destructive
            pending={remove.isPending}
            onConfirm={() => {
              const target = removal.envelope
              if (!target) return
              // The toast (success or the back's 409) comes from the hook.
              const close = () => setRemoval((current) => ({ ...current, open: false }))
              void remove.mutateAsync(target.code).then(close, close)
            }}
          />
        </>
      )}
    </div>
  )
}

function Totals({ data }: { data: CycleEnvelopesResponse }) {
  return (
    <section aria-label="Totais dos envelopes" className="flex flex-col gap-3">
      {data.projection_incomplete && (
        <div
          role="note"
          className="flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="font-medium">A projeção está incompleta</p>
            <p>
              Falta calcular parte do que está previsto: o que ainda será gasto pode estar acima do
              que os envelopes mostram.
            </p>
          </div>
        </div>
      )}
      <dl className="grid grid-cols-2 gap-3 rounded-lg border p-4 text-sm sm:grid-cols-4">
        <Total label="Planejado" value={data.total_planned} />
        <Total label="Gasto" value={data.total_consumed} />
        <Total label="Ainda livre" value={data.total_reserved} />
        <Total label="Estourou" value={data.total_overrun} warn={data.total_overrun > 0} />
      </dl>
    </section>
  )
}

function Total({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('text-base font-semibold tabular-nums', warn && 'text-expense')}>
        {formatMoney(value)}
      </dd>
    </div>
  )
}

const BAR_CLASS: Record<EnvelopeState, string> = {
  ok: 'bg-income',
  near: 'bg-warning',
  over: 'bg-expense',
}

function EnvelopeCard({
  envelope,
  readOnly,
  onEdit,
  onDelete,
}: {
  envelope: BudgetEnvelopeResponse
  readOnly: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const state = envelopeState(envelope)
  const percent = Math.round(usedShare(envelope) * 100)

  return (
    <li className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-medium">{envelope.category_name}</h2>
          <p className="text-sm text-muted-foreground">
            Planejado {formatMoney(envelope.planned_amount)}
          </p>
        </div>
        {state === 'over' && <Badge variant="expense">estourou</Badge>}
        {state === 'near' && <Badge variant="warning">quase no limite</Badge>}
      </div>
      <div
        role="progressbar"
        aria-label={`Gasto de ${envelope.category_name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent}% do planejado`}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full', BAR_CLASS[state])}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <p className={cn('font-medium', state === 'over' && 'text-expense')}>
          {describeRemaining(envelope)}
        </p>
        <p className="text-muted-foreground">{describeConsumption(envelope)}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Reservado na previsão: {formatMoney(envelope.reserved_amount)}
      </p>
      {!readOnly && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-11"
            onClick={onEdit}
            aria-label={`Alterar valor de ${envelope.category_name}`}
          >
            <Pencil aria-hidden />
            Alterar valor
          </Button>
          <Button
            variant="ghost"
            className="h-11 text-destructive"
            onClick={onDelete}
            aria-label={`Excluir envelope de ${envelope.category_name}`}
          >
            <Trash2 aria-hidden />
            Excluir
          </Button>
        </div>
      )}
    </li>
  )
}
