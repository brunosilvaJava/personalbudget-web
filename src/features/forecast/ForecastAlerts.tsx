import { TriangleAlert } from 'lucide-react'

import type { CashForecastResponse } from '@/api/contracts'
import { describeInsufficientBudget, describeNegativeCash } from './rules'

/**
 * The two warnings of the forecast, which are independent: the cash itself going below zero on
 * some day, and the budget (projected cash minus the reserves) not covering what is committed.
 * `live` announces them (the forecast page); the card on Início keeps them quiet.
 */
export function ForecastAlerts({
  forecast,
  live = false,
}: {
  forecast: CashForecastResponse
  live?: boolean
}) {
  if (!forecast.negative_cash_alert && !forecast.insufficient_budget_alert) return null
  return (
    <div className="flex flex-col gap-2">
      {forecast.negative_cash_alert && (
        <Alert title="Caixa negativo" live={live}>
          {describeNegativeCash(forecast)}
        </Alert>
      )}
      {forecast.insufficient_budget_alert && (
        <Alert title="Orçamento insuficiente" live={live}>
          {describeInsufficientBudget(forecast)}
        </Alert>
      )}
    </div>
  )
}

function Alert({ title, live, children }: { title: string; live: boolean; children: string }) {
  return (
    <div
      role={live ? 'alert' : undefined}
      className="flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="font-medium">{title}</p>
        <p>{children}</p>
      </div>
    </div>
  )
}
