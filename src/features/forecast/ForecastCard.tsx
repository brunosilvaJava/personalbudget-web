import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'

import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ForecastAlerts } from './ForecastAlerts'
import { useCashForecast } from './queries'

/** On Início: what is free until the end of the cycle (or month), with the warnings, and a link. */
export function ForecastCard() {
  const forecast = useCashForecast(null, false)

  return (
    <section aria-labelledby="forecast-card" className="flex flex-col gap-3">
      <Link
        to="/previsao"
        className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40"
      >
        <div className="flex-1">
          <h2 id="forecast-card" className="text-sm text-muted-foreground">
            Livre depois das reservas
          </h2>
          {forecast.isPending ? (
            <Skeleton className="mt-2 h-8 w-40" />
          ) : forecast.isError ? (
            <p className="mt-1 text-sm text-muted-foreground">Previsão indisponível agora.</p>
          ) : (
            <>
              <p
                className={cn(
                  'mt-1 text-2xl font-semibold tabular-nums',
                  forecast.data.free_after_reserves < 0 && 'text-expense',
                )}
              >
                {formatMoney(forecast.data.free_after_reserves)}
              </p>
              <p className="text-sm text-muted-foreground">
                até {formatDate(forecast.data.until)} · ver a previsão de caixa
              </p>
            </>
          )}
        </div>
        <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
      </Link>
      {forecast.data && <ForecastAlerts forecast={forecast.data} />}
    </section>
  )
}
