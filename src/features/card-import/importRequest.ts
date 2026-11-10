import type { CardPurchaseBatchItemRequest, CardPurchaseBatchRequest, UUID } from '@/api/contracts'
import { OWNER_DEFAULT, OWNER_OWN } from '@/features/wallet/cardSchema'
import { shiftBack, type ImportLine } from './parsers'

/** What the person decided about one line, besides what the file says. */
export interface LineState {
  /** goes in the import */
  selected: boolean
  /** the file shows the date of the installment: move it back so the invoice comes out right */
  adjusted: boolean
  /** a line that looks like a purchase already in the card goes in anyway */
  acceptDuplicate: boolean
}

export const INITIAL_LINE_STATE: LineState = {
  selected: true,
  adjusted: false,
  acceptDuplicate: false,
}

/** The most the API takes in one import (all or nothing, so it cannot be split). */
export const MAX_IMPORT_LINES = 300

/** The date the API will read as the date of the purchase. */
export function effectiveDate(line: ImportLine, state: LineState): string {
  return state.adjusted
    ? shiftBack(line.purchaseDate, line.firstInstallment - 1)
    : line.purchaseDate
}

/**
 * `owner` is OWNER_DEFAULT (nothing sent: the plastic and the card decide), OWNER_OWN or the code of
 * a third party, for the whole file.
 */
export function toBatchItem(
  line: ImportLine,
  state: LineState,
  owner: string,
): CardPurchaseBatchItemRequest {
  const item: CardPurchaseBatchItemRequest = {
    description: line.description,
    purchase_date: effectiveDate(line, state),
    installments: line.installments,
    installment_amount: line.installmentAmount,
  }
  if (line.firstInstallment > 1) item.first_installment = line.firstInstallment
  if (line.lastDigits) item.card_last_digits = line.lastDigits
  if (owner === OWNER_OWN) item.own_expense = true
  else if (owner !== OWNER_DEFAULT) item.third_party_code = owner
  if (state.acceptDuplicate) item.accept_duplicate = true
  return item
}

/** The selected lines, in the order of the file; the API answers one entry per item, in this order. */
export function selectedLines(
  lines: ImportLine[],
  states: Record<number, LineState>,
): ImportLine[] {
  return lines.filter((line) => (states[line.id] ?? INITIAL_LINE_STATE).selected)
}

export function toBatchRequest(
  cardCode: UUID,
  lines: ImportLine[],
  states: Record<number, LineState>,
  owner: string,
  dryRun: boolean,
): CardPurchaseBatchRequest {
  return {
    credit_card_code: cardCode,
    dry_run: dryRun,
    items: selectedLines(lines, states).map((line) =>
      toBatchItem(line, states[line.id] ?? INITIAL_LINE_STATE, owner),
    ),
  }
}
