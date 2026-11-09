import type {
  AccountResponse,
  AccountTransferResponse,
  CategoryGroupResponse,
  CategoryResponse,
  CreditCardResponse,
  FinancialMovementResponse,
  FixedBillResponse,
  InstallmentBillResponse,
  Page,
  PayCycleResponse,
} from '@/api/contracts'

/**
 * Builders of API answers for tests and screenshots. Only type imports from the app, so the
 * screenshot script can load this file too.
 */

let sequence = 0
/** A UUID-shaped code, unique per call. */
export function code(prefix = '0000'): string {
  sequence += 1
  return `${prefix.padEnd(8, '0').slice(0, 8)}-0000-4000-8000-${String(sequence).padStart(12, '0')}`
}

export const groups: CategoryGroupResponse[] = [
  { code: 'g0000001-0000-4000-8000-000000000001', name: 'Residência', display_order: 1 },
  { code: 'g0000002-0000-4000-8000-000000000002', name: 'Pessoal', display_order: 2 },
  { code: 'g0000007-0000-4000-8000-000000000007', name: 'Receitas', display_order: 7 },
]

function category(
  name: string,
  group: CategoryGroupResponse,
  overrides: Partial<CategoryResponse> = {},
): CategoryResponse {
  return {
    code:
      `c-${name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[^a-z]/g, '')}`.padEnd(8, '0') + '-0000-4000-8000-000000000000',
    name,
    operation_type: 'DEBIT',
    status: 'ACTIVE',
    group_code: group.code,
    group_name: group.name,
    ...overrides,
  }
}

export const categories = {
  mercado: category('Mercado', groups[0]!),
  energia: category('Energia', groups[0]!),
  padaria: category('Padaria', groups[1]!),
  gas: category('Gás', groups[0]!),
  academia: category('Academia', groups[1]!, { status: 'INACTIVE' }),
  salario: category('Salário', groups[2]!, { operation_type: 'CREDIT' }),
}

export const allCategories: CategoryResponse[] = Object.values(categories)

export function movement(
  overrides: Partial<FinancialMovementResponse> = {},
): FinancialMovementResponse {
  return {
    code: code('m'),
    operation_type: 'DEBIT',
    description: 'Mercado do mês',
    amount: 100,
    amount_paid: null,
    movement_date: '2026-11-10T09:00:00',
    due_date: '2026-11-10T09:00:00',
    status: 'PENDING',
    recurrence_bill_code: null,
    occurrence_date: null,
    category_code: null,
    competence_date: '2026-11-10',
    competence_overridden: false,
    card_purchase_code: null,
    card_invoice_code: null,
    installment_number: null,
    ...overrides,
  }
}

export function page<T>(
  content: T[],
  options: { page?: number; size?: number; total?: number } = {},
): Page<T> {
  const size = options.size ?? 20
  const pageNumber = options.page ?? 0
  const total = options.total ?? content.length
  const totalPages = Math.max(1, Math.ceil(total / size))
  return {
    content,
    page: pageNumber,
    size,
    total_elements: total,
    total_pages: totalPages,
    first: pageNumber === 0,
    last: pageNumber >= totalPages - 1,
  }
}

export function payCycle(overrides: Partial<PayCycleResponse> = {}): PayCycleResponse {
  return {
    code: 'p0000001-0000-4000-8000-000000000001',
    start_date: '2026-11-05',
    end_date_exclusive: '2026-12-04',
    last_day: '2026-12-03',
    total_days: 29,
    label: 'Nov/Dez',
    reference_month: '2026-11',
    kind: 'REGULAR',
    status: 'OPEN',
    anchor_schedule_code: null,
    start_adjusted: false,
    end_adjusted: false,
    version: 1,
    pending: [],
    ...overrides,
  }
}

export const accounts = {
  main: {
    code: 'a0000001-0000-4000-8000-000000000001',
    name: 'Conta principal',
    type: 'CHECKING',
    initial_balance: 1500,
    initial_balance_date: '2026-01-01',
    status: 'ACTIVE',
    default: true,
  } satisfies AccountResponse,
  wallet: {
    code: 'a0000002-0000-4000-8000-000000000002',
    name: 'Carteira',
    type: 'CASH',
    initial_balance: 80,
    initial_balance_date: '2026-11-01',
    status: 'ACTIVE',
    default: false,
  } satisfies AccountResponse,
  old: {
    code: 'a0000003-0000-4000-8000-000000000003',
    name: 'Banco antigo',
    type: 'SAVINGS',
    initial_balance: 0,
    initial_balance_date: '2025-01-01',
    status: 'INACTIVE',
    default: false,
  } satisfies AccountResponse,
}

export function transfer(
  overrides: Partial<AccountTransferResponse> = {},
): AccountTransferResponse {
  return {
    code: code('t'),
    from_account_code: accounts.main.code,
    to_account_code: accounts.wallet.code,
    amount: 200,
    effective_date: '2026-11-05',
    description: 'Dinheiro vivo',
    reversed_at: null,
    version: 0,
    ...overrides,
  }
}

export const cards = {
  nubank: {
    code: 'k0000001-0000-4000-8000-000000000001',
    name: 'Nubank',
    closing_day: 3,
    due_day: 10,
    credit_limit: 5000,
    default_account_code: null,
    status: 'ACTIVE',
  } satisfies CreditCardResponse,
}

export function fixedBill(overrides: Partial<FixedBillResponse> = {}): FixedBillResponse {
  return {
    code: code('fb'),
    operation_type: 'DEBIT',
    description: 'Aluguel',
    amount: 1500,
    recurrence_type: 'MONTHLY',
    days: [5],
    flg_leap_year: false,
    reference_year: null,
    status: 'ACTIVE',
    start_date: '2026-01-05',
    end_date: null,
    next_due_date: '2026-12-05',
    category_code: null,
    ...overrides,
  }
}

export function installmentBill(
  overrides: Partial<InstallmentBillResponse> = {},
): InstallmentBillResponse {
  return {
    code: code('ib'),
    operation_type: 'DEBIT',
    description: 'Carnê da loja',
    amount: 150,
    status: 'PENDING',
    purchase_date: '2026-10-15',
    installment_total: 10,
    installment_count: 2,
    next_installment_date: '2026-12-15',
    category_code: null,
    ...overrides,
  }
}
