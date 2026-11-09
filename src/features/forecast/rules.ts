import type { CashForecastResponse, ISODate } from '@/api/contracts'
import { shiftDate } from '@/lib/dates'
import { formatDate, formatMoney } from '@/lib/format'

/** The back refuses a horizon before today or more than this many days ahead. */
export const MAX_HORIZON_DAYS = 366

export function horizonBounds(today: ISODate): { min: ISODate; max: ISODate } {
  return { min: today, max: shiftDate(today, MAX_HORIZON_DAYS) }
}

/** Why a typed horizon cannot be asked for, or null when the back would accept it. */
export function horizonError(value: string, today: ISODate): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Informe uma data válida.'
  const { min, max } = horizonBounds(today)
  if (value < min) return 'A data não pode ser anterior a hoje.'
  if (value > max) return `A data pode ir no máximo ${MAX_HORIZON_DAYS} dias à frente.`
  return null
}

/** "O caixa fica negativo em 25/11/2026": the first day the projected cash goes below zero. */
export function describeNegativeCash(forecast: CashForecastResponse): string {
  const lowest = `${formatMoney(forecast.lowest_projected_cash)} em ${formatDate(forecast.lowest_projected_cash_date)}`
  if (forecast.first_negative_date) {
    return `O caixa fica negativo em ${formatDate(forecast.first_negative_date)}. O menor valor é ${lowest}.`
  }
  return `O caixa fica negativo em algum dia até ${formatDate(forecast.until)}. O menor valor é ${lowest}.`
}

/** What the reserve and the card still to come take out of the projected cash. */
export function describeInsufficientBudget(forecast: CashForecastResponse): string {
  return `O caixa projetado (${formatMoney(forecast.projected_cash)}) não cobre a reserva dos envelopes e o cartão que vence depois de ${formatDate(forecast.until)}: faltam ${formatMoney(Math.abs(forecast.free_after_reserves))}.`
}
