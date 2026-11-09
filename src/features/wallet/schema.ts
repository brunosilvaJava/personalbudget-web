import { z } from 'zod'

import type {
  AccountRequest,
  AccountResponse,
  AccountTransferRequest,
  AccountUpdateRequest,
} from '@/api/contracts'
import { ACCOUNT_TYPES } from '@/api/contracts'
import { amountSchema } from '@/features/movements/schema'
import { todayIso } from '@/lib/dates'
import { fromCents, toCents } from '@/lib/money'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data.')

// ───────────────────────── Account ─────────────────────────

export const accountSchema = z.object({
  name: z.string().trim().min(3, 'Use ao menos 3 letras.').max(50, 'No máximo 50 letras.'),
  type: z.enum(ACCOUNT_TYPES),
  /** cents; empty means zero */
  initial_balance: z.number().int().max(999_999_999_999, 'Valor alto demais.').nullable(),
  initial_balance_date: dateSchema,
})

export type AccountFormInput = z.input<typeof accountSchema>
export type AccountFormValues = z.output<typeof accountSchema>
export const ACCOUNT_FIELDS = ['name', 'type', 'initial_balance', 'initial_balance_date'] as const

export function accountDefaults(account?: AccountResponse): AccountFormInput {
  if (!account) {
    return { name: '', type: 'CHECKING', initial_balance: null, initial_balance_date: todayIso() }
  }
  return {
    name: account.name,
    type: account.type,
    initial_balance: toCents(account.initial_balance),
    initial_balance_date: account.initial_balance_date,
  }
}

export function toAccountRequest(values: AccountFormValues): AccountRequest {
  return {
    name: values.name,
    type: values.type,
    initial_balance: fromCents(values.initial_balance ?? 0),
    initial_balance_date: values.initial_balance_date,
  }
}

/** Only what changed. */
export function toAccountUpdate(
  account: AccountResponse,
  values: AccountFormValues,
): AccountUpdateRequest {
  const body: AccountUpdateRequest = {}
  if (values.name !== account.name) body.name = values.name
  if (values.type !== account.type) body.type = values.type
  const cents = values.initial_balance ?? 0
  if (cents !== toCents(account.initial_balance)) body.initial_balance = fromCents(cents)
  if (values.initial_balance_date !== account.initial_balance_date) {
    body.initial_balance_date = values.initial_balance_date
  }
  return body
}

// ───────────────────────── Transfer ─────────────────────────

export const transferSchema = z
  .object({
    from_account_code: z.string().min(1, 'Escolha a conta de origem.'),
    to_account_code: z.string().min(1, 'Escolha a conta de destino.'),
    amount: amountSchema,
    effective_date: dateSchema,
    description: z.string().trim().max(100, 'No máximo 100 letras.'),
  })
  .refine((value) => value.from_account_code !== value.to_account_code, {
    path: ['to_account_code'],
    message: 'Escolha uma conta diferente da origem.',
  })

export type TransferFormInput = z.input<typeof transferSchema>
export type TransferFormValues = z.output<typeof transferSchema>
export const TRANSFER_FIELDS = [
  'from_account_code',
  'to_account_code',
  'amount',
  'effective_date',
  'description',
] as const

export function toTransferRequest(values: TransferFormValues): AccountTransferRequest {
  const body: AccountTransferRequest = {
    from_account_code: values.from_account_code,
    to_account_code: values.to_account_code,
    amount: fromCents(values.amount),
    effective_date: values.effective_date,
  }
  if (values.description) body.description = values.description
  return body
}
