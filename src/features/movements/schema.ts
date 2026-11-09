import { z } from 'zod'

import type {
  CardPurchaseRequest,
  FinancialMovementRequest,
  FinancialMovementResponse,
  FinancialMovementUpdateRequest,
  ISODate,
  MovementSettlementRequest,
  OperationType,
} from '@/api/contracts'
import { dateOf, nowApiDateTime, todayIso } from '@/lib/dates'
import { fromCents, toCents } from '@/lib/money'
import type { PaidWith } from './paidWith'

/** The back's rules (FinancialMovementRequest): 4..50 chars, > 0, 8 integer digits. */
export const DESCRIPTION_MIN = 4
export const DESCRIPTION_MAX = 50
const MAX_CENTS = 9_999_999_999

export const amountSchema = z
  .number({ error: 'Informe o valor.' })
  .int()
  .positive('O valor precisa ser maior que zero.')
  .max(MAX_CENTS, 'Valor alto demais.')

export const descriptionSchema = z
  .string()
  .trim()
  .min(DESCRIPTION_MIN, `Use ao menos ${DESCRIPTION_MIN} letras (ex.: “Gás de cozinha”).`)
  .max(DESCRIPTION_MAX, `No máximo ${DESCRIPTION_MAX} letras.`)

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data.')
const operationTypeSchema = z.enum(['DEBIT', 'CREDIT'])

// ───────────────────────── Quick launch ─────────────────────────

export const quickLaunchSchema = z
  .object({
    operation_type: operationTypeSchema,
    amount: amountSchema,
    description: descriptionSchema,
    category_code: z.string().nullable(),
    /** the day it happened; today means "now" */
    movement_date: dateSchema,
    /** the "ainda não paguei" switch: only the movement is created */
    unpaid: z.boolean(),
    /** used when unpaid */
    due_date: z.string(),
    /** "account:<code>" or "card:<code>" ("Pagou com"); empty = the default account */
    paid_with: z.string(),
  })
  .refine((value) => !value.unpaid || /^\d{4}-\d{2}-\d{2}$/.test(value.due_date), {
    path: ['due_date'],
    message: 'Informe o vencimento.',
  })

export type QuickLaunchInput = z.input<typeof quickLaunchSchema>
export type QuickLaunchValues = z.output<typeof quickLaunchSchema>

export const QUICK_LAUNCH_FIELDS = [
  'operation_type',
  'amount',
  'description',
  'category_code',
  'movement_date',
  'due_date',
] as const

export function quickLaunchDefaults(operationType: OperationType = 'DEBIT'): QuickLaunchInput {
  const today = todayIso()
  return {
    operation_type: operationType,
    amount: null as unknown as number,
    description: '',
    category_code: null,
    movement_date: today,
    unpaid: false,
    due_date: today,
    paid_with: '',
  }
}

/** A movement of today happens "now"; another day, at noon (no time was asked). */
function movementDateTime(date: ISODate): string {
  return date === todayIso() ? nowApiDateTime() : `${date}T12:00:00`
}

export type QuickLaunchRequests =
  | {
      kind: 'movement'
      movement: FinancialMovementRequest
      settlement: MovementSettlementRequest | null
    }
  | { kind: 'card'; purchase: CardPurchaseRequest }

/**
 * Paid with an account: TWO calls when already paid, the movement and then the settlement of the
 * whole amount on that account (the default one when none was chosen). Paid with a card: ONE card
 * purchase in a single installment; nothing is settled, the invoice payment moves the cash.
 */
export function toQuickLaunchRequests(
  values: QuickLaunchValues,
  paidWith: PaidWith | null,
): QuickLaunchRequests {
  if (paidWith?.kind === 'card' && values.operation_type === 'DEBIT') {
    const purchase: CardPurchaseRequest = {
      card_code: paidWith.code,
      description: values.description,
      purchase_date: values.movement_date,
      installments: 1,
      installment_amount: fromCents(values.amount),
    }
    if (values.category_code) purchase.category_code = values.category_code
    return { kind: 'card', purchase }
  }

  const movementDate = movementDateTime(values.movement_date)
  const movement: FinancialMovementRequest = {
    operation_type: values.operation_type,
    description: values.description,
    amount: fromCents(values.amount),
    movement_date: movementDate,
    due_date: values.unpaid ? `${values.due_date}T00:00:00` : movementDate,
  }
  if (values.category_code) movement.category_code = values.category_code
  let settlement: MovementSettlementRequest | null = null
  if (!values.unpaid) {
    settlement = { amount: fromCents(values.amount), effective_date: values.movement_date }
    if (paidWith?.kind === 'account') settlement.account_code = paidWith.code
  }
  return { kind: 'movement', movement, settlement }
}

// ───────────────────────── Edit ─────────────────────────

export const movementEditSchema = z
  .object({
    operation_type: operationTypeSchema,
    amount: amountSchema,
    description: descriptionSchema,
    category_code: z.string().nullable(),
    movement_date: dateSchema,
    due_date: dateSchema,
    competence_mode: z.enum(['auto', 'manual']),
    competence_date: z.string(),
  })
  .refine(
    (value) =>
      value.competence_mode === 'auto' || /^\d{4}-\d{2}-\d{2}$/.test(value.competence_date),
    { path: ['competence_date'], message: 'Informe a competência.' },
  )

export type MovementEditInput = z.input<typeof movementEditSchema>
export type MovementEditValues = z.output<typeof movementEditSchema>

export const MOVEMENT_EDIT_FIELDS = [
  'operation_type',
  'amount',
  'description',
  'category_code',
  'movement_date',
  'due_date',
  'competence_date',
] as const

export function movementEditDefaults(movement: FinancialMovementResponse): MovementEditInput {
  return {
    operation_type: movement.operation_type,
    amount: toCents(movement.amount),
    description: movement.description,
    category_code: movement.category_code,
    movement_date: dateOf(movement.movement_date),
    due_date: dateOf(movement.due_date),
    competence_mode: movement.competence_overridden ? 'manual' : 'auto',
    competence_date: movement.competence_date ?? dateOf(movement.movement_date),
  }
}

/**
 * Only what changed goes in the PATCH: a movement of a closed cycle refuses (409) changes to the
 * amount, category, type or competence, so an untouched field must not be sent. Dates keep the
 * time they had.
 */
export function toUpdateRequest(
  movement: FinancialMovementResponse,
  values: MovementEditValues,
): FinancialMovementUpdateRequest {
  const body: FinancialMovementUpdateRequest = {}
  if (values.operation_type !== movement.operation_type) body.operation_type = values.operation_type
  if (values.description !== movement.description) body.description = values.description
  if (values.amount !== toCents(movement.amount)) body.amount = fromCents(values.amount)
  if (values.movement_date !== dateOf(movement.movement_date)) {
    body.movement_date = `${values.movement_date}${movement.movement_date.slice(10)}`
  }
  if (values.due_date !== dateOf(movement.due_date)) {
    body.due_date = `${values.due_date}${movement.due_date.slice(10)}`
  }
  if (values.category_code && values.category_code !== movement.category_code) {
    body.category_code = values.category_code
  }
  if (values.competence_mode === 'manual') {
    if (!movement.competence_overridden || values.competence_date !== movement.competence_date) {
      body.competence_date = values.competence_date
    }
  } else if (movement.competence_overridden) {
    body.restore_automatic_competence = true
  }
  return body
}

/** What is still owed: the whole amount minus the active settlements. */
export function remainingAmount(movement: FinancialMovementResponse): number {
  return fromCents(toCents(movement.amount) - toCents(movement.amount_paid ?? 0))
}
