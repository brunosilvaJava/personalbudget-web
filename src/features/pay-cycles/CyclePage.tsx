import { ArrowLeft, CalendarClock, PiggyBank } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'

import type { PayCycleConfigResponse, PayCycleResponse } from '@/api/contracts'
import { ErrorState } from '@/components/domain/ErrorState'
import { LoadError } from '@/components/domain/LoadError'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePayCycle } from '@/features/period/queries'
import { formatDate } from '@/lib/format'
import { AdjustmentHistory } from './AdjustmentHistory'
import { ClosureSection } from './ClosureSection'
import { CycleFlags, CycleStatusBadge } from './CycleBadges'
import { CycleSummaryView } from './CycleSummaryView'
import { EndAdjustmentSheet } from './EndAdjustmentSheet'
import { PendingList } from './PendingList'
import { usePayCycleConfig, usePayCycles, usePayCycleSummary } from './queries'
import { describeCycleDates } from './rules'

/** One cycle: its dates, the report by competence, the boundary adjustment and the history. */
export function CyclePage() {
  const { code = '' } = useParams()
  const cycle = usePayCycle(code)

  return (
    <>
      <Button asChild variant="ghost" className="mb-2 -ml-3 h-11">
        <Link to="/ciclos">
          <ArrowLeft aria-hidden />
          Ciclos
        </Link>
      </Button>
      {cycle.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : cycle.isError ? (
        <LoadError error={cycle.error} onRetry={() => void cycle.refetch()} />
      ) : (
        <CycleView cycle={cycle.data} />
      )}
    </>
  )
}

function CycleView({ cycle }: { cycle: PayCycleResponse }) {
  const summary = usePayCycleSummary(cycle.code)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Ciclo {cycle.label}</h1>
          <CycleStatusBadge status={cycle.status} />
          <CycleFlags cycle={cycle} />
        </div>
        <p className="text-sm text-muted-foreground">{describeCycleDates(cycle)}</p>
      </header>

      {cycle.pending.length > 0 && <PendingList pending={cycle.pending} />}

      <section aria-labelledby="summary-title" className="flex flex-col gap-3">
        <div>
          <h2 id="summary-title" className="font-medium">
            Relatório por competência
          </h2>
          <p className="text-sm text-muted-foreground">
            “Pago” é o que já saiu ou entrou neste ciclo. “Projetado” soma o que ainda está
            previsto. Saldos das contas, transferências e cartões não entram aqui.
          </p>
        </div>
        {summary.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : summary.isError ? (
          <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
        ) : (
          <CycleSummaryView summary={summary.data} full />
        )}
      </section>

      <section aria-labelledby="envelopes-title" className="flex flex-col gap-2">
        <h2 id="envelopes-title" className="font-medium">
          Envelopes
        </h2>
        <p className="text-sm text-muted-foreground">
          O quanto você planejou gastar por categoria neste ciclo e o que já foi usado.
        </p>
        <Button asChild variant="outline" className="h-11 self-start">
          <Link to={`/ciclos/${cycle.code}/envelopes`}>
            <PiggyBank aria-hidden />
            Ver os envelopes
          </Link>
        </Button>
      </section>

      <ClosureSection cycle={cycle} />

      <BoundarySection cycle={cycle} />
      <AdjustmentHistory code={cycle.code} />
    </div>
  )
}

/** Why the boundary of this cycle cannot be adjusted, or null when it can be offered. */
function boundaryBlocker(
  cycle: PayCycleResponse,
  config: PayCycleConfigResponse,
  next: PayCycleResponse | undefined,
): string | null {
  if (cycle.status === 'CANCELLED') return 'Este ciclo foi cancelado.'
  if (cycle.status === 'CLOSED') return 'Este ciclo está fechado.'
  if (!config.activation_date || cycle.start_date < config.activation_date) {
    return 'Este ciclo é de uma ativação anterior: virou histórico.'
  }
  if (!next) {
    return 'Este é o último ciclo: o fim dele acompanha a receita âncora e não pode ser ajustado à mão.'
  }
  return null
}

function BoundarySection({ cycle }: { cycle: PayCycleResponse }) {
  const config = usePayCycleConfig()
  const cycles = usePayCycles(false)
  const [open, setOpen] = useState(false)

  // Nothing to adjust while the cycles are off (the history above still shows what happened).
  if (!config.data || config.data.mode !== 'PAY_CYCLE' || !cycles.data) return null
  const next = cycles.data.find((item) => item.start_date === cycle.end_date_exclusive)
  const blocker = boundaryBlocker(cycle, config.data, next)

  return (
    <section aria-labelledby="boundary-title" className="flex flex-col gap-2">
      <h2 id="boundary-title" className="font-medium">
        Virada do ciclo
      </h2>
      <p className="text-sm text-muted-foreground">
        O próximo ciclo começa em <strong>{formatDate(cycle.end_date_exclusive)}</strong>.
        {cycle.end_adjusted && ' Esta virada foi ajustada à mão e não é recalculada.'}
      </p>
      {blocker ? (
        <p className="text-sm text-muted-foreground">{blocker}</p>
      ) : (
        next && (
          <>
            <Button variant="outline" className="h-11 self-start" onClick={() => setOpen(true)}>
              <CalendarClock aria-hidden />
              Ajustar a virada
            </Button>
            <EndAdjustmentSheet open={open} onOpenChange={setOpen} cycle={cycle} next={next} />
          </>
        )
      )}
    </section>
  )
}
