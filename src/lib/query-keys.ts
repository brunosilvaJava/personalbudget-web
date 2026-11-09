import type { QueryClient } from '@tanstack/react-query'

import type {
  AccountStatus,
  CategoryStatus,
  CreditCardStatus,
  FinancialMovementQuery,
  FixedBillQuery,
  ISODate,
  InstallmentBillQuery,
  UUID,
  YearMonth,
} from '@/api/contracts'

/**
 * Whose data a query reads. Fixed in 'mine' until Phase 9 adds the couple's view ('group');
 * it is already part of every key so that change does not touch the screens.
 */
export type Scope = 'mine'
export const CURRENT_SCOPE: Scope = 'mine'

/** Movement filters without the page: the infinite list keeps its pages under one key. */
export type MovementListFilters = Omit<FinancialMovementQuery, 'page' | 'size'>

export const queryKeys = {
  health: ['health'] as const,

  movements: (filters: MovementListFilters) => ['movements', CURRENT_SCOPE, filters] as const,
  movement: (code: UUID) => ['movement', CURRENT_SCOPE, code] as const,
  settlements: (movementCode: UUID) => ['settlements', movementCode] as const,

  balance: (initialDate: ISODate, endDate: ISODate) =>
    ['balance', CURRENT_SCOPE, initialDate, endDate] as const,
  dashboard: (month: YearMonth) => ['dashboard', CURRENT_SCOPE, month] as const,

  categories: (statuses: readonly CategoryStatus[]) => ['categories', statuses] as const,
  categoryGroups: ['category-groups'] as const,

  fixedBills: (filters: FixedBillQuery) => ['fixed-bills', CURRENT_SCOPE, filters] as const,
  fixedBill: (code: UUID) => ['fixed-bill', CURRENT_SCOPE, code] as const,
  installmentBills: (filters: InstallmentBillQuery) =>
    ['installment-bills', CURRENT_SCOPE, filters] as const,
  installmentBill: (code: UUID) => ['installment-bill', CURRENT_SCOPE, code] as const,

  accounts: (statuses: readonly AccountStatus[]) => ['accounts', statuses] as const,
  account: (code: UUID) => ['account', code] as const,
  accountBalances: (date: ISODate | 'today') => ['account-balances', date] as const,
  accountBalance: (code: UUID, date: ISODate | 'today') => ['account-balance', code, date] as const,
  accountStatement: (code: UUID, start: ISODate, end: ISODate) =>
    ['account-statement', code, start, end] as const,
  transfers: (start: ISODate, end: ISODate, accountCode: UUID | null) =>
    ['transfers', start, end, accountCode] as const,

  creditCards: (statuses: readonly CreditCardStatus[]) => ['credit-cards', statuses] as const,
  creditCard: (code: UUID) => ['credit-cards', 'code', code] as const,
  cardLimit: (code: UUID) => ['card-limit', code] as const,
  cardInvoices: (cardCode: UUID) => ['card-invoices', cardCode] as const,
  cardInvoice: (code: UUID) => ['card-invoice', code] as const,
  invoicePayments: (invoiceCode: UUID) => ['invoice-payments', invoiceCode] as const,
  cardPurchase: (code: UUID) => ['card-purchase', code] as const,

  currentPayCycle: ['pay-cycles', 'current'] as const,
  payCycleByDate: (date: ISODate) => ['pay-cycles', 'date', date] as const,
  payCycle: (code: UUID) => ['pay-cycles', 'code', code] as const,
}

/**
 * Root keys of everything a financial write can change. The back posts movements when a bill is
 * saved (PR #62), a card purchase creates several movements, an invoice payment settles several
 * installments and moves an account balance: guessing which numbers changed is not worth it.
 */
export const FINANCIAL_ROOT_KEYS = [
  'movements',
  'movement',
  'settlements',
  'balance',
  'dashboard',
  'fixed-bills',
  'fixed-bill',
  'installment-bills',
  'installment-bill',
  'accounts',
  'account',
  'account-balances',
  'account-balance',
  'account-statement',
  'transfers',
  'credit-cards',
  'card-limit',
  'card-invoices',
  'card-invoice',
  'invoice-payments',
  'card-purchases',
  'card-purchase',
  'envelopes',
  'forecast',
  'pay-cycle-summary',
  'income-occurrences',
] as const

/** Called in the onSuccess of EVERY mutation that writes money, dates or categories of a record. */
export function invalidateFinancial(queryClient: QueryClient): Promise<void> {
  return Promise.all(
    FINANCIAL_ROOT_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
  ).then(() => undefined)
}
