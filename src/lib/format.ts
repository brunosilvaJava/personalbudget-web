import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import {
  signedAmount,
  type ISODate,
  type ISODateTime,
  type Money,
  type OperationType,
  type YearMonth,
} from '@/api/contracts'
import { parseApiDate } from './dates'

/** The only place money and dates are formatted for display. */

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})
const signedCurrency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  signDisplay: 'exceptZero',
})

/** 1234.5 → "R$ 1.234,50" */
export function formatMoney(value: Money): string {
  return currency.format(value)
}

/** Value with the sign from operation_type: DEBIT 50 → "-R$ 50,00", CREDIT 50 → "+R$ 50,00". */
export function formatSignedMoney(operationType: OperationType, amount: Money): string {
  return signedCurrency.format(signedAmount(operationType, amount))
}

/** A value that already carries its sign: -50 → "-R$ 50,00", 50 → "+R$ 50,00", 0 → "R$ 0,00". */
export function formatSignedValue(value: Money): string {
  return signedCurrency.format(value)
}

/** "2026-11-10" → "10/11/2026" */
export function formatDate(value: ISODate | ISODateTime): string {
  return format(parseApiDate(value), 'dd/MM/yyyy')
}

/** "2026-11-10" → "10/11" */
export function formatShortDate(value: ISODate | ISODateTime): string {
  return format(parseApiDate(value), 'dd/MM')
}

/** "2026-11-10T15:30:00" → "15:30" */
export function formatTime(value: ISODateTime): string {
  return format(parseApiDate(value), 'HH:mm')
}

/** "2026-11-10" → "terça, 10 de nov" (list headers) */
export function formatDayHeader(value: ISODate | ISODateTime): string {
  return format(parseApiDate(value), "EEE, d 'de' MMM", { locale: ptBR })
}

/** "2026-11" → "novembro de 2026" */
export function formatMonth(month: YearMonth): string {
  return format(parseApiDate(`${month}-01`), "MMMM 'de' yyyy", {
    locale: ptBR,
  })
}

/** "2026-11-05", "2026-12-04" → "05/11 a 04/12"; the same day → "05/11/2026" */
export function formatDateRange(start: ISODate, end: ISODate): string {
  if (start === end) return formatDate(start)
  const sameYear = start.slice(0, 4) === end.slice(0, 4)
  return sameYear
    ? `${formatShortDate(start)} a ${formatShortDate(end)}`
    : `${formatDate(start)} a ${formatDate(end)}`
}

/** "2026-12" → "dez/2026" (invoices) */
export function formatShortMonth(month: YearMonth): string {
  return format(parseApiDate(`${month}-01`), 'MMM/yyyy', { locale: ptBR })
}
