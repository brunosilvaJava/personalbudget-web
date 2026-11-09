import type { FinancialMovementResponse } from '@/api/contracts'

/**
 * A card installment (E9d): paid by paying the invoice, changed through the purchase. The back
 * answers 409 to a settlement, an edit or a delete of the installment alone.
 */
export function isCardInstallment(movement: FinancialMovementResponse): boolean {
  return movement.card_purchase_code !== null
}

/**
 * "cartão 2/3". The response has the installment number only; the total is in the description the
 * back writes ("Geladeira (2/3)").
 */
export function cardInstallmentLabel(movement: FinancialMovementResponse): string {
  const total = /\((\d+)\/(\d+)\)\s*$/.exec(movement.description)?.[2]
  const number = movement.installment_number
  if (number === null) return 'cartão'
  return total ? `cartão ${number}/${total}` : `cartão ${number}`
}
