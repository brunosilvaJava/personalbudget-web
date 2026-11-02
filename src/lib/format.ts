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

/** "2026-11-10" → "10/11/2026" */
export function formatDate(value: ISODate | ISODateTime): string {
  return format(parseApiDate(value), 'dd/MM/yyyy')
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
