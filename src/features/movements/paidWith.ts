import type { AccountResponse, CreditCardResponse, UUID } from '@/api/contracts'
import { readLocal, writeLocal } from '@/lib/storage'

/**
 * "Pagou com": an account (the movement plus its settlement on that account) or a card (a card
 * purchase in one installment; the invoice is what moves the cash). Kept as "account:<code>" or
 * "card:<code>"; the last one used is remembered on the device.
 */
export type PaidWith = { kind: 'account'; code: UUID } | { kind: 'card'; code: UUID }

export const PAID_WITH_STORAGE_KEY = 'personalbudget.paidWith'

export function encodePaidWith(value: PaidWith): string {
  return `${value.kind}:${value.code}`
}

export function decodePaidWith(value: string | null | undefined): PaidWith | null {
  const match = /^(account|card):(.+)$/.exec(value ?? '')
  return match ? { kind: match[1] as PaidWith['kind'], code: match[2]! } : null
}

/** The last one used if it is still active, otherwise the default account. */
export function initialPaidWith(
  accounts: readonly AccountResponse[],
  cards: readonly CreditCardResponse[],
): string {
  const last = decodePaidWith(readLocal(PAID_WITH_STORAGE_KEY))
  if (last?.kind === 'account' && accounts.some((account) => account.code === last.code)) {
    return encodePaidWith(last)
  }
  if (last?.kind === 'card' && cards.some((card) => card.code === last.code)) {
    return encodePaidWith(last)
  }
  const fallback = accounts.find((account) => account.default) ?? accounts[0]
  return fallback ? encodePaidWith({ kind: 'account', code: fallback.code }) : ''
}

export function rememberPaidWith(value: string): void {
  if (decodePaidWith(value)) writeLocal(PAID_WITH_STORAGE_KEY, value)
}
