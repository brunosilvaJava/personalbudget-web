import { RotateCcw, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

import { ErrorState } from '@/components/domain/ErrorState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { todayIso } from '@/lib/dates'
import { formatDate, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ForecastAlerts } from './ForecastAlerts'
import { ForecastBreakdown } from './ForecastBreakdown'
import { useCashForecast } from './queries'
import { horizonBounds, horizonError } from './rules'

/**
 * "Previsão de caixa": how much is left until a date, after what is already committed. The default
 * horizon is the back's (end of the current cycle, or of the month); the date and the late-income
 * switch live in the URL (`?ate=` and `?atrasadas=1`) so a view can be shared and survives a reload.
 */
export function ForecastPage() {
  const today = todayIso()
  const { min, max } = horizonBounds(today)
  const [params, setParams] = useSearchParams()
  const asked = params.get('ate')
  // A link from yesterday can carry a date that is now before today: it falls back to the default.
  const until = asked && horizonError(asked, today) === null ? asked : null
  const includeLate = params.get('atrasadas') === '1'
  const forecast = useCashForecast(until, includeLate)
  // What was typed and cannot be asked for yet (partial or out of range); null = follow the URL.
  const [draft, setDraft] = useState<string | null>(null)

  const update = (change: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params)
    change(next)
    setParams(next, { replace: true })
  }
  const onHorizon = (value: string) => {
    if (value === '' || horizonError(value, today) !== null) {
      setDraft(value)
      return
    }
    setDraft(null)
    update((next) => next.set('ate', value))
  }
  const draftError = draft ? horizonError(draft, today) : null

  return (
    <>
      <PageHeader
        title="Previsão de caixa"
        description="Quanto sobra até uma data, depois do que você já assumiu"
      />
      <div className="flex flex-col gap-6">
        <section aria-label="Opções da previsão" className="flex flex-col gap-3">
          <Field id="forecast-until" label="Previsão até" error={draftError ?? undefined}>
            {(aria) => (
              <Input
                {...aria}
                type="date"
                min={min}
                max={max}
                value={draft ?? until ?? forecast.data?.until ?? ''}
                onChange={(event) => onHorizon(event.target.value)}
              />
            )}
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-h-11 items-center gap-2 text-sm">
              <Switch
                id="include-late-income"
                checked={includeLate}
                onCheckedChange={(checked) =>
                  update((next) => {
                    if (checked) next.set('atrasadas', '1')
                    else next.delete('atrasadas')
                  })
                }
              />
              <label htmlFor="include-late-income">Contar receitas atrasadas</label>
            </div>
            {(until || draft !== null) && (
              <Button
                variant="ghost"
                className="h-11"
                onClick={() => {
                  setDraft(null)
                  update((next) => next.delete('ate'))
                }}
              >
                <RotateCcw aria-hidden />
                Voltar ao padrão
              </Button>
            )}
          </div>
        </section>

        {forecast.isPending ? (
          <Skeleton className="h-64 w-full" aria-label="Calculando a previsão" />
        ) : forecast.isError ? (
          <ErrorState
            error={forecast.error}
            onRetry={() => void forecast.refetch()}
            retrying={forecast.isRefetching}
          />
        ) : (
          <div
            className={cn('flex flex-col gap-6', forecast.isPlaceholderData && 'opacity-60')}
            aria-busy={forecast.isPlaceholderData}
          >
            <section aria-labelledby="free-title" className="rounded-lg border bg-card p-4">
              <h2 id="free-title" className="text-sm text-muted-foreground">
                Livre depois das reservas
              </h2>
              <p
                className={cn(
                  'mt-1 text-3xl font-semibold tabular-nums',
                  forecast.data.free_after_reserves < 0 && 'text-expense',
                )}
              >
                {formatMoney(forecast.data.free_after_reserves)}
              </p>
              <p className="text-sm text-muted-foreground">
                até {formatDate(forecast.data.until)} · menor caixa no período:{' '}
                <span className="whitespace-nowrap">
                  {formatMoney(forecast.data.lowest_projected_cash)}
                </span>{' '}
                em {formatDate(forecast.data.lowest_projected_cash_date)}
              </p>
            </section>
            <ForecastAlerts forecast={forecast.data} live />
            {forecast.data.projection_incomplete && (
              <div
                role="note"
                className="flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <div className="flex flex-col gap-1">
                  <p className="font-medium">A projeção está incompleta</p>
                  <p>
                    Falta calcular parte do que está previsto (por exemplo, o calendário de feriados
                    de um ano). O resultado pode estar mais folgado do que a realidade.
                  </p>
                </div>
              </div>
            )}
            <ForecastBreakdown forecast={forecast.data} />
          </div>
        )}
      </div>
    </>
  )
}
