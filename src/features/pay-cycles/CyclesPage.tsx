import { CalendarRange, ChevronRight, Power } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import type { PayCycleConfigResponse, PayCycleResponse } from '@/api/contracts'
import { EmptyState } from '@/components/domain/EmptyState'
import { ErrorState } from '@/components/domain/ErrorState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useIncomeSchedule, useIncomeSchedules } from '@/features/income/queries'
import { describeRule } from '@/features/income/rules'
import { useCurrentPayCycle } from '@/features/period/queries'
import { daysBetween, todayIso } from '@/lib/dates'
import { formatDate } from '@/lib/format'
import { useOnline } from '@/lib/online'
import { ActivationSheet } from './ActivationSheet'
import { AnchorTransitionSheet } from './AnchorTransitionSheet'
import { CycleFlags, CycleStatusBadge } from './CycleBadges'
import { CycleSummaryView } from './CycleSummaryView'
import { DeactivationSheet } from './DeactivationSheet'
import { PendingList } from './PendingList'
import { usePayCycleConfig, usePayCycles, usePayCycleSummary } from './queries'
import { describeCycleDates, MODE_LABEL } from './rules'

/**
 * "Ciclos": whether the financial month starts on the anchor income (instead of on day 1), the
 * current cycle with its report, the pendencies, and the list of cycles.
 */
export function CyclesPage() {
  const config = usePayCycleConfig()

  return (
    <>
      <PageHeader
        title="Ciclos"
        description="O mês financeiro, que começa no dia em que a receita âncora cai"
      />
      <div className="flex flex-col gap-8">
        {config.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : config.isError ? (
          <ErrorState error={config.error} onRetry={() => void config.refetch()} />
        ) : (
          <>
            <ConfigSection config={config.data} />
            {config.data.mode === 'PAY_CYCLE' && <CurrentCycleSection />}
            <CycleListSection />
          </>
        )}
      </div>
    </>
  )
}

type Sheet = 'activate' | 'deactivate' | 'anchor' | null

function ConfigSection({ config }: { config: PayCycleConfigResponse }) {
  const online = useOnline()
  const [params, setParams] = useSearchParams()
  // `?ancora=1` is the link from the schedule screens, which cannot change the anchor themselves.
  const [sheet, setSheet] = useState<Sheet>(
    config.mode === 'PAY_CYCLE' && params.get('ancora') === '1' ? 'anchor' : null,
  )
  const on = config.mode === 'PAY_CYCLE'
  const close = (open: boolean) => {
    if (open) return
    setSheet(null)
    if (params.has('ancora')) setParams({}, { replace: true })
  }

  return (
    <section aria-labelledby="config-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="config-title" className="font-medium">
            {MODE_LABEL[config.mode]}
          </h2>
          <span className="text-sm text-muted-foreground">
            {on && config.activation_date
              ? `ligados desde ${formatDate(config.activation_date)}`
              : 'desligados'}
          </span>
        </div>
        {on && config.anchor_schedule_code ? (
          <AnchorInfo code={config.anchor_schedule_code} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Os relatórios seguem o mês do calendário. Ative os ciclos para o mês financeiro começar
            no dia da receita âncora, como o seu salário.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {on ? (
            <>
              <AnchorButton online={online} onOpen={() => setSheet('anchor')} />
              <Button
                variant="outline"
                className="h-11"
                disabled={!online}
                onClick={() => setSheet('deactivate')}
              >
                <Power aria-hidden />
                Desligar os ciclos
              </Button>
            </>
          ) : (
            <Button className="h-11" disabled={!online} onClick={() => setSheet('activate')}>
              <CalendarRange aria-hidden />
              Ativar os ciclos
            </Button>
          )}
        </div>
      </div>

      {config.pending.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-medium">Pendências</h3>
          <PendingList pending={config.pending} />
        </div>
      )}

      {!on && <ActivationSheet open={sheet === 'activate'} onOpenChange={close} config={config} />}
      {on && (
        <>
          <DeactivationSheet open={sheet === 'deactivate'} onOpenChange={close} config={config} />
          <AnchorSheet open={sheet === 'anchor'} onOpenChange={close} config={config} />
        </>
      )}
    </section>
  )
}

function AnchorInfo({ code }: { code: string }) {
  const anchor = useIncomeSchedule(code)
  if (anchor.isPending) return <Skeleton className="h-10 w-full" />
  if (anchor.isError)
    return <p className="text-sm text-muted-foreground">Receita âncora indisponível agora.</p>
  return (
    <p className="text-sm">
      Receita âncora:{' '}
      <Link
        to={`/receita/agenda/${anchor.data.code}`}
        className="font-medium text-primary underline-offset-4 hover:underline"
      >
        {anchor.data.description}
      </Link>{' '}
      · {describeRule(anchor.data)}
    </p>
  )
}

function AnchorButton({ online, onOpen }: { online: boolean; onOpen: () => void }) {
  return (
    <Button variant="outline" className="h-11" disabled={!online} onClick={onOpen}>
      Mudar a receita âncora
    </Button>
  )
}

/** Loads what the transition needs (the anchor and the other active schedules) before opening. */
function AnchorSheet({
  open,
  onOpenChange,
  config,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: PayCycleConfigResponse
}) {
  const anchor = useIncomeSchedule(config.anchor_schedule_code ?? '')
  const active = useIncomeSchedules('ACTIVE')
  if (!anchor.data || !active.data) return null
  const candidates = active.data.filter((schedule) => schedule.code !== anchor.data.code)
  return (
    <AnchorTransitionSheet
      open={open}
      onOpenChange={onOpenChange}
      anchor={anchor.data}
      candidates={candidates}
    />
  )
}

function CurrentCycleSection() {
  const current = useCurrentPayCycle()

  return (
    <section aria-labelledby="current-title" className="flex flex-col gap-3">
      <h2 id="current-title" className="font-medium">
        Ciclo atual
      </h2>
      {current.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : current.isError ? (
        <ErrorState error={current.error} onRetry={() => void current.refetch()} />
      ) : current.data ? (
        <CurrentCycle cycle={current.data} />
      ) : (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Hoje não cai em nenhum ciclo. As pendências acima dizem o que falta para o próximo
          começar.
        </p>
      )}
    </section>
  )
}

function CurrentCycle({ cycle }: { cycle: PayCycleResponse }) {
  const summary = usePayCycleSummary(cycle.code)
  const daysLeft = daysBetween(todayIso(), cycle.last_day) + 1

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold">{cycle.label}</span>
          <CycleStatusBadge status={cycle.status} />
          <CycleFlags cycle={cycle} />
        </div>
        <p className="text-sm text-muted-foreground">
          {describeCycleDates(cycle)}
          {daysLeft > 0 && ` · ${daysLeft === 1 ? 'último dia hoje' : `faltam ${daysLeft} dias`}`}
        </p>
      </div>
      {summary.isPending ? (
        <Skeleton className="h-28 w-full" />
      ) : summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
      ) : (
        <CycleSummaryView summary={summary.data} />
      )}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" className="h-11">
          <Link to={`/ciclos/${cycle.code}`}>Ver o ciclo e o relatório completo</Link>
        </Button>
        <Button asChild variant="outline" className="h-11">
          <Link to={`/ciclos/${cycle.code}/envelopes`}>Envelopes</Link>
        </Button>
      </div>
    </div>
  )
}

function CycleListSection() {
  const [includeCancelled, setIncludeCancelled] = useState(false)
  const cycles = usePayCycles(includeCancelled)

  return (
    <section aria-labelledby="list-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="list-title" className="font-medium">
          Todos os ciclos
        </h2>
        <div className="flex min-h-11 items-center gap-2 text-sm">
          <Switch
            id="include-cancelled"
            checked={includeCancelled}
            onCheckedChange={setIncludeCancelled}
          />
          <label htmlFor="include-cancelled">Mostrar cancelados</label>
        </div>
      </div>
      {cycles.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Carregando ciclos">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : cycles.isError ? (
        <ErrorState error={cycles.error} onRetry={() => void cycles.refetch()} />
      ) : cycles.data.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="Nenhum ciclo ainda"
          description="Eles aparecem aqui quando os ciclos forem ativados."
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {[...cycles.data]
            .sort((a, b) => b.start_date.localeCompare(a.start_date))
            .map((cycle) => (
              <li key={cycle.code}>
                <Link
                  to={`/ciclos/${cycle.code}`}
                  className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/60"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{cycle.label}</span>
                      <CycleStatusBadge status={cycle.status} />
                      <CycleFlags cycle={cycle} />
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {describeCycleDates(cycle)}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
        </ul>
      )}
    </section>
  )
}
