import { z } from 'zod'

import type {
  CardPurchaseRequest,
  CardPurchaseResponse,
  CardPurchaseUpdateRequest,
  CreditCardRequest,
  CreditCardResponse,
  CreditCardUpdateRequest,
} from '@/api/contracts'
import { amountSchema } from '@/features/movements/schema'
import { todayIso } from '@/lib/dates'
import { fromCents, toCents } from '@/lib/money'

const day = (label: string) =>
  z
    .number({ error: `Informe o dia de ${label}.` })
    .int()
    .min(1, 'Entre 1 e 31.')
    .max(31, 'Entre 1 e 31.')

// ───────────────────────── Card ─────────────────────────

export const cardSchema = z.object({
  name: z.string().trim().min(3, 'Use ao menos 3 letras.').max(50, 'No máximo 50 letras.'),
  closing_day: day('fechamento'),
  due_day: day('vencimento'),
  /** cents; empty = no limit control */
  credit_limit: z.number().int().positive('O limite precisa ser maior que zero.').nullable(),
  default_account_code: z.string().nullable(),
  /** whose are the purchases of this card unless a plastic or the purchase says otherwise */
  default_third_party_code: z.string().nullable(),
})

export type CardFormInput = z.input<typeof cardSchema>
export type CardFormValues = z.output<typeof cardSchema>
export const CARD_FIELDS = [
  'name',
  'closing_day',
  'due_day',
  'credit_limit',
  'default_account_code',
  'default_third_party_code',
] as const

export function cardDefaults(card?: CreditCardResponse): CardFormInput {
  return {
    name: card?.name ?? '',
    closing_day: card?.closing_day ?? (null as unknown as number),
    due_day: card?.due_day ?? (null as unknown as number),
    credit_limit: card?.credit_limit != null ? toCents(card.credit_limit) : null,
    default_account_code: card?.default_account_code ?? null,
    default_third_party_code: card?.default_third_party_code ?? null,
  }
}

export function toCardRequest(values: CardFormValues): CreditCardRequest {
  const body: CreditCardRequest = {
    name: values.name,
    closing_day: values.closing_day,
    due_day: values.due_day,
  }
  if (values.credit_limit !== null) body.credit_limit = fromCents(values.credit_limit)
  if (values.default_account_code) body.default_account_code = values.default_account_code
  if (values.default_third_party_code) {
    body.default_third_party_code = values.default_third_party_code
  }
  return body
}

/**
 * Only what changed. The limit and the default account can be changed but not cleared (back rule);
 * the default third party can, with its own flag.
 */
export function toCardUpdate(
  card: CreditCardResponse,
  values: CardFormValues,
): CreditCardUpdateRequest {
  const body: CreditCardUpdateRequest = {}
  if (values.name !== card.name) body.name = values.name
  if (values.closing_day !== card.closing_day) body.closing_day = values.closing_day
  if (values.due_day !== card.due_day) body.due_day = values.due_day
  if (values.credit_limit !== null && fromCents(values.credit_limit) !== card.credit_limit) {
    body.credit_limit = fromCents(values.credit_limit)
  }
  if (values.default_account_code && values.default_account_code !== card.default_account_code) {
    body.default_account_code = values.default_account_code
  }
  if (values.default_third_party_code !== card.default_third_party_code) {
    if (values.default_third_party_code) {
      body.default_third_party_code = values.default_third_party_code
    } else {
      body.clear_default_third_party = true
    }
  }
  return body
}

// ───────────────────────── Purchase ─────────────────────────

export const purchaseSchema = z.object({
  card_code: z.string().min(1, 'Escolha o cartão.'),
  description: z.string().trim().min(1, 'Informe a descrição.').max(100, 'No máximo 100 letras.'),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data.'),
  installments: z
    .number({ error: 'Informe as parcelas.' })
    .int()
    .min(1, 'De 1 a 60 parcelas.')
    .max(60, 'De 1 a 60 parcelas.'),
  /** cents, the value of EACH installment */
  installment_amount: amountSchema,
  category_code: z.string().nullable(),
  /** the last 4 digits of the plastic that made the purchase; empty = the card's TITULAR */
  card_last_digits: z.string().nullable(),
  /** OWNER_DEFAULT, OWNER_OWN or the code of a third party */
  owner: z.string(),
})

export type PurchaseFormInput = z.input<typeof purchaseSchema>
export type PurchaseFormValues = z.output<typeof purchaseSchema>
export const PURCHASE_FIELDS = [
  'card_code',
  'description',
  'purchase_date',
  'installments',
  'installment_amount',
  'category_code',
  'card_last_digits',
  'owner',
] as const

/** The purchase keeps the third party of the plastic or of the card (nothing is sent). */
export const OWNER_DEFAULT = '__default__'
/** The purchase is mine, whatever the defaults say (`own_expense`). */
export const OWNER_OWN = '__own__'

export function purchaseDefaults(
  purchase?: CardPurchaseResponse,
  cardCode?: string,
): PurchaseFormInput {
  if (purchase) {
    return {
      card_code: purchase.card_code,
      description: purchase.description,
      purchase_date: purchase.purchase_date,
      installments: purchase.installments,
      installment_amount: toCents(purchase.installment_amount),
      category_code: purchase.category_code,
      card_last_digits: purchase.card_last_digits,
      owner: purchase.third_party_code ?? OWNER_DEFAULT,
    }
  }
  return {
    card_code: cardCode ?? '',
    description: '',
    purchase_date: todayIso(),
    installments: 1,
    installment_amount: null as unknown as number,
    category_code: null,
    card_last_digits: null,
    owner: OWNER_DEFAULT,
  }
}

export function toPurchaseRequest(values: PurchaseFormValues): CardPurchaseRequest {
  const body: CardPurchaseRequest = {
    card_code: values.card_code,
    description: values.description,
    purchase_date: values.purchase_date,
    installments: values.installments,
    installment_amount: fromCents(values.installment_amount),
  }
  if (values.category_code) body.category_code = values.category_code
  if (values.card_last_digits) body.card_last_digits = values.card_last_digits
  if (values.owner === OWNER_OWN) body.own_expense = true
  else if (values.owner !== OWNER_DEFAULT) body.third_party_code = values.owner
  return body
}

export function toPurchaseUpdate(
  purchase: CardPurchaseResponse,
  values: PurchaseFormValues,
): CardPurchaseUpdateRequest {
  const body: CardPurchaseUpdateRequest = {}
  if (values.description !== purchase.description) body.description = values.description
  if (values.purchase_date !== purchase.purchase_date) body.purchase_date = values.purchase_date
  if (values.installments !== purchase.installments) body.installments = values.installments
  if (values.installment_amount !== toCents(purchase.installment_amount)) {
    body.installment_amount = fromCents(values.installment_amount)
  }
  if (values.category_code && values.category_code !== purchase.category_code) {
    body.category_code = values.category_code
  }
  // the back cannot take the plastic away from a purchase, only change it
  if (values.card_last_digits && values.card_last_digits !== purchase.card_last_digits) {
    body.card_last_digits = values.card_last_digits
  }
  // without third_party_code and own_expense the back keeps the third party as it is
  if (values.owner !== (purchase.third_party_code ?? OWNER_DEFAULT)) {
    if (values.owner === OWNER_OWN) body.own_expense = true
    else if (values.owner !== OWNER_DEFAULT) body.third_party_code = values.owner
  }
  return body
}
