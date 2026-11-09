import { z } from 'zod'

import type {
  FixedBillRequest,
  FixedBillResponse,
  FixedBillUpdateRequest,
  InstallmentBillRequest,
  InstallmentBillResponse,
  InstallmentBillUpdateRequest,
} from '@/api/contracts'
import { RECURRENCE_TYPES } from '@/api/contracts'
import { amountSchema } from '@/features/movements/schema'
import { todayIso } from '@/lib/dates'
import { fromCents, toCents } from '@/lib/money'
import { dateOfYearDay, dayOfYear } from './recurrence'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const operationType = z.enum(['DEBIT', 'CREDIT'])

// ───────────────────────── Fixed bill ─────────────────────────

export const fixedBillSchema = z
  .object({
    operation_type: operationType,
    description: z.string().trim().min(3, 'Use ao menos 3 letras.').max(50, 'No máximo 50 letras.'),
    amount: amountSchema,
    recurrence_type: z.enum(RECURRENCE_TYPES),
    weekly_days: z.array(z.number()),
    monthly_days: z.array(z.number()),
    /** YEARLY: the date in the year; becomes a day of the year plus reference_year */
    yearly_date: z.string(),
    start_date: z.string().regex(DATE, 'Informe a data de início.'),
    end_date: z.string(),
    category_code: z.string().nullable(),
  })
  .superRefine((value, ctx) => {
    const missing =
      (value.recurrence_type === 'WEEKLY' && value.weekly_days.length === 0) ||
      (value.recurrence_type === 'MONTHLY' && value.monthly_days.length === 0) ||
      (value.recurrence_type === 'YEARLY' && !DATE.test(value.yearly_date))
    if (missing)
      ctx.addIssue({ code: 'custom', path: ['days'], message: 'Escolha quando ela vence.' })
    if (value.end_date && value.end_date < value.start_date) {
      ctx.addIssue({
        code: 'custom',
        path: ['end_date'],
        message: 'O fim não pode ser antes do início.',
      })
    }
  })

export type FixedBillFormInput = z.input<typeof fixedBillSchema>
export type FixedBillFormValues = z.output<typeof fixedBillSchema>
export const FIXED_BILL_FIELDS = [
  'operation_type',
  'description',
  'amount',
  'recurrence_type',
  'days',
  'start_date',
  'end_date',
  'category_code',
] as const

export function fixedBillDefaults(bill?: FixedBillResponse): FixedBillFormInput {
  if (!bill) {
    return {
      operation_type: 'DEBIT',
      description: '',
      amount: null as unknown as number,
      recurrence_type: 'MONTHLY',
      weekly_days: [],
      monthly_days: [],
      yearly_date: '',
      start_date: todayIso(),
      end_date: '',
      category_code: null,
    }
  }
  return {
    operation_type: bill.operation_type,
    description: bill.description,
    // The fixed bill response is NOT normalized: a debit may come negative.
    amount: Math.abs(toCents(bill.amount)),
    recurrence_type: bill.recurrence_type,
    weekly_days: bill.recurrence_type === 'WEEKLY' ? bill.days : [],
    monthly_days: bill.recurrence_type === 'MONTHLY' ? bill.days : [],
    yearly_date:
      bill.recurrence_type === 'YEARLY' && bill.days[0]
        ? dateOfYearDay(bill.days[0], bill.reference_year ?? new Date().getFullYear())
        : '',
    start_date: bill.start_date ?? todayIso(),
    end_date: bill.end_date ?? '',
    category_code: bill.category_code,
  }
}

function daysOf(values: FixedBillFormValues): {
  days: number[]
  reference_year?: number
  flg_leap_year?: boolean
} {
  if (values.recurrence_type === 'WEEKLY')
    return { days: [...values.weekly_days].sort((a, b) => a - b) }
  if (values.recurrence_type === 'MONTHLY')
    return { days: [...values.monthly_days].sort((a, b) => a - b) }
  const { day, referenceYear, leap } = dayOfYear(values.yearly_date)
  return { days: [day], reference_year: referenceYear, flg_leap_year: leap }
}

/** start_date always goes explicitly (bug E: never rely on the server default). */
export function toFixedBillRequest(values: FixedBillFormValues): FixedBillRequest {
  const body: FixedBillRequest = {
    operation_type: values.operation_type,
    description: values.description,
    amount: fromCents(values.amount),
    recurrence_type: values.recurrence_type,
    ...daysOf(values),
    start_date: values.start_date,
  }
  if (values.end_date) body.end_date = values.end_date
  if (values.category_code) body.category_code = values.category_code
  return body
}

/** `description` always goes (required by the PATCH); the rest only when changed. */
export function toFixedBillUpdate(
  bill: FixedBillResponse,
  values: FixedBillFormValues,
): FixedBillUpdateRequest {
  const body: FixedBillUpdateRequest = { description: values.description }
  if (values.operation_type !== bill.operation_type) body.operation_type = values.operation_type
  if (values.amount !== Math.abs(toCents(bill.amount))) body.amount = fromCents(values.amount)
  const next = daysOf(values)
  const sameDays =
    values.recurrence_type === bill.recurrence_type &&
    next.days.join(',') === [...bill.days].sort((a, b) => a - b).join(',') &&
    (next.reference_year === undefined || next.reference_year === bill.reference_year)
  if (values.recurrence_type !== bill.recurrence_type) body.recurrence_type = values.recurrence_type
  if (!sameDays) {
    body.days = next.days
    if (next.reference_year !== undefined) body.reference_year = next.reference_year
  }
  if (values.start_date !== bill.start_date) body.start_date = values.start_date
  if (values.end_date && values.end_date !== bill.end_date) body.end_date = values.end_date
  if (values.category_code && values.category_code !== bill.category_code) {
    body.category_code = values.category_code
  }
  return body
}

// ───────────────────────── Installment bill ─────────────────────────

export const installmentBillSchema = z.object({
  operation_type: operationType,
  description: z.string().trim().min(4, 'Use ao menos 4 letras.').max(50, 'No máximo 50 letras.'),
  /** cents, the value of EACH installment */
  amount: amountSchema,
  installment_total: z
    .number({ error: 'Informe as parcelas.' })
    .int()
    .min(1, 'Ao menos 1 parcela.')
    .max(999, 'Parcelas demais.'),
  purchase_date: z.string().regex(DATE, 'Informe a data da compra.'),
  category_code: z.string().nullable(),
})

export type InstallmentBillFormInput = z.input<typeof installmentBillSchema>
export type InstallmentBillFormValues = z.output<typeof installmentBillSchema>
export const INSTALLMENT_BILL_FIELDS = [
  'operation_type',
  'description',
  'amount',
  'installment_total',
  'purchase_date',
  'category_code',
] as const

export function installmentBillDefaults(bill?: InstallmentBillResponse): InstallmentBillFormInput {
  return {
    operation_type: bill?.operation_type ?? 'DEBIT',
    description: bill?.description ?? '',
    amount: bill ? Math.abs(toCents(bill.amount)) : (null as unknown as number),
    installment_total: bill?.installment_total ?? (null as unknown as number),
    purchase_date: bill?.purchase_date ?? todayIso(),
    category_code: bill?.category_code ?? null,
  }
}

export function toInstallmentBillRequest(
  values: InstallmentBillFormValues,
): InstallmentBillRequest {
  const body: InstallmentBillRequest = {
    operation_type: values.operation_type,
    description: values.description,
    amount: fromCents(values.amount),
    purchase_date: values.purchase_date,
    installment_total: values.installment_total,
  }
  if (values.category_code) body.category_code = values.category_code
  return body
}

export function toInstallmentBillUpdate(
  bill: InstallmentBillResponse,
  values: InstallmentBillFormValues,
): InstallmentBillUpdateRequest {
  const body: InstallmentBillUpdateRequest = { description: values.description }
  if (values.operation_type !== bill.operation_type) body.operation_type = values.operation_type
  if (values.amount !== Math.abs(toCents(bill.amount))) body.amount = fromCents(values.amount)
  if (values.purchase_date !== bill.purchase_date) body.purchase_date = values.purchase_date
  if (values.installment_total !== bill.installment_total) {
    body.installment_total = values.installment_total
  }
  if (values.category_code && values.category_code !== bill.category_code) {
    body.category_code = values.category_code
  }
  return body
}
