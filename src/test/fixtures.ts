import type {
  AccountResponse,
  AccountTransferResponse,
  BudgetEnvelopeResponse,
  CashForecastResponse,
  CycleEnvelopesResponse,
  CategoryGroupResponse,
  CategoryResponse,
  CreditCardResponse,
  FinancialMovementResponse,
  FixedBillResponse,
  HolidayYearResponse,
  IncomeOccurrenceResponse,
  IncomeScheduleResponse,
  InstallmentBillResponse,
  Page,
  PayCycleAdjustmentResponse,
  PayCycleClosurePreviewResponse,
  PayCycleConfigResponse,
  PayCyclePendingResponse,
  PayCycleResponse,
  PayCycleSnapshotResponse,
  PayCycleSummaryResponse,
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

/** The cycles off, as a fresh database has them. */
export function payCycleConfig(
  overrides: Partial<PayCycleConfigResponse> = {},
): PayCycleConfigResponse {
  return {
    mode: 'CALENDAR_MONTH',
    anchor_schedule_code: null,
    activation_date: null,
    version: 0,
    pending: [],
    ...overrides,
  }
}

export function payCyclePending(
  overrides: Partial<PayCyclePendingResponse> = {},
): PayCyclePendingResponse {
  return {
    type: 'CALENDAR_NOT_REVIEWED',
    nominal_month: null,
    year: 2027,
    cycle_code: null,
    boundary_date: null,
    anchor_date: null,
    ...overrides,
  }
}

export function payCycleSummary(
  overrides: Partial<PayCycleSummaryResponse> = {},
): PayCycleSummaryResponse {
  return {
    cycle: payCycle(),
    recognized_revenue: 5000,
    recognized_expense: 1800,
    projected_revenue: 5000,
    projected_expense: 3200,
    projection_incomplete: false,
    categories: [
      {
        category_code: null,
        category_name: 'Salário',
        operation_type: 'CREDIT',
        recognized_amount: 5000,
        projected_amount: 5000,
      },
      {
        category_code: null,
        category_name: 'Mercado',
        operation_type: 'DEBIT',
        recognized_amount: 800,
        projected_amount: 1500,
      },
    ],
    pending: [],
    ...overrides,
  }
}

export function payCycleAdjustment(
  overrides: Partial<PayCycleAdjustmentResponse> = {},
): PayCycleAdjustmentResponse {
  return {
    code: code('adjust'),
    type: 'MANUAL_BOUNDARY',
    previous_cycle_code: null,
    next_cycle_code: null,
    old_boundary: '2026-12-04',
    new_boundary: '2026-12-03',
    justification: 'Salário caiu um dia antes',
    expected_previous_version: 1,
    expected_next_version: 1,
    expected_config_version: null,
    created_date: '2026-11-09T10:00:00',
    ...overrides,
  }
}

/** The first closure of the cycle: what a cycle with the payCycleSummary numbers would have frozen. */
export function payCycleSnapshot(
  overrides: Partial<PayCycleSnapshotResponse> = {},
): PayCycleSnapshotResponse {
  return {
    code: code('snap'),
    cycle_code: 'p0000001-0000-4000-8000-000000000001',
    snapshot_version: 1,
    cycle_version: 3,
    closed_at: '2026-11-06T17:30:00Z',
    recognized_revenue: 5000,
    recognized_expense: 3100,
    projected_revenue: 5000,
    projected_expense: 3100,
    categories: [
      {
        category_code: null,
        category_name: 'Salário',
        operation_type: 'CREDIT',
        recognized_amount: 5000,
        projected_amount: 5000,
      },
      {
        category_code: null,
        category_name: 'Mercado',
        operation_type: 'DEBIT',
        recognized_amount: 3100,
        projected_amount: 3100,
      },
    ],
    ...overrides,
  }
}

/** A cycle that can be closed: nothing blocks it. */
export function closurePreview(
  overrides: Partial<PayCycleClosurePreviewResponse> = {},
): PayCycleClosurePreviewResponse {
  return {
    summary: payCycleSummary(),
    expected_version: 2,
    can_close: true,
    blockers: [],
    late_movement_codes: [],
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

export function incomeSchedule(
  overrides: Partial<IncomeScheduleResponse> = {},
): IncomeScheduleResponse {
  return {
    code: code('is'),
    description: 'Salário',
    amount: 6850,
    category_code: null,
    rule_type: 'FIXED_DAY',
    rule_value: 5,
    business_week: 'MONDAY_TO_FRIDAY',
    non_business_day_policy: 'ANTICIPATE',
    start_month: '2026-01',
    end_month: null,
    anchor: false,
    status: 'ACTIVE',
    replaces_fixed_bill_code: null,
    ...overrides,
  }
}

export function occurrence(
  overrides: Partial<IncomeOccurrenceResponse> = {},
): IncomeOccurrenceResponse {
  return {
    nominal_month: '2026-11',
    state: 'PROJECTED',
    planned_date: '2026-11-05',
    amount: 6850,
    movement_code: null,
    pending_year: null,
    ...overrides,
  }
}

export function holidayYear(
  year: number,
  overrides: Partial<HolidayYearResponse> = {},
): HolidayYearResponse {
  return { year, reviewed: true, holidays: [], ...overrides }
}

/** An envelope with R$ 800 planned, R$ 300 paid and R$ 100 still to pay: R$ 400 free. */
export function envelope(overrides: Partial<BudgetEnvelopeResponse> = {}): BudgetEnvelopeResponse {
  return {
    code: code('e0000001'),
    cycle_code: 'p0000001-0000-4000-8000-000000000001',
    category_code: categories.mercado.code,
    category_name: 'Mercado',
    planned_amount: 800,
    recognized_amount: 300,
    committed_amount: 100,
    consumed_amount: 400,
    remaining_amount: 400,
    reserved_amount: 400,
    overrun_amount: 0,
    version: 1,
    ...overrides,
  }
}

/** The envelopes of a cycle; the totals are summed from the list unless overridden. */
export function cycleEnvelopes(
  list: BudgetEnvelopeResponse[],
  overrides: Partial<CycleEnvelopesResponse> = {},
): CycleEnvelopesResponse {
  const sum = (pick: (item: BudgetEnvelopeResponse) => number) =>
    list.reduce((total, item) => total + pick(item), 0)
  return {
    cycle_code: list[0]?.cycle_code ?? 'p0000001-0000-4000-8000-000000000001',
    envelopes: list,
    total_planned: sum((item) => item.planned_amount),
    total_consumed: sum((item) => item.consumed_amount),
    total_reserved: sum((item) => item.reserved_amount),
    total_overrun: sum((item) => item.overrun_amount),
    projection_incomplete: false,
    ...overrides,
  }
}

/**
 * A comfortable forecast on 2026-11-10 up to the end of the cycle:
 * 2.318,40 + 6.850 - 3.200 - 420 = 5.548,40 projected; minus 900 reserved and 300 of card after
 * the horizon = 4.348,40 free.
 */
export function cashForecast(overrides: Partial<CashForecastResponse> = {}): CashForecastResponse {
  return {
    today: '2026-11-10',
    until: '2026-12-03',
    include_late_income: false,
    cash_balance: 2318.4,
    expected_income: 6850,
    late_income: 0,
    obligations: 3200,
    card_invoices: 420,
    projected_cash: 5548.4,
    envelope_cycle_code: 'p0000001-0000-4000-8000-000000000001',
    envelope_reserve: 900,
    card_beyond_horizon: 300,
    free_after_reserves: 4348.4,
    lowest_projected_cash: 1200,
    lowest_projected_cash_date: '2026-11-20',
    first_negative_date: null,
    negative_cash_alert: false,
    insufficient_budget_alert: false,
    projection_incomplete: false,
    ...overrides,
  }
}
