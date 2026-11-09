import { ArrowLeft, CalendarDays, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'

import type { IncomeOccurrenceResponse, IncomeScheduleResponse } from '@/api/contracts'
import { Amount } from '@/components/domain/Amount'
import { ConfirmDialog } from '@/components/domain/ConfirmDialog'
import { EmptyState } from '@/components/domain/EmptyState'
import { ErrorState } from '@/components/domain/ErrorState'
import { FormAlert } from '@/components/domain/FormAlert'
import { LoadError } from '@/components/domain/LoadError'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCategoryLookup } from '@/features/categories/queries'
import { AnchorLockedNote } from '@/features/pay-cycles/AnchorLockedNote'
import { errorMessage } from '@/lib/api-errors'
import { currentMonth, shiftMonth } from '@/lib/dates'
import { formatMonth } from '@/lib/format'
import { useOnline } from '@/lib/online'
import { IncomeScheduleFormSheet } from './IncomeScheduleFormSheet'
import {
  useIncomeOccurrences,
  useIncomeSchedule,
  useMaterializeOccurrence,
  useSetIncomeScheduleActive,
} from './queries'
import {
  BUSINESS_WEEK_LABEL,
  describeOccurrenceDate,
  describeRule,
  describeValidity,
  OCCURRENCE_STATE_LABEL,
} from './rules'

const MONTHS_STEP = 12
const MONTHS_MAX = 36

/** One income schedule: its rule, its actions and the occurrences month by month. */
export function IncomeSchedulePage() {
  const { code = '' } = useParams()
  const schedule = useIncomeSchedule(code)

  return (
    <>
      <Button asChild variant="ghost" className="mb-2 -ml-3 h-11">
        <Link to="/receita/agenda">
          <ArrowLeft aria-hidden />
          Agenda
        </Link>
      </Button>
      {schedule.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : schedule.isError ? (
        <LoadError error={schedule.error} onRetry={() => void schedule.refetch()} />
      ) : (
        <ScheduleView schedule={schedule.data} />
      )}
    </>
  )
}

function ScheduleView({ schedule }: { schedule: IncomeScheduleResponse }) {
  const online = useOnline()
  const categories = useCategoryLookup()
  const setActive = useSetIncomeScheduleActive()
  const [editing, setEditing] = useState(false)
  const [confirmInactivate, setConfirmInactivate] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const active = schedule.status === 'ACTIVE'
  const category = schedule.category_code ? categories.get(schedule.category_code) : undefined

  const activate = () =>
    setActive.mutate(
      { code: schedule.code, active: true },
      {
        onSuccess: () => toast.success('Receita ativada.'),
        onError: (error) => setActionError(errorMessage(error)),
      },
    )

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{schedule.description}</h1>
          {schedule.anchor && <Badge variant="secondary">âncora</Badge>}
          {!active && <Badge variant="muted">inativa</Badge>}
        </div>
        <Amount operationType="CREDIT" amount={schedule.amount} className="text-3xl" />
      </header>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border bg-card p-4 text-sm">
        <dt className="text-muted-foreground">Quando cai</dt>
        <dd className="text-right">{describeRule(schedule)}</dd>
        <dt className="text-muted-foreground">Dias úteis</dt>
        <dd className="text-right">{BUSINESS_WEEK_LABEL[schedule.business_week]}</dd>
        <dt className="text-muted-foreground">Vigência</dt>
        <dd className="text-right">{describeValidity(schedule)}</dd>
        <dt className="text-muted-foreground">Categoria</dt>
        <dd className="text-right">{category?.name ?? 'Sem categoria'}</dd>
        {schedule.replaces_fixed_bill_code && (
          <>
            <dt className="text-muted-foreground">Substituiu</dt>
            <dd className="text-right">uma conta fixa de receita</dd>
          </>
        )}
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="h-11" onClick={() => setEditing(true)}>
          <Pencil aria-hidden />
          Editar
        </Button>
        <Button
          variant="outline"
          className="h-11"
          disabled={setActive.isPending || !online}
          onClick={() => (active ? setConfirmInactivate(true) : activate())}
        >
          {active ? 'Inativar' : 'Ativar'}
        </Button>
      </div>
      <AnchorLockedNote schedule={schedule} />
      {actionError && <FormAlert message={actionError} />}

      <Occurrences schedule={schedule} />

      <IncomeScheduleFormSheet open={editing} onOpenChange={setEditing} schedule={schedule} />
      <ConfirmDialog
        open={confirmInactivate}
        onOpenChange={setConfirmInactivate}
        title="Inativar receita?"
        description="Ela deixa de ser lançada e sai das projeções. O que já foi lançado continua em Movimentações. Dá para ativar de novo."
        confirmLabel="Inativar"
        pending={setActive.isPending}
        onConfirm={() =>
          setActive.mutate(
            { code: schedule.code, active: false },
            {
              onSuccess: () => {
                setConfirmInactivate(false)
                toast.success('Receita inativada.')
              },
              onError: (error) => {
                setConfirmInactivate(false)
                setActionError(errorMessage(error))
              },
            },
          )
        }
      />
    </div>
  )
}

function Occurrences({ schedule }: { schedule: IncomeScheduleResponse }) {
  const from = currentMonth()
  const [months, setMonths] = useState(MONTHS_STEP)
  const to = shiftMonth(from, months - 1)
  const occurrences = useIncomeOccurrences(schedule.code, from, to)
  const materialize = useMaterializeOccurrence()
  const [pending, setPending] = useState<IncomeOccurrenceResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const online = useOnline()
  /** The back materializes up to the next month; the job posts the rest on the day. */
  const lastMaterializable = shiftMonth(from, 1)

  return (
    <section aria-labelledby="occurrences-title" className="flex flex-col gap-3">
      <div>
        <h2 id="occurrences-title" className="font-medium">
          Mês a mês
        </h2>
        <p className="text-sm text-muted-foreground">
          Prevista: a data sai da regra e do calendário. Lançada: já existe em Movimentações, com
          data e valor fixos.
        </p>
      </div>
      {error && <FormAlert message={error} />}
      {occurrences.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Carregando ocorrências">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : occurrences.isError ? (
        <ErrorState error={occurrences.error} onRetry={() => void occurrences.refetch()} />
      ) : occurrences.data.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Nenhum mês neste período" />
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {occurrences.data.map((occurrence) => (
            <OccurrenceItem
              key={occurrence.nominal_month}
              occurrence={occurrence}
              canMaterialize={
                schedule.status === 'ACTIVE' &&
                occurrence.state === 'PROJECTED' &&
                occurrence.nominal_month <= lastMaterializable
              }
              disabled={!online || materialize.isPending}
              onMaterialize={() => setPending(occurrence)}
            />
          ))}
        </ul>
      )}
      {months < MONTHS_MAX && (
        <Button
          variant="outline"
          className="h-11 self-center"
          onClick={() => setMonths(Math.min(MONTHS_MAX, months + MONTHS_STEP))}
        >
          Ver mais {MONTHS_STEP} meses
        </Button>
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Lançar esta receita agora?"
        description={
          pending
            ? `A receita de ${formatMonth(pending.nominal_month)} entra em Movimentações como a receber. A data e o valor ficam fixos, mesmo que a regra mude depois.`
            : ''
        }
        confirmLabel="Lançar agora"
        pending={materialize.isPending}
        onConfirm={() => {
          if (!pending) return
          setError(null)
          materialize.mutate(
            { code: schedule.code, month: pending.nominal_month },
            {
              onSuccess: () => {
                toast.success(`Receita de ${formatMonth(pending.nominal_month)} lançada.`)
                setPending(null)
              },
              onError: (mutationError) => {
                setPending(null)
                setError(errorMessage(mutationError))
              },
            },
          )
        }}
      />
    </section>
  )
}

function OccurrenceItem({
  occurrence,
  canMaterialize,
  disabled,
  onMaterialize,
}: {
  occurrence: IncomeOccurrenceResponse
  canMaterialize: boolean
  disabled: boolean
  onMaterialize: () => void
}) {
  const needsReview = occurrence.state === 'CALENDAR_NOT_REVIEWED'
  const badge =
    occurrence.state === 'MATERIALIZED'
      ? 'income'
      : needsReview || occurrence.state === 'BUSINESS_DAY_NOT_FOUND'
        ? 'warning'
        : 'muted'
  return (
    <li className="flex flex-col gap-1.5 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium first-letter:uppercase">
          {formatMonth(occurrence.nominal_month)}
        </p>
        {occurrence.amount !== null && <Amount operationType="CREDIT" amount={occurrence.amount} />}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge variant={badge}>{OCCURRENCE_STATE_LABEL[occurrence.state]}</Badge>
        <span className="text-sm text-muted-foreground">{describeOccurrenceDate(occurrence)}</span>
      </div>
      {needsReview && occurrence.pending_year && (
        <Link
          to={`/receita/calendario?ano=${occurrence.pending_year}`}
          className="inline-flex min-h-11 items-center self-start text-sm font-medium underline underline-offset-4"
        >
          Revisar o calendário de {occurrence.pending_year}
        </Link>
      )}
      {canMaterialize && (
        <Button
          variant="outline"
          className="h-11 self-start"
          onClick={onMaterialize}
          disabled={disabled}
        >
          Lançar agora
        </Button>
      )}
    </li>
  )
}
