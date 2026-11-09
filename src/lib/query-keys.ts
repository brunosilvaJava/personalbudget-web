import type { QueryClient } from '@tanstack/react-query'

import type {
  AccountStatus,
  CategoryStatus,
  CreditCardStatus,
  FinancialMovementQuery,
  FixedBillQuery,
  ISODate,
  IncomeScheduleStatus,
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

  fixedBills: (filters: Omit<FixedBillQuery, 'page' | 'size'>) =>
    ['fixed-bills', CURRENT_SCOPE, filters] as const,
  fixedBill: (code: UUID) => ['fixed-bill', CURRENT_SCOPE, code] as const,
  installmentBills: (filters: Omit<InstallmentBillQuery, 'page' | 'size'>) =>
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

  incomeSchedules: (statuses: readonly IncomeScheduleStatus[]) =>
    ['income-schedules', statuses] as const,
  incomeSchedule: (code: UUID) => ['income-schedule', code] as const,
  incomeOccurrences: (code: UUID, from: YearMonth, to: YearMonth) =>
    ['income-occurrences', code, from, to] as const,
  holidayYears: ['holidays', 'years'] as const,
  holidayYear: (year: number) => ['holidays', 'year', year] as const,

  currentPayCycle: ['pay-cycles', 'current'] as const,
  payCycleByDate: (date: ISODate) => ['pay-cycles', 'date', date] as const,
  payCycle: (code: UUID) => ['pay-cycles', 'code', code] as const,
  payCycles: (includeCancelled: boolean) => ['pay-cycles', 'list', includeCancelled] as const,
  payCycleConfig: ['pay-cycle-config'] as const,
  payCycleSummary: (code: UUID) => ['pay-cycle-summary', code] as const,
  payCycleAdjustments: (code: UUID) => ['pay-cycle-adjustments', code] as const,

  envelopes: (cycleCode: UUID) => ['envelopes', cycleCode] as const,
  /** `until` null is the back's own horizon (the end of the current cycle, or of the month) */
  forecast: (until: ISODate | null, includeLateIncome: boolean) =>
    ['forecast', until, includeLateIncome] as const,
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

/**
 * Root keys that an income schedule or a holiday calendar write can change, besides the financial
 * group: the schedules, the calendar and the pay cycles (a reviewed year refreshes the boundaries).
 */
const INCOME_ROOT_KEYS = [
  'income-schedules',
  'income-schedule',
  'holidays',
  'pay-cycles',
  'pay-cycle-config',
  'pay-cycle-adjustments',
] as const

/** Called in the onSuccess of every write to an income schedule or to the holiday calendar. */
export function invalidateIncome(queryClient: QueryClient): Promise<void> {
  return Promise.all([
    invalidateFinancial(queryClient),
    ...INCOME_ROOT_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
  ]).then(() => undefined)
}

/**
 * Called in the onSuccess of every write to the cycles (activate, deactivate, adjust a boundary,
 * change the anchor). The boundaries decide the default period of the lists and every cycle report,
 * and a changed anchor changes the schedules: it is the income group and the financial group.
 */
export const invalidatePayCycles = invalidateIncome
