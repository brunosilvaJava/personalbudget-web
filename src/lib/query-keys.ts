import type {
  FinancialMovementQuery,
  FixedBillQuery,
  ISODate,
  InstallmentBillQuery,
  UUID,
  YearMonth,
} from '@/api/contracts'

/**
 * Whose data a query reads. Fixed in 'mine' until Phase 5 adds the couple's view ('group');
 * it is already part of every key so that change does not touch the screens.
 */
export type Scope = 'mine'
export const CURRENT_SCOPE: Scope = 'mine'

export const queryKeys = {
  health: ['health'] as const,
  movements: (filters: FinancialMovementQuery) => ['movements', CURRENT_SCOPE, filters] as const,
  balance: (initialDate: ISODate, endDate: ISODate) =>
    ['balance', CURRENT_SCOPE, initialDate, endDate] as const,
  dashboard: (month: YearMonth) => ['dashboard', CURRENT_SCOPE, month] as const,
  fixedBills: (filters: FixedBillQuery) => ['fixed-bills', CURRENT_SCOPE, filters] as const,
  fixedBill: (code: UUID) => ['fixed-bill', CURRENT_SCOPE, code] as const,
  installmentBills: (filters: InstallmentBillQuery) =>
    ['installment-bills', CURRENT_SCOPE, filters] as const,
  installmentBill: (code: UUID) => ['installment-bill', CURRENT_SCOPE, code] as const,
}

/**
 * Invalidated after ANY write: saving a fixed or installment bill can post movements on the
 * server (back-end PR #62), so movements, balance and dashboard may all have changed.
 */
export const AFTER_ANY_WRITE = [['movements'], ['balance'], ['dashboard']] as const
