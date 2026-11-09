/**
 * PersonalBudget API contracts: the only place API types come from.
 *
 * Source: back-end `master` at fb3d147 (2026-11-08), which has everything through E11: E8a, E8b, E9a to
 * E9d (#94 to #96), E10 (#97) and E11 (#98), all merged. Earlier stacks, up to #90: the recurrence
 * stack #58 to #63, the contract and error stack #64 to #66, the categories #67 to #69, the
 * competence date (#72), the income calendar (#73), the income schedules (#74), the pay cycles
 * (#75, #76), the backend adjustments (#79), the anchor transition and the holiday preview (#80, #81),
 * the category seed (#83), the cycle summary (#84), the cycle closure (#85 to #87) and the partial
 * payments (#89, #90). Read from the controllers and DTOs, not from the OpenAPI docs.
 *
 * ADDED since the previous version (all additive, no breaking change): accounts and the initial balance
 * (E8a), transfers (E8b), credit cards (E9a), card purchases and invoices (E9b), invoice payment (E9c),
 * card links on movements (E9d), budget envelopes (E10) and the cash forecast (E11). Settlements gained
 * account_code; FinancialMovementResponse gained card_purchase_code, card_invoice_code, installment_number.
 *
 * BREAKING CHANGES since the 2026-11-03 version of this file:
 *  - POST/PATCH /financial_movement no longer accept amount_paid, pay_date or status (400). Payments
 *    are settlements (see /financial_movement/{code}/settlements). The status is derived by the server.
 *  - FinancialMovementResponse no longer has pay_date.
 *  - POST /holiday_calendar/{year}/preview answers an object, not an array.
 *
 * Rechecked on 2026-11-09 against the controllers and DTO records of fb3d147, field by field (script
 * in the Phase 1a PR): every request and response matches. The query params and sort fields of the
 * movement, fixed bill and installment bill lists are unchanged since #69 (#72 added none). The PATCH
 * bodies of fixed and installment bills also have a `code`, filled from the path: never send it.
 *
 * Everything is snake_case: request and response bodies, Paged* wrappers and query params.
 * The goal is to generate these types from /v3/api-docs with openapi-typescript and diff them in CI.
 *
 * Out of the contract: `/util/*` exists only with the Spring profile `local` and is hidden from
 * the OpenAPI docs.
 */

// ───────────────────────── Primitives ─────────────────────────

export type UUID = string
/** LocalDate, e.g. "2026-11-10". Parse with parseApiDate (lib/dates.ts), never new Date(). */
export type ISODate = string
/** LocalDateTime WITHOUT offset, e.g. "2026-11-10T15:30:00" (Brasília local time) */
export type ISODateTime = string
/** YearMonth, e.g. "2026-11" */
export type YearMonth = string
/** BigDecimal serialized as a JSON number (max 8 integer digits, 2 decimals) */
export type Money = number
/** Instant in UTC, e.g. "2026-11-02T21:35:00Z" (pay cycle adjustment history entries and snapshots) */
export type ISOInstant = string

// ───────────────────────── Enums ─────────────────────────

export const OPERATION_TYPES = ['CREDIT', 'DEBIT'] as const
export type OperationType = (typeof OPERATION_TYPES)[number]

/**
 * DERIVED by the server, never sent by the client. PAID_OUT only when the active settlements cover the
 * whole amount. The residual stays PENDING, or LATE when the due date is before today (the server marks
 * it on create, on edit and every midnight).
 */
export const FINANCIAL_MOVEMENT_STATUSES = ['PENDING', 'LATE', 'PAID_OUT'] as const
export type FinancialMovementStatus = (typeof FINANCIAL_MOVEMENT_STATUSES)[number]

export const RECURRENCE_TYPES = ['WEEKLY', 'MONTHLY', 'YEARLY'] as const
export type RecurrenceType = (typeof RECURRENCE_TYPES)[number]

export const FIXED_BILL_STATUSES = ['ACTIVE', 'INACTIVE'] as const
export type FixedBillStatus = (typeof FIXED_BILL_STATUSES)[number]

export const INSTALLMENT_BILL_STATUSES = ['PENDING', 'DONE'] as const
export type InstallmentBillStatus = (typeof INSTALLMENT_BILL_STATUSES)[number]

/** Account type (E8a). */
export const ACCOUNT_TYPES = ['CHECKING', 'CASH', 'SAVINGS', 'OTHER'] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

/** The default account cannot be inactivated (409). Inactive accounts keep their history and balance. */
export const ACCOUNT_STATUSES = ['ACTIVE', 'INACTIVE'] as const
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number]

export const CREDIT_CARD_STATUSES = ['ACTIVE', 'INACTIVE'] as const
export type CreditCardStatus = (typeof CREDIT_CARD_STATUSES)[number]

/** Derived, never stored: OPEN before closing_date, CLOSED from it on, PAID when every installment is paid. */
export const CARD_INVOICE_STATES = ['OPEN', 'CLOSED', 'PAID'] as const
export type CardInvoiceState = (typeof CARD_INVOICE_STATES)[number]

/** Category status (#67). Inactive categories leave the pick lists but keep their history. */
export const CATEGORY_STATUSES = ['ACTIVE', 'INACTIVE'] as const
export type CategoryStatus = (typeof CATEGORY_STATUSES)[number]

/** Income schedule rule (#74). */
export const DATE_RULE_TYPES = ['FIXED_DAY', 'NTH_BUSINESS_DAY'] as const
export type DateRuleType = (typeof DATE_RULE_TYPES)[number]

/** Which weekdays are business days. Sunday never is; Saturday is a choice of each schedule. */
export const BUSINESS_WEEKS = ['MONDAY_TO_FRIDAY', 'MONDAY_TO_SATURDAY'] as const
export type BusinessWeek = (typeof BUSINESS_WEEKS)[number]

/** What a FIXED_DAY rule does on a day that is not a business day. */
export const NON_BUSINESS_DAY_POLICIES = ['ANTICIPATE', 'POSTPONE', 'KEEP'] as const
export type NonBusinessDayPolicy = (typeof NON_BUSINESS_DAY_POLICIES)[number]

export const INCOME_SCHEDULE_STATUSES = ['ACTIVE', 'INACTIVE'] as const
export type IncomeScheduleStatus = (typeof INCOME_SCHEDULE_STATUSES)[number]

/**
 * MATERIALIZED: a movement exists; date and amount are frozen. PROJECTED: not generated yet,
 * calculated from the rule and the calendar. CALENDAR_NOT_REVIEWED: depends on a calendar year that
 * was not reviewed (no date is assumed). BUSINESS_DAY_NOT_FOUND: the month has no such business day.
 */
export const INCOME_OCCURRENCE_STATES = [
  'MATERIALIZED',
  'PROJECTED',
  'CALENDAR_NOT_REVIEWED',
  'BUSINESS_DAY_NOT_FOUND',
] as const
export type IncomeOccurrenceState = (typeof INCOME_OCCURRENCE_STATES)[number]

/** CALENDAR_MONTH: reports follow the calendar month. PAY_CYCLE: the anchor schedule opens the cycles. */
export const PAY_CYCLE_MODES = ['CALENDAR_MONTH', 'PAY_CYCLE'] as const
export type PayCycleMode = (typeof PAY_CYCLE_MODES)[number]

export const PAY_CYCLE_KINDS = ['REGULAR', 'TRANSITION'] as const
export type PayCycleKind = (typeof PAY_CYCLE_KINDS)[number]

/**
 * Derived from the dates and today, except CLOSED (stored, #85). CANCELLED only shows with
 * include_cancelled. A closed cycle stays in the chain.
 */
export const PAY_CYCLE_STATUSES = [
  'PLANNED',
  'OPEN',
  'PENDING_CLOSE',
  'CLOSED',
  'CANCELLED',
] as const
export type PayCycleStatus = (typeof PAY_CYCLE_STATUSES)[number]

export const PAY_CYCLE_PENDING_TYPES = [
  'CALENDAR_NOT_REVIEWED',
  'BUSINESS_DAY_NOT_FOUND',
  'ANCHOR_SCHEDULE_ENDS',
  'BOUNDARY_DIVERGES_FROM_ANCHOR',
  'NO_CURRENT_CYCLE',
] as const
export type PayCyclePendingType = (typeof PAY_CYCLE_PENDING_TYPES)[number]

/** The back writes MANUAL_BOUNDARY, ANCHOR_TRANSITION (#80) and DEACTIVATION; ACTIVATION is not written yet. */
export const PAY_CYCLE_ADJUSTMENT_TYPES = [
  'MANUAL_BOUNDARY',
  'ANCHOR_TRANSITION',
  'ACTIVATION',
  'DEACTIVATION',
] as const
export type PayCycleAdjustmentType = (typeof PAY_CYCLE_ADJUSTMENT_TYPES)[number]

/** Shape of the transition cycle when the anchor changes (#80). */
export const PAY_CYCLE_TRANSITION_SHAPES = ['SHORT', 'LONG'] as const
export type PayCycleTransitionShape = (typeof PAY_CYCLE_TRANSITION_SHAPES)[number]

/** Why a cycle cannot be closed yet (#87). The code can return more types: treat the list as open. */
export const PAY_CYCLE_CLOSURE_BLOCKERS = [
  'PROJECTION_INCOMPLETE',
  'LATE_MOVEMENTS',
  'OVERDUE_PENDING_MOVEMENTS',
  'CYCLE_NOT_ENDED',
] as const
export type PayCycleClosureBlocker = (typeof PAY_CYCLE_CLOSURE_BLOCKERS)[number]

/** Valid `days` range per recurrence type (RecurrenceType.initialDay..endDay). */
export const RECURRENCE_DAY_RANGE: Record<RecurrenceType, { min: number; max: number }> = {
  WEEKLY: { min: 1, max: 7 },
  MONTHLY: { min: 1, max: 31 },
  YEARLY: { min: 1, max: 365 },
}

// ───────────────────────── Shared ─────────────────────────

/** Paged* wrappers. page is 0-indexed. */
export interface Page<T> {
  content: T[]
  page: number
  size: number
  total_elements: number
  total_pages: number
  first: boolean
  last: boolean
}

export type SortDirection = 'ASC' | 'DESC'

/**
 * 400: bean validation, invalid enum ("valores permitidos: [...]"), missing or mismatched param,
 * InvalidFieldsException (including category_code not found, inactive or of another operation_type,
 * a summary period with end_date before start_date or longer than 366 days, a competence_date sent
 * together with restore_automatic_competence, a pay cycle date or justification that is invalid,
 * and amount_paid, pay_date or status sent on a movement), and an unknown sort_by.
 */
export interface ValidationErrorResponse {
  message: string
  /** key = request field or query param, in snake_case → message */
  validations: Record<string, string>
}

/**
 * 404 ("Registro não encontrado"), 409 and 500 ("Erro interno no servidor").
 *
 * 409 has two sources: a ConflictException, whose message is written for the user (a stale version
 * of a pay cycle or of the configuration, pay cycles off, a cycle that cannot be adjusted, a payment
 * above the remaining amount, a settlement already reversed, a protected change to a movement of a
 * closed cycle, a protected change to the anchor schedule while the cycles are on, a card purchase above
 * the available limit, an invoice already paid or already reversed, a settlement of a card installment,
 * an envelope that already exists for the category, the default account inactivated), and an optimistic
 * lock failure anywhere in the API ("O registro foi alterado por outra operação; recarregue e tente
 * novamente"). On a 409, nothing was written: reload and try again.
 */
export interface ErrorResponse {
  message: string
}

// ───────────────────────── /financial_movement ─────────────────────────

/**
 * Creates an UNPAID movement. amount_paid, pay_date and status are NOT accepted (400): record payments
 * with POST /financial_movement/{code}/settlements. The status is derived by the server.
 */
export interface FinancialMovementRequest {
  operation_type: OperationType
  /** optional client-supplied identifier */
  code?: UUID
  /** 4..50 chars, not blank */
  description: string
  /** > 0, positive for both CREDIT and DEBIT (the back stores DEBIT negative) */
  amount: Money
  movement_date: ISODateTime
  due_date: ISODateTime
  /** optional (#68). Must exist, be ACTIVE and have the same operation_type, or 400 on category_code. */
  category_code?: UUID | null
  /**
   * optional (#72). Budget competence: the date the obligation or revenue belongs to, independent of
   * due and pay dates. Informed = manual, never recalculated. Omitted = automatic (the date of
   * movement_date).
   */
  competence_date?: ISODate | null
}

/**
 * PATCH: every field optional. `occurrence_date` is not editable. amount_paid, pay_date and status are
 * NOT accepted (400). `category_code` replaces the category; it cannot be removed (null means "do not
 * change"). On a movement of a CLOSED cycle, changing amount, category, operation_type or competence is
 * a 409.
 */
export interface FinancialMovementUpdateRequest {
  operation_type?: OperationType
  /** 4..50 chars */
  description?: string
  amount?: Money
  movement_date?: ISODateTime
  due_date?: ISODateTime
  category_code?: UUID
  /** sets the competence by hand; it stops following the automatic rule. Omitted keeps the current one. */
  competence_date?: ISODate
  /**
   * true goes back to the automatic competence (the movement date, or the occurrence date of a
   * recurring movement). Omitted or false keeps the current mode. Sending it together with
   * competence_date is a 400.
   */
  restore_automatic_competence?: boolean
}

export interface FinancialMovementResponse {
  code: UUID
  operation_type: OperationType
  description: string
  /** DEBIT normalized to positive by the response; the sign comes from operation_type */
  amount: Money
  /** aggregate of the ACTIVE settlements (reversed ones do not count); positive */
  amount_paid: Money | null
  movement_date: ISODateTime
  due_date: ISODateTime
  /** derived: PAID_OUT only when fully settled; the residual is PENDING or LATE */
  status: FinancialMovementStatus
  /** set when generated by a FixedBill, InstallmentBill or IncomeSchedule */
  recurrence_bill_code: UUID | null
  /** scheduled occurrence date of the recurrence; immutable (unlike due_date) */
  occurrence_date: ISODate | null
  /** null when the movement has no category; copied from the bill when generated by it */
  category_code: UUID | null
  /**
   * (#72) Budget competence date. Null only for legacy recurring movements that the V5 migration
   * left without occurrence_date and that still wait for reconciliation.
   */
  competence_date: ISODate | null
  /** true when the client informed the competence; it is not recalculated automatically */
  competence_overridden: boolean
  /** (E9d) set only on an installment of a card purchase; all three are null or all three are set */
  card_purchase_code: UUID | null
  card_invoice_code: UUID | null
  installment_number: number | null
}

export const FINANCIAL_MOVEMENT_SORT_FIELDS = [
  'description',
  'amount',
  'operation_type',
  'status',
  'movement_date',
  'due_date',
] as const
export type FinancialMovementSortField = (typeof FINANCIAL_MOVEMENT_SORT_FIELDS)[number]

export interface FinancialMovementQuery {
  /** contains (LIKE %description%); case follows the database collation */
  description?: string
  /** repeated param: operation_type=DEBIT&operation_type=CREDIT */
  operation_type?: OperationType[]
  /**
   * the derived status; status=LATE lists the overdue ones, paginated by the server. PENDING does NOT
   * include LATE: "to pay" is status=PENDING&status=LATE. Omitted = every status.
   */
  status?: FinancialMovementStatus[]
  /** repeated param (#68): category_code=...&category_code=... */
  category_code?: UUID[]
  /** true returns only movements without category; ignored when category_code is sent */
  without_category?: boolean // default false
  /** REQUIRED, filters movement_date */
  start_date: ISODate
  /** REQUIRED, inclusive */
  end_date: ISODate
  page?: number // default 0
  size?: number // default 10
  sort_by?: FinancialMovementSortField // default movement_date
  sort_direction?: SortDirection // default DESC
}

// ───────────────────────── /financial_movement/{code}/settlements (#89, #90) ─────────────────────────

/**
 * A payment (or receipt) is a settlement: an amount and the date it took effect. A movement can have
 * several (partial payments). The cash reports use each effective_date. The sum of the ACTIVE ones
 * cannot exceed the movement amount (409).
 */
export interface MovementSettlementRequest {
  /** > 0, up to 2 decimals, positive for both CREDIT and DEBIT */
  amount: Money
  effective_date: ISODate
  /** (E8a) ACTIVE account the money came from or went to; omitted = the default account */
  account_code?: UUID
}

export interface MovementSettlementResponse {
  code: UUID
  movement_code: UUID
  /** positive */
  amount: Money
  effective_date: ISODate
  /** null while active; a reversed settlement stays in the history */
  reversed_at: ISODateTime | null
  version: number
  /** (E8a) */
  account_code: UUID
}

/**
 * (E9c) 409 on a settlement of a CARD INSTALLMENT (card_purchase_code set): the installments are paid by
 * paying the invoice. A settlement generated by an invoice payment cannot be reversed alone (409):
 * reverse the invoice payment. 400 on account_code that is unknown or INACTIVE, or on an effective_date
 * before the account's initial_balance_date.
 */

// ───────────────────────── /fixed_bill ─────────────────────────

export interface FixedBillRequest {
  operation_type: OperationType
  /** 3..50 chars */
  description: string
  /** > 0 */
  amount: Money
  recurrence_type: RecurrenceType
  /** required; range depends on recurrence_type (see RECURRENCE_DAY_RANGE) */
  days: number[]
  flg_leap_year?: boolean // default false
  /** for YEARLY */
  reference_year?: number | null
  /** send it explicitly (bug E: do not rely on the server default) */
  start_date?: ISODate | null
  end_date?: ISODate | null
  /** optional (#68). Same rules as on movements. */
  category_code?: UUID | null
}

/**
 * PATCH. Every field optional EXCEPT `description` (@NotBlank): always send it, even when
 * unchanged. There is no flg_leap_year here.
 */
export interface FixedBillUpdateRequest {
  description: string
  operation_type?: OperationType
  amount?: Money
  recurrence_type?: RecurrenceType
  days?: number[]
  reference_year?: number
  status?: FixedBillStatus
  start_date?: ISODate
  end_date?: ISODate
  category_code?: UUID
}

export interface FixedBillResponse {
  code: UUID
  operation_type: OperationType
  description: string
  /** NOT normalized by the response: use signedAmount, never the sign sent */
  amount: Money
  recurrence_type: RecurrenceType
  days: number[]
  flg_leap_year: boolean
  reference_year: number | null
  status: FixedBillStatus
  start_date: ISODate | null
  end_date: ISODate | null
  /**
   * Next occurrence NOT yet posted; null once the bill is concluded. If today's occurrence
   * was posted on save, this already points to the following one.
   */
  next_due_date: ISODate | null
  category_code: UUID | null
}

export const FIXED_BILL_SORT_FIELDS = [
  'description',
  'amount',
  'operation_type',
  'status',
  'recurrence_type',
  'start_date',
  'next_due_date',
  'end_date',
] as const
export type FixedBillSortField = (typeof FIXED_BILL_SORT_FIELDS)[number]

export interface FixedBillQuery {
  description?: string
  operation_type?: OperationType[]
  status?: FixedBillStatus[]
  recurrence_type?: RecurrenceType[]
  page?: number // default 0
  size?: number // default 10
  sort_by?: FixedBillSortField // default description
  sort_direction?: SortDirection // default ASC
}

// ───────────────────────── /installment_bill ─────────────────────────

export interface InstallmentBillRequest {
  operation_type?: OperationType
  /** 4..50 chars, not blank */
  description: string
  /** value of EACH installment (not the purchase total); > 0 */
  amount: Money
  /** 30+ days ago → the installments already due are posted on save */
  purchase_date?: ISODate
  /** >= 1 */
  installment_total: number
  /** optional (#68). Same rules as on movements. */
  category_code?: UUID | null
}

/**
 * PATCH. `description` is @NotBlank: always send it. A PATCH can post the installments that fall due
 * (same transaction). purchase_date only reschedules the next installment while none was posted yet.
 * installment_total below installment_count is a 400; equal to it concludes the bill.
 */
export interface InstallmentBillUpdateRequest {
  description: string
  operation_type?: OperationType
  amount?: Money
  purchase_date?: ISODate
  installment_total?: number
  category_code?: UUID
}

export interface InstallmentBillResponse {
  code: UUID
  operation_type: OperationType
  description: string
  /** value of each installment; DEBIT normalized to positive */
  amount: Money
  status: InstallmentBillStatus
  purchase_date: ISODate | null
  installment_total: number
  /** (#79) installments already posted, starting at 0 */
  installment_count: number
  /** (#79) next installment not posted yet; null once the bill is concluded */
  next_installment_date: ISODate | null
  category_code: UUID | null
}

export const INSTALLMENT_BILL_SORT_FIELDS = [
  'description',
  'amount',
  'operation_type',
  'status',
  'purchase_date',
  'installment_total',
  'installment_count',
  'next_installment_date',
  'last_installment_date',
] as const
export type InstallmentBillSortField = (typeof INSTALLMENT_BILL_SORT_FIELDS)[number]

export interface InstallmentBillQuery {
  description?: string
  operation_type?: OperationType[]
  status?: InstallmentBillStatus[]
  page?: number // default 0
  size?: number // default 10
  sort_by?: InstallmentBillSortField // default purchase_date
  sort_direction?: SortDirection // default DESC
}

// ───────────────────────── /category_group (#67, #79) ─────────────────────────

/**
 * Seven groups: Residência, Pessoal, Instrução, Moto, Investimento and Outros (V6, for expenses) and
 * Receitas (V13, for credit categories). Groups have no operation_type: the category does.
 */
export interface CategoryGroupResponse {
  code: UUID
  name: string
  /** ascending order of the groups; the listing is sorted by it */
  display_order: number
}

// ───────────────────────── /category (#67, #83) ─────────────────────────

export interface CategoryRequest {
  /** 3..50 chars after trim; unique per operation_type (400 on name) */
  name: string
  operation_type: OperationType
  /** must exist (400 on group_code) */
  group_code: UUID
}

/** PATCH. Rename and/or move to another group; the operation_type cannot change. */
export interface CategoryUpdateRequest {
  name?: string
  group_code?: UUID
}

export interface CategoryResponse {
  code: UUID
  name: string
  operation_type: OperationType
  status: CategoryStatus
  group_code: UUID
  group_name: string
}

/**
 * GET /category without `status` returns only ACTIVE. GET /category/{code} returns INACTIVE
 * too, so history keeps its names. There is no DELETE: inactivate instead. 28 default categories are
 * seeded by V15 (editable).
 */
export interface CategoryQuery {
  operation_type?: OperationType
  /** repeated param */
  status?: CategoryStatus[]
  group_code?: UUID
}

// ───────────────────────── /category_summary (#69) ─────────────────────────

/**
 * GET /category_summary?start_date&end_date&operation_type
 * operation_type defaults to DEBIT. Period: end_date >= start_date and at most 366 days (400).
 *
 * This is a CASH report, like /balance/daily: it does not use competence_date nor pay cycles. Since
 * #90 it uses each settlement date. total: what was PAID in the period. projected_total: paid plus
 * the residual of PENDING/LATE and the bills' occurrences not posted yet. Debits are negative; percent
 * and projected_percent are positive shares of the absolute total (0 when the total is zero).
 *
 * Groups come in display_order. The "Sem categoria" row (movements without category) is its
 * own last group, with code, display_order and status null.
 */
export interface CategorySummaryLineResponse {
  /** null for "Sem categoria" */
  code: UUID | null
  name: string
  /** null for "Sem categoria". INACTIVE categories still appear, with their history. */
  status: CategoryStatus | null
  total: Money
  projected_total: Money
  percent: number
  projected_percent: number
}

export interface CategorySummaryGroupResponse {
  /** null for "Sem categoria" */
  code: UUID | null
  name: string
  /** null for "Sem categoria" */
  display_order: number | null
  total: Money
  projected_total: Money
  percent: number
  projected_percent: number
  /** sorted by projected_total, largest absolute value first; ties by name */
  categories: CategorySummaryLineResponse[]
}

export interface CategorySummaryResponse {
  start_date: ISODate
  end_date: ISODate
  operation_type: OperationType
  total: Money
  projected_total: Money
  groups: CategorySummaryGroupResponse[]
}

export interface CategorySummaryQuery {
  start_date: ISODate
  end_date: ISODate
  /** default DEBIT */
  operation_type?: OperationType
}

// ───────────────────────── /account (E8a) ─────────────────────────

/**
 * Accounts and wallets. The initial balance is NOT income. There is always exactly one default
 * account ("Conta principal" is created by the migration); settlements without account_code go to it.
 */
export interface AccountRequest {
  /** 3..50 chars, unique */
  name: string
  type: AccountType
  /** up to 10 integer digits and 2 decimals; defaults to 0 */
  initial_balance?: Money
  /** the date the initial balance refers to; defaults to today */
  initial_balance_date?: ISODate
}

/**
 * PATCH: every field optional. `default: true` makes this account the default one (false is a 400:
 * pick another account as the default instead). initial_balance_date cannot move past the earliest
 * active settlement or transfer of the account (400).
 */
export interface AccountUpdateRequest {
  name?: string
  type?: AccountType
  initial_balance?: Money
  initial_balance_date?: ISODate
  default?: boolean
}

export interface AccountResponse {
  code: UUID
  name: string
  type: AccountType
  initial_balance: Money
  initial_balance_date: ISODate
  status: AccountStatus
  /** the field is literally called "default" */
  default: boolean
}

/** GET /account: a plain array. Without `status`, only ACTIVE. */
export interface AccountQuery {
  /** repeated param */
  status?: AccountStatus[]
}

/**
 * GET /account/{code}/balance?date (date defaults to today; a date before initial_balance_date gives
 * zero). balance = initial_balance + settlements_total + transfers_total, from initial_balance_date
 * through the date. settlements_total: ACTIVE settlements of the account (credits positive, debits
 * negative). transfers_total: incoming minus outgoing ACTIVE transfers.
 */
export interface AccountBalanceResponse {
  account_code: UUID
  date: ISODate
  initial_balance: Money
  settlements_total: Money
  transfers_total: Money
  balance: Money
}

/**
 * GET /account/balance?date: every account (ACTIVE and INACTIVE, the default one first) and the total.
 * Transfers cancel out in the total.
 */
export interface AccountsBalanceResponse {
  date: ISODate
  accounts: AccountBalanceResponse[]
  total: Money
}

// ───────────────────────── /account_transfer (E8b) ─────────────────────────

/**
 * Money moved between two accounts. It is NOT a movement: neutral for consumption, it never shows in
 * /balance/daily, /dashboard, /category_summary nor in the cycles; it only changes the two balances.
 * 400: same account on both sides, an INACTIVE account, effective_date before the initial_balance_date
 * of either account.
 */
export interface AccountTransferRequest {
  from_account_code: UUID
  to_account_code: UUID
  /** > 0, up to 8 integer digits and 2 decimals */
  amount: Money
  effective_date: ISODate
  /** up to 100 chars */
  description?: string
}

export interface AccountTransferResponse {
  code: UUID
  from_account_code: UUID
  to_account_code: UUID
  amount: Money
  effective_date: ISODate
  description: string | null
  /** null while active; a reversed transfer stays in the history */
  reversed_at: ISODateTime | null
  version: number
}

/**
 * GET /account_transfer?start_date&end_date[&account_code]. Both dates required and inclusive, at most
 * 366 days (400). Reversed ones included. A plain array, not paged.
 */
export interface AccountTransferQuery {
  start_date: ISODate
  end_date: ISODate
  /** transfers where this account is the origin or the destination */
  account_code?: UUID
}

// ───────────────────────── /credit_card (E9a, E9b) ─────────────────────────

export interface CreditCardRequest {
  /** 3..50 chars, unique */
  name: string
  /** 1..31; a short month uses its last day */
  closing_day: number
  /** 1..31 */
  due_day: number
  /** > 0, up to 10 integer digits and 2 decimals; optional (no limit control without it) */
  credit_limit?: Money
  /** ACTIVE account that pays the invoices by default */
  default_account_code?: UUID
}

/**
 * PATCH: every field optional. The limit and the default account can be changed but not cleared yet.
 * New closing and due days only apply to FUTURE purchases; existing invoices keep their dates.
 */
export interface CreditCardUpdateRequest {
  name?: string
  closing_day?: number
  due_day?: number
  credit_limit?: Money
  default_account_code?: UUID
}

export interface CreditCardResponse {
  code: UUID
  name: string
  closing_day: number
  due_day: number
  credit_limit: Money | null
  default_account_code: UUID | null
  status: CreditCardStatus
}

/** GET /credit_card: a plain array. Without `status`, only ACTIVE. */
export interface CreditCardQuery {
  status?: CreditCardStatus[]
}

/**
 * GET /credit_card/{code}/limit. used = installments of the card not paid yet, future ones included.
 * available = credit_limit - used. credit_limit and available are null when the card has no limit.
 */
export interface CreditCardLimitResponse {
  card_code: UUID
  credit_limit: Money | null
  used: Money
  available: Money | null
}

// ───────────────────────── /card_purchase (E9b) ─────────────────────────

/**
 * A card purchase. Every installment becomes a DEBIT FinancialMovement (see card_purchase_code on
 * FinancialMovementResponse) whose due_date and competence_date are the due date of the invoice it
 * falls on; the purchase itself never moves cash, the payment of the invoice does.
 * 400: card not ACTIVE, category not an ACTIVE DEBIT. 409: total above the available limit (nothing is
 * written); an installment that would fall on an invoice already paid.
 */
export interface CardPurchaseRequest {
  card_code: UUID
  /** up to 100 chars, not blank */
  description: string
  purchase_date: ISODate
  /** 1..60 */
  installments: number
  /** the value of EACH installment (not the purchase total); > 0, up to 8 integer digits */
  installment_amount: Money
  category_code?: UUID | null
}

/**
 * PATCH: every field optional. The card cannot change. purchase_date, installments and
 * installment_amount are only accepted while no installment has a payment (409 otherwise).
 */
export interface CardPurchaseUpdateRequest {
  description?: string
  purchase_date?: ISODate
  installments?: number
  installment_amount?: Money
  category_code?: UUID
}

/** One installment of a purchase, as seen from the purchase or from the invoice. */
export interface CardInstallmentResponse {
  /** the FinancialMovement of the installment */
  movement_code: UUID
  purchase_code: UUID
  /** 1-based */
  installment_number: number
  installment_count: number
  invoice_code: UUID
  invoice_reference_month: YearMonth
  /** e.g. "Geladeira (1/3)" */
  description: string
  amount: Money
  amount_paid: Money | null
  /** the due date of the invoice */
  due_date: ISODate
  competence_date: ISODate
  status: FinancialMovementStatus
}

export interface CardPurchaseResponse {
  code: UUID
  card_code: UUID
  description: string
  purchase_date: ISODate
  installments: number
  installment_amount: Money
  /** installments x installment_amount */
  total_amount: Money
  category_code: UUID | null
  installment_list: CardInstallmentResponse[]
}

/**
 * GET /card_purchase?start_date&end_date[&card_code]: filters purchase_date, both required and
 * inclusive, at most 366 days. A plain array, not paged.
 */
export interface CardPurchaseQuery {
  start_date: ISODate
  end_date: ISODate
  card_code?: UUID
}

// ───────────────────────── Card invoices (E9b, E9c) ─────────────────────────

export interface CardInvoiceSummaryResponse {
  code: UUID
  card_code: UUID
  /** the month the invoice closes in */
  reference_month: YearMonth
  /** frozen when the invoice was created */
  closing_date: ISODate
  due_date: ISODate
  /** derived, never stored */
  state: CardInvoiceState
  total_amount: Money
  paid_amount: Money
}

/** GET /card_invoice/{code}: the summary plus its installments. */
export interface CardInvoiceResponse extends CardInvoiceSummaryResponse {
  installments: CardInstallmentResponse[]
}

/** GET /credit_card/{code}/invoice[?reference_month=yyyy-MM]: newest first, a plain array. */
export interface CardInvoiceQuery {
  reference_month?: YearMonth
}

/**
 * POST /card_invoice/{code}/payment pays the WHOLE invoice (what is still owed on each installment),
 * on one account and one date, so the cash moves once. There is no partial payment of an invoice.
 * 400: account INACTIVE, or payment_date before the account's initial_balance_date.
 * 409: invoice already paid, with no installments or nothing to pay.
 */
export interface CardInvoicePaymentRequest {
  /** the card's default account, then the default account, when omitted */
  account_code?: UUID
  payment_date: ISODate
}

export interface CardInvoicePaymentResponse {
  code: UUID
  invoice_code: UUID
  account_code: UUID
  payment_date: ISODate
  amount: Money
  /** null while active; a reversed payment stays in the history */
  reversed_at: ISODateTime | null
  version: number
}

// ───────────────────────── Budget envelopes (E10) ─────────────────────────

/**
 * 400: planned_amount <= 0, or a category that does not exist, is INACTIVE or is not DEBIT.
 * 409: the category already has an active envelope in the cycle; a CLOSED or CANCELLED cycle.
 */
export interface BudgetEnvelopeRequest {
  category_code: UUID
  /** > 0, up to 10 integer digits and 2 decimals */
  planned_amount: Money
}

export interface BudgetEnvelopeUpdateRequest {
  planned_amount: Money
}

/**
 * The consumption comes from the cycle summary (E5), so the envelope and the report never disagree.
 * All amounts are positive except remaining_amount, which is negative when the envelope is overrun.
 */
export interface BudgetEnvelopeResponse {
  code: UUID
  cycle_code: UUID
  category_code: UUID
  category_name: string
  planned_amount: Money
  /** already paid */
  recognized_amount: Money
  /** still to pay: PENDING, LATE and card installments */
  committed_amount: Money
  /** recognized + committed */
  consumed_amount: Money
  /** planned - consumed */
  remaining_amount: Money
  /** what is still free in the envelope (never negative). Not a dated bank outflow. */
  reserved_amount: Money
  /** consumed above planned */
  overrun_amount: Money
  version: number
}

/** GET /pay_cycle/{cycleCode}/envelope */
export interface CycleEnvelopesResponse {
  cycle_code: UUID
  envelopes: BudgetEnvelopeResponse[]
  total_planned: Money
  total_consumed: Money
  total_reserved: Money
  total_overrun: Money
  /** same warning as the cycle summary */
  projection_incomplete: boolean
}

// ───────────────────────── /forecast (E11) ─────────────────────────

/**
 * GET /forecast?until&include_late_income. Read only. until defaults to the last day of the current
 * cycle, otherwise the end of the month; 400 when before today or more than 366 days ahead.
 * Components are positive and disjoint:
 *   projected_cash = cash_balance + expected_income (+ late_income when include_late_income)
 *                    - obligations - card_invoices
 *   free_after_reserves = projected_cash - envelope_reserve - card_beyond_horizon
 * Late income (receivables already overdue) is NOT counted unless include_late_income is true. Card
 * installments are only in card_invoices (never in obligations). Transfers do not appear.
 */
export interface CashForecastQuery {
  until?: ISODate
  /** default false */
  include_late_income?: boolean
}

export interface CashForecastResponse {
  today: ISODate
  until: ISODate
  include_late_income: boolean
  /** real balance of all accounts today */
  cash_balance: Money
  /** income still to receive until the horizon (open movements and occurrences not posted yet) */
  expected_income: Money
  /** income already overdue */
  late_income: Money
  /** open expenses until the horizon, overdue ones included, card installments excluded */
  obligations: Money
  /** card installments due until the horizon */
  card_invoices: Money
  projected_cash: Money
  /** the current cycle the reserve refers to; null when there is none */
  envelope_cycle_code: UUID | null
  /** what is still free in the envelopes of the current cycle (E10); 0 without a cycle */
  envelope_reserve: Money
  /** card installments due AFTER the horizon (already committed) */
  card_beyond_horizon: Money
  free_after_reserves: Money
  /** the lowest daily projected cash in [today, until], late income handled like projected_cash */
  lowest_projected_cash: Money
  lowest_projected_cash_date: ISODate
  first_negative_date: ISODate | null
  /** some day of the series is below zero */
  negative_cash_alert: boolean
  /** free_after_reserves < 0. Independent of negative_cash_alert. */
  insufficient_budget_alert: boolean
  projection_incomplete: boolean
}

// ───────────────────────── /income_schedule (#74, #80) ─────────────────────────

/**
 * The main income (salary) and the rule that says on which day of each month it is expected.
 * Occurrences are calculated from the rule and the holiday calendar until they are materialized
 * into a CREDIT movement; from then on date and amount are frozen. The job materializes them on the
 * day. At most one ACTIVE schedule is the anchor that opens the pay cycles.
 */
export interface IncomeScheduleRequest {
  /** 3..50 chars; copied to the generated movements */
  description: string
  /** > 0; expected amount of each occurrence */
  amount: Money
  /** optional CREDIT category the generated movements carry */
  category_code?: UUID | null
  rule_type: DateRuleType
  /** FIXED_DAY: day of the month (1..31; a day the month lacks uses the last day). NTH_BUSINESS_DAY: position (1..15) */
  rule_value: number
  business_week: BusinessWeek
  /** required for FIXED_DAY; ignored for NTH_BUSINESS_DAY */
  non_business_day_policy?: NonBusinessDayPolicy | null
  /**
   * First nominal month served. Not before the current month: past receipts are registered as
   * movements. If it is the current month and the date already passed, the next job run generates an
   * overdue movement (LATE).
   */
  start_month: YearMonth
  /** omit for no end */
  end_month?: YearMonth | null
  /** defaults to false */
  anchor?: boolean
  /**
   * CREDIT fixed bill this schedule takes over from. The fixed bill is ended the day before
   * start_month, so the two never generate the same receipt.
   */
  replaces_fixed_bill_code?: UUID | null
}

/**
 * PATCH. Fields left out are kept. Occurrences already materialized keep their date and amount; the
 * change applies to the ones not generated yet. WHILE THE PAY CYCLES ARE ON (mode PAY_CYCLE), editing
 * the rule (rule_type, rule_value, business_week, non_business_day_policy), end_month or anchor of the
 * ANCHOR schedule is a 409 (#80), and so is inactivating it: use POST /pay_cycle_config/anchor_transition.
 * description, amount and category_code stay free.
 */
export interface IncomeScheduleUpdateRequest {
  description?: string
  amount?: Money
  category_code?: UUID
  rule_type?: DateRuleType
  rule_value?: number
  business_week?: BusinessWeek
  non_business_day_policy?: NonBusinessDayPolicy
  end_month?: YearMonth
  /** true removes the end of the validity; cannot be sent together with end_month */
  remove_end_month?: boolean
  anchor?: boolean
}

export interface IncomeScheduleResponse {
  code: UUID
  description: string
  amount: Money
  category_code: UUID | null
  rule_type: DateRuleType
  rule_value: number
  business_week: BusinessWeek
  /** null for NTH_BUSINESS_DAY */
  non_business_day_policy: NonBusinessDayPolicy | null
  start_month: YearMonth
  /** null means no end */
  end_month: YearMonth | null
  anchor: boolean
  status: IncomeScheduleStatus
  replaces_fixed_bill_code: UUID | null
}

/** GET /income_schedule: a plain array (not Page<T>). Without `status`, only ACTIVE. */
export interface IncomeScheduleQuery {
  /** repeated param */
  status?: IncomeScheduleStatus[]
}

/** One nominal month of a schedule. With the schedule code, `nominal_month` is its identity. */
export interface IncomeOccurrenceResponse {
  nominal_month: YearMonth
  state: IncomeOccurrenceState
  /** null when the date cannot be calculated (CALENDAR_NOT_REVIEWED, BUSINESS_DAY_NOT_FOUND) */
  planned_date: ISODate | null
  /** materialized amount, or the schedule's current amount for a projection; null without a date */
  amount: Money | null
  /** only for MATERIALIZED */
  movement_code: UUID | null
  /** calendar year to review; only for CALENDAR_NOT_REVIEWED */
  pending_year: number | null
}

/**
 * GET /income_schedule/{code}/occurrence?from&to
 * Both yyyy-MM (400 otherwise). Defaults: current month to current month + 11. At most 36 months.
 */
export interface IncomeOccurrenceQuery {
  from?: YearMonth
  to?: YearMonth
}

// ───────────────────────── /holiday_calendar (#73, #74, #81) ─────────────────────────

/**
 * A local calendar reviewed year by year. A year with reviewed = false is NOT prepared, which is
 * different from a reviewed year with no holidays: income dates in an unreviewed year are not
 * calculated (CALENDAR_NOT_REVIEWED), nothing is assumed. Years from 2000 to 2200.
 */
export interface HolidayRequest {
  /** must belong to the year in the path */
  date: ISODate
  /** not blank, up to 100 chars */
  name: string
}

export interface HolidayResponse {
  date: ISODate
  name: string
}

/** PUT and preview body: the COMPLETE list of the year. The holidays left out are removed. */
export interface HolidayYearRequest {
  holidays: HolidayRequest[]
}

export interface HolidayYearResponse {
  year: number
  reviewed: boolean
  /** ordered by date */
  holidays: HolidayResponse[]
}

/** An occurrence not generated yet whose date or possibility changes if the year is reviewed as sent. */
export interface HolidayChangeImpactResponse {
  schedule_code: UUID
  schedule_description: string
  nominal_month: YearMonth
  before: IncomeOccurrenceResponse
  after: IncomeOccurrenceResponse
}

/** An existing cycle boundary that the review would move. Each shared boundary appears once. */
export interface HolidayCycleBoundaryImpactResponse {
  /** the existing cycle that ends on this boundary */
  previous_cycle_code: UUID
  /** the existing cycle that starts on it; null at the end of the stored chain */
  next_cycle_code: UUID | null
  /** the boundary under the current calendar (after simulating the usual refresh) */
  old_boundary: ISODate
  /** the boundary under the proposed calendar (exclusive end of the previous cycle) */
  new_boundary: ISODate
}

/**
 * POST /holiday_calendar/{year}/preview. BREAKING (#81): it answers this object, not an array. Changes
 * nothing. cycle_boundaries and cycle_divergences are empty in CALENDAR_MONTH.
 */
export interface HolidayCalendarPreviewResponse {
  /** the old array: only the occurrences not materialized that the review affects */
  income_occurrences: HolidayChangeImpactResponse[]
  cycle_boundaries: HolidayCycleBoundaryImpactResponse[]
  /** only BOUNDARY_DIVERGES_FROM_ANCHOR that are new or changed; cycle_code is null for simulated cycles */
  cycle_divergences: PayCyclePendingResponse[]
}

// ───────────────────────── /pay_cycle_config and /pay_cycle (#75 to #87) ─────────────────────────

/**
 * A financial cycle is the interval [start_date, end_date_exclusive). The day in
 * end_date_exclusive belongs to the NEXT cycle. Cycles are contiguous: the end of one is the
 * start of the next. The cycles are opened by the anchor income schedule; competence and cash are
 * different things, and the existing reports (/balance/daily, /dashboard, /category_summary)
 * stay cash and calendar based. The cycle report is GET /pay_cycle/{code}/summary (by competence).
 */
export interface PayCyclePendingResponse {
  type: PayCyclePendingType
  /** month of the anchor occurrence the pendency is about */
  nominal_month: YearMonth | null
  /** calendar year to review; only for CALENDAR_NOT_REVIEWED */
  year: number | null
  /** only for BOUNDARY_DIVERGES_FROM_ANCHOR: the cycle that starts on the boundary */
  cycle_code: UUID | null
  /** only for BOUNDARY_DIVERGES_FROM_ANCHOR: where the boundary is */
  boundary_date: ISODate | null
  /** only for BOUNDARY_DIVERGES_FROM_ANCHOR: where the anchor occurrence is now */
  anchor_date: ISODate | null
}

export interface PayCycleResponse {
  /** never changes, even when the dates are adjusted */
  code: UUID
  start_date: ISODate
  /** the day the next cycle opens */
  end_date_exclusive: ISODate
  /** inclusive */
  last_day: ISODate
  total_days: number
  /** to show only, e.g. "Nov/Dez" or "Dez/2026–Jan/2027"; never an identifier */
  label: string
  /** nominal month of the anchor occurrence that opens the cycle; null for a TRANSITION without one */
  reference_month: YearMonth | null
  kind: PayCycleKind
  status: PayCycleStatus
  anchor_schedule_code: UUID | null
  /** the boundary was fixed by hand and is not recalculated */
  start_adjusted: boolean
  end_adjusted: boolean
  /** null in a preview, where nothing is saved */
  version: number | null
  pending: PayCyclePendingResponse[]
}

export interface PayCycleConfigResponse {
  mode: PayCycleMode
  /** null in CALENDAR_MONTH */
  anchor_schedule_code: UUID | null
  /** start of the first cycle of the current activation; null in CALENDAR_MONTH */
  activation_date: ISODate | null
  /** send it back as expected_version to change the configuration */
  version: number
  pending: PayCyclePendingResponse[]
}

/**
 * POST /pay_cycle_config/activation/preview. initial_date: between 31 days before and 31 days after
 * today, and not before the end of a previous cycle (400 otherwise).
 */
export interface PayCycleActivationPreviewRequest {
  initial_date: ISODate
}

export interface PayCycleActivationPreviewResponse {
  /** send it back to activate */
  expected_version: number
  /** the first cycles; EMPTY when the first one cannot be calculated: `pending` says why */
  cycles: PayCycleResponse[]
  pending: PayCyclePendingResponse[]
}

/** POST /pay_cycle_config/activation. 409 when expected_version is not the current one. */
export interface PayCycleActivationRequest {
  initial_date: ISODate
  expected_version: number
}

/**
 * POST /pay_cycle_config/deactivation. justification is required (400 without it). 409 when
 * expected_version is stale or the cycles are already off.
 */
export interface PayCycleDeactivationRequest {
  expected_version: number
  /** required, up to 500 chars; kept in the history of the cycles the deactivation touches */
  justification: string
}

/**
 * The proposed change of the anchor (#80). Either switch to another ACTIVE schedule
 * (anchor_schedule_code) or change the rule of the CURRENT anchor (rule_*, end_month,
 * remove_end_month); the rule fields are used only when anchor_schedule_code is omitted.
 */
export interface PayCycleAnchorTransitionPreviewRequest {
  /** an existing ACTIVE schedule to become the anchor; omit to keep the current one */
  anchor_schedule_code?: UUID
  rule_type?: DateRuleType
  rule_value?: number
  business_week?: BusinessWeek
  non_business_day_policy?: NonBusinessDayPolicy
  end_month?: YearMonth
  /** cannot be combined with end_month */
  remove_end_month?: boolean
  /** required when switching schedules and the first new date is after the frozen boundary */
  transition_shape?: PayCycleTransitionShape
}

/** Nothing is persisted by the preview. */
export interface PayCycleAnchorTransitionPreviewResponse {
  /** send back as expected_version when applying */
  expected_version: number
  previous_anchor_schedule_code: UUID | null
  anchor_schedule_code: UUID | null
  /** the last frozen boundary, from which the future chain is rebuilt */
  frozen_boundary: ISODate | null
  old_boundary: ISODate | null
  new_boundary: ISODate | null
  transition_shape: PayCycleTransitionShape | null
  /** started or frozen cycles that stay unchanged */
  preserved_cycles: PayCycleResponse[]
  /** future cycles that would be cancelled */
  cancelled_cycles: PayCycleResponse[]
  /** cycles that would be created after the frozen boundary */
  new_cycles: PayCycleResponse[]
  /** date-calculation blockers or frozen boundaries that diverge */
  pending: PayCyclePendingResponse[]
}

/** POST /pay_cycle_config/anchor_transition: the same fields as the preview + justification and version. */
export interface PayCycleAnchorTransitionRequest extends PayCycleAnchorTransitionPreviewRequest {
  /** required, up to 500 chars */
  justification: string
  /** the version returned by the preview; 409 when stale */
  expected_version: number
}

export interface PayCycleAnchorTransitionResponse {
  configuration: PayCycleConfigResponse
  /** the history entry (type ANCHOR_TRANSITION), written in the same transaction */
  adjustment: PayCycleAdjustmentResponse
  preserved_cycles: PayCycleResponse[]
  cancelled_cycles: PayCycleResponse[]
  new_cycles: PayCycleResponse[]
}

/** GET /pay_cycle?date | from&to, include_cancelled. A plain array. */
export interface PayCycleQuery {
  /** the cycle that contains the date; cannot be combined with from/to (400) */
  date?: ISODate
  /** both inclusive; returns the cycles that share at least one day with the interval */
  from?: ISODate
  to?: ISODate
  include_cancelled?: boolean // default false
}

/** GET /pay_cycle/current answers 404 with this body (not ErrorResponse) when no cycle contains today. */
export interface PayCycleCurrentNotFoundResponse {
  message: string
  pending: PayCyclePendingResponse[]
}

/** POST /pay_cycle/{code}/end_adjustment/preview. Changes nothing. */
export interface PayCycleEndAdjustmentPreviewRequest {
  /**
   * the day the next cycle would open. Must differ from the current end and be after the start of
   * this cycle and before the end of the next one (400 otherwise).
   */
  new_end_date: ISODate
}

export interface PayCycleMovementImpactResponse {
  code: UUID
  description: string
  operation_type: OperationType
  /** always positive; operation_type says the direction */
  amount: Money
  status: FinancialMovementStatus
  /** does not change; only the cycle that contains it does */
  competence_date: ISODate
  category_code: UUID | null
}

export interface PayCycleIncomeImpactResponse {
  schedule_code: UUID
  schedule_description: string
  nominal_month: YearMonth
  /** MATERIALIZED (also listed in `movements`) or PROJECTED */
  state: IncomeOccurrenceState
  planned_date: ISODate
  amount: Money
  /** only for MATERIALIZED */
  movement_code: UUID | null
}

export interface PayCycleEndAdjustmentPreviewResponse {
  old_end_date: ISODate
  new_end_date: ISODate
  /** send back as expected_version when applying */
  expected_version: number
  /** send back as expected_next_version when applying */
  expected_next_version: number
  /** the two cycles as they are: the cycle first, then the next one */
  cycles_before: PayCycleResponse[]
  /** the two as they would be; `pending` is what would be pending after the change */
  cycles_after: PayCycleResponse[]
  /** the cycle the moved days belong to today */
  leaving_cycle_code: UUID
  /** the cycle they would belong to */
  receiving_cycle_code: UUID
  /** active movements whose competence_date is in the moved days. Movements without competence_date are not listed. */
  movements: PayCycleMovementImpactResponse[]
  /** occurrences of the active schedules planned for the moved days */
  income_occurrences: PayCycleIncomeImpactResponse[]
}

/**
 * POST /pay_cycle/{code}/end_adjustment. Moves the end of the cycle and the start of the next one
 * together. 409 (nothing written) when one of the versions is stale, the cycles are off, the cycle is
 * cancelled or CLOSED, belongs to an earlier activation or has no next cycle (the end of the last cycle
 * follows the anchor schedule). There is no undo: going back is another adjustment.
 */
export interface PayCycleEndAdjustmentRequest {
  new_end_date: ISODate
  /** required, up to 500 chars */
  justification: string
  /** version of this cycle, from the preview */
  expected_version: number
  /** version of the next cycle, from the preview */
  expected_next_version: number
}

/** One entry of the history. Insert only. */
export interface PayCycleAdjustmentResponse {
  code: UUID
  type: PayCycleAdjustmentType
  /** cycle before the boundary; for DEACTIVATION, the last cycle that had started. May be null. */
  previous_cycle_code: UUID | null
  /** cycle after the boundary; for DEACTIVATION, the first cycle it cancelled. May be null. */
  next_cycle_code: UUID | null
  /** the day the next cycle opened before the change; for DEACTIVATION, the start of the first cancelled cycle */
  old_boundary: ISODate | null
  /** null when the boundary did not move to a date (DEACTIVATION) */
  new_boundary: ISODate | null
  justification: string | null
  expected_previous_version: number | null
  expected_next_version: number | null
  /** only for DEACTIVATION */
  expected_config_version: number | null
  created_date: ISOInstant
}

export interface PayCycleEndAdjustmentResponse {
  adjustment: PayCycleAdjustmentResponse
  /** the cycle whose end moved, with its new version */
  cycle: PayCycleResponse
  /** the next cycle, whose start moved with it, with its new version */
  next_cycle: PayCycleResponse
}

// ───────────────────────── Cycle report and closure (#84, #87) ─────────────────────────

export interface PayCycleSummaryCategoryResponse {
  /** null for "Sem categoria" */
  category_code: UUID | null
  category_name: string
  operation_type: OperationType
  /** paid in the competence, positive for revenue and expense */
  recognized_amount: Money
  /** recognized + projected obligations, always positive */
  projected_amount: Money
}

/** Something that can make the projection incomplete. */
export interface PayCycleSummaryPendingResponse {
  /** PAY_CYCLE or INCOME_SCHEDULE */
  source: string
  /** e.g. CALENDAR_NOT_REVIEWED */
  type: string
  /** the cycle or the income schedule, according to `source` */
  source_code: UUID | null
  nominal_month: YearMonth | null
  year: number | null
  boundary_date: ISODate | null
  anchor_date: ISODate | null
}

/**
 * GET /pay_cycle/{code}/summary (404 when the cycle does not exist). By COMPETENCE, over
 * [start_date, end_date_exclusive); it does not change /balance/daily, /dashboard or /category_summary.
 * recognized = paid; projected = recognized + the residual of PENDING/LATE + known virtual occurrences
 * of fixed bills, installment bills and income schedules (never counted twice). Expenses are positive.
 * Balances, transfers, cards and envelopes are NOT part of it.
 */
export interface PayCycleSummaryResponse {
  cycle: PayCycleResponse
  recognized_revenue: Money
  recognized_expense: Money
  projected_revenue: Money
  projected_expense: Money
  /** true when pendencies keep part of the projection from being calculated */
  projection_incomplete: boolean
  categories: PayCycleSummaryCategoryResponse[]
  pending: PayCycleSummaryPendingResponse[]
}

/** POST /pay_cycle/{code}/closure/preview. Changes nothing. */
export interface PayCycleClosurePreviewResponse {
  /** what would be frozen in the snapshot */
  summary: PayCycleSummaryResponse
  /** send back as expected_version to close */
  expected_version: number
  can_close: boolean
  blockers: PayCycleClosureBlocker[]
  /** the LATE movements that block the closure */
  late_movement_codes: UUID[]
}

/** POST /pay_cycle/{code}/closure and POST /pay_cycle/{code}/reopen. 409 when the version is stale. */
export interface PayCycleClosureRequest {
  expected_version: number
}
export type PayCycleReopenRequest = PayCycleClosureRequest

export interface PayCycleSnapshotCategoryResponse {
  category_code: UUID | null
  /** the name at the moment of the closure */
  category_name: string
  operation_type: OperationType
  recognized_amount: Money
  projected_amount: Money
}

/** An immutable, versioned snapshot. Reopening keeps the old ones; a new closure makes a new version. */
export interface PayCycleSnapshotResponse {
  code: UUID
  cycle_code: UUID
  snapshot_version: number
  cycle_version: number
  closed_at: ISOInstant
  recognized_revenue: Money
  recognized_expense: Money
  projected_revenue: Money
  projected_expense: Money
  categories: PayCycleSnapshotCategoryResponse[]
}

/** POST /pay_cycle/{code}/closure answers the closed cycle and the snapshot just created. */
export interface PayCycleClosureResponse {
  cycle: PayCycleResponse
  snapshot: PayCycleSnapshotResponse
}

// ───────────────────────── /balance/daily ─────────────────────────

/** Both required, inclusive. */
export interface DailyBalanceQuery {
  initial_date: ISODate
  end_date: ISODate
}

/**
 * One per day. The response is a Set serialized as an array: sort by `date` on the client. Since #90
 * the real side uses each settlement's effective_date, and the projected side only the residual.
 */
export interface DailyBalance {
  date: ISODate
  /** real: only what was settled */
  balance: {
    opening: Money
    total_revenue: Money
    /** negative */
    total_expense: Money
    closing: Money
  }
  /** projected: real + the residual of PENDING/LATE + recurrence occurrences not posted yet (including income schedules) */
  projected: {
    opening: Money
    pending_total_revenue: Money
    /** negative */
    pending_total_expense: Money
    closing: Money
  }
}

// ───────────────────────── /dashboard ─────────────────────────

/** GET /dashboard (current month) or GET /dashboard?month=YYYY-MM. Expenses are negative. Calendar month, cash based. */
export interface DashboardResponse {
  current_balance: Money
  current_projected_balance: Money
  month_closing_balance: Money
  month_projected_closing_balance: Money
  month_total_revenue: Money
  month_projected_total_revenue: Money
  month_total_expense: Money
  month_projected_total_expense: Money
  has_negative_balance_alert: boolean
  first_negative_balance_date: ISODate | null
  lowest_projected_balance: Money
  lowest_balance_date: ISODate | null
  /** always the 1st of the reference month, e.g. "2026-11-01" */
  reference_month: ISODate
  current_date: ISODate
  total_days_in_month: number
  days_elapsed: number
  days_remaining: number
  /** revenue + expense (expense is negative) */
  month_net_change: Money
  projected_net_change: Money
}

// ───────────────────────── /actuator/health ─────────────────────────

/** Spring Boot Actuator, exposed by default. Used only to check the API is reachable. */
export interface HealthResponse {
  status: 'UP' | 'DOWN' | 'OUT_OF_SERVICE' | 'UNKNOWN'
}

// ───────────────────────── Endpoints ─────────────────────────

/**
 * Status codes on master 89ebe57. An unknown code is 404 everywhere. A soft-deleted code is 404 on GET
 * and PATCH; DELETE is idempotent (#79): 204 when already deleted, 404 only for a code that never existed.
 *
 * POST   /financial_movement           201 FinancialMovementResponse   (unpaid; no amount_paid/pay_date/status)
 * GET    /financial_movement           200 Page<FinancialMovementResponse>
 * GET    /financial_movement/{code}    200 FinancialMovementResponse
 * PATCH  /financial_movement/{code}    200 FinancialMovementResponse   (no amount_paid/pay_date/status;
 *                                      409 on a card installment: change the purchase)
 * DELETE /financial_movement/{code}    204 (also when already deleted; 409 on a closed cycle or on a card
 *                                      installment: delete the purchase)
 *
 * POST   /financial_movement/{code}/settlements      201 MovementSettlementResponse (409 above the remaining amount)
 * GET    /financial_movement/{code}/settlements      200 MovementSettlementResponse[] (by effective_date, reversed ones too)
 * POST   /financial_movement/{code}/settlements/{settlementCode}/reversal
 *                                                    200 MovementSettlementResponse (409 when already reversed)
 *
 * POST   /fixed_bill                   201 FixedBillResponse
 * GET    /fixed_bill                   200 Page<FixedBillResponse>
 * GET    /fixed_bill/{code}            200 FixedBillResponse
 * PATCH  /fixed_bill/{code}            200 FixedBillResponse
 * PATCH  /fixed_bill/{code}/activate   200 FixedBillResponse
 * PATCH  /fixed_bill/{code}/inactivate 200 FixedBillResponse
 * DELETE /fixed_bill/{code}            204
 *
 * POST   /installment_bill             201 InstallmentBillResponse
 * GET    /installment_bill             200 Page<InstallmentBillResponse>
 * GET    /installment_bill/{code}      200 InstallmentBillResponse
 * PATCH  /installment_bill/{code}      200 InstallmentBillResponse
 * DELETE /installment_bill/{code}      204 (also when already deleted)
 *
 * GET    /category_group               200 CategoryGroupResponse[]   (7 groups, sorted by display_order)
 *
 * POST   /category                     201 CategoryResponse
 * GET    /category                     200 CategoryResponse[]        (ACTIVE unless status is sent)
 * GET    /category/{code}              200 CategoryResponse          (also INACTIVE)
 * PATCH  /category/{code}              200 CategoryResponse          (rename and/or group)
 * PATCH  /category/{code}/inactivate   200 CategoryResponse          (idempotent)
 * PATCH  /category/{code}/activate     200 CategoryResponse          (idempotent)
 *
 * GET    /category_summary             200 CategorySummaryResponse
 *
 * POST   /income_schedule              201 IncomeScheduleResponse
 * GET    /income_schedule              200 IncomeScheduleResponse[]  (ACTIVE unless status is sent)
 * GET    /income_schedule/{code}       200 IncomeScheduleResponse
 * PATCH  /income_schedule/{code}       200 IncomeScheduleResponse    (409 for protected fields of the anchor in PAY_CYCLE)
 * PATCH  /income_schedule/{code}/inactivate 200 IncomeScheduleResponse (409 for the anchor in PAY_CYCLE)
 * PATCH  /income_schedule/{code}/activate   200 IncomeScheduleResponse
 * GET    /income_schedule/{code}/occurrence?from&to  200 IncomeOccurrenceResponse[]
 * POST   /income_schedule/{code}/occurrence/{yyyy-MM}/materialize
 *                                      201 IncomeOccurrenceResponse (created) or 200 (already existed);
 *                                      up to the current month + 1; the job posts the earlier ones
 *
 * GET    /holiday_calendar             200 HolidayYearResponse[]     (the reviewed years)
 * GET    /holiday_calendar/{year}      200 HolidayYearResponse       (reviewed = false when not prepared)
 * PUT    /holiday_calendar/{year}      200 HolidayYearResponse       (body HolidayYearRequest; marks the year as reviewed;
 *                                      the cycles are refreshed after the commit)
 * POST   /holiday_calendar/{year}/preview 200 HolidayCalendarPreviewResponse (changes nothing)
 *
 * GET    /pay_cycle_config             200 PayCycleConfigResponse
 * POST   /pay_cycle_config/activation/preview 200 PayCycleActivationPreviewResponse
 * POST   /pay_cycle_config/activation  200 PayCycleConfigResponse    (409 stale version)
 * POST   /pay_cycle_config/deactivation 200 PayCycleConfigResponse   (justification required; 409)
 * POST   /pay_cycle_config/anchor_transition/preview 200 PayCycleAnchorTransitionPreviewResponse
 * POST   /pay_cycle_config/anchor_transition         200 PayCycleAnchorTransitionResponse (justification required; 409)
 *
 * GET    /pay_cycle                    200 PayCycleResponse[]
 * GET    /pay_cycle/current            200 PayCycleResponse | 404 PayCycleCurrentNotFoundResponse
 * GET    /pay_cycle/{code}             200 PayCycleResponse
 * GET    /pay_cycle/{code}/summary     200 PayCycleSummaryResponse
 * POST   /pay_cycle/{code}/closure/preview 200 PayCycleClosurePreviewResponse
 * POST   /pay_cycle/{code}/closure     200 PayCycleClosureResponse   (409 stale version or blockers)
 * POST   /pay_cycle/{code}/reopen      200 PayCycleResponse          (409 stale version)
 * GET    /pay_cycle/{code}/snapshots   200 PayCycleSnapshotResponse[]
 * POST   /pay_cycle/{code}/end_adjustment/preview 200 PayCycleEndAdjustmentPreviewResponse
 * POST   /pay_cycle/{code}/end_adjustment         200 PayCycleEndAdjustmentResponse (409)
 * GET    /pay_cycle/{code}/adjustment  200 PayCycleAdjustmentResponse[] (newest first; may be empty)
 *
 * POST   /account                    201 AccountResponse
 * GET    /account                    200 AccountResponse[]         (ACTIVE unless status is sent)
 * GET    /account/{code}             200 AccountResponse           (also INACTIVE)
 * PATCH  /account/{code}             200 AccountResponse           (`default: true` swaps the default account)
 * PATCH  /account/{code}/inactivate  200 AccountResponse           (409 for the default account)
 * PATCH  /account/{code}/activate    200 AccountResponse
 * GET    /account/balance[?date]     200 AccountsBalanceResponse   (all accounts + total)
 * GET    /account/{code}/balance[?date] 200 AccountBalanceResponse
 *
 * POST   /account_transfer           201 AccountTransferResponse
 * GET    /account_transfer           200 AccountTransferResponse[] (start_date, end_date required; reversed included)
 * GET    /account_transfer/{code}    200 AccountTransferResponse
 * POST   /account_transfer/{code}/reversal 200 AccountTransferResponse (409 when already reversed)
 *
 * POST   /credit_card                201 CreditCardResponse
 * GET    /credit_card                200 CreditCardResponse[]      (ACTIVE unless status is sent)
 * GET    /credit_card/{code}         200 CreditCardResponse
 * PATCH  /credit_card/{code}         200 CreditCardResponse
 * PATCH  /credit_card/{code}/inactivate 200 CreditCardResponse     (idempotent)
 * PATCH  /credit_card/{code}/activate   200 CreditCardResponse     (idempotent)
 * GET    /credit_card/{code}/limit   200 CreditCardLimitResponse
 * GET    /credit_card/{code}/invoice[?reference_month] 200 CardInvoiceSummaryResponse[] (newest first)
 *
 * POST   /card_purchase              201 CardPurchaseResponse      (409 above the available limit)
 * GET    /card_purchase              200 CardPurchaseResponse[]    (start_date, end_date required; card_code optional)
 * GET    /card_purchase/{code}       200 CardPurchaseResponse
 * PATCH  /card_purchase/{code}       200 CardPurchaseResponse
 * DELETE /card_purchase/{code}       204 (logical)
 *
 * GET    /card_invoice/{code}        200 CardInvoiceResponse       (with the installments)
 * POST   /card_invoice/{code}/payment 201 CardInvoicePaymentResponse (pays the whole invoice; 409)
 * GET    /card_invoice/{code}/payment 200 CardInvoicePaymentResponse[] (newest first, reversed included)
 * POST   /card_invoice/{code}/payment/{paymentCode}/reversal 200 CardInvoicePaymentResponse (409 when repeated)
 *
 * POST   /pay_cycle/{cycleCode}/envelope 201 BudgetEnvelopeResponse
 * GET    /pay_cycle/{cycleCode}/envelope 200 CycleEnvelopesResponse
 * PATCH  /envelope/{code}            200 BudgetEnvelopeResponse
 * DELETE /envelope/{code}            204 (idempotent)
 *
 * GET    /forecast[?until&include_late_income] 200 CashForecastResponse
 *
 * GET    /balance/daily                200 DailyBalance[]
 * GET    /dashboard[?month=YYYY-MM]    200 DashboardResponse
 * GET    /actuator/health              200 HealthResponse
 *
 * Reports that do NOT change with E8 to E11: /balance/daily, /dashboard and /category_summary stay cash
 * and calendar based, and never show transfers. Card installments appear in them as ordinary DEBIT
 * movements on the invoice due date, and the invoice payment is what moves the cash (the purchase never
 * counts twice). The account balances (/account/balance) and /forecast are the E8 to E11 views of cash.
 *
 * To mark a movement as paid: POST a settlement with the whole amount and the effective date. A card
 * installment is the exception: pay the invoice (POST /card_invoice/{code}/payment). A quick
 * "already paid" launch is two calls (create the movement, then the settlement).
 *
 * The client should pick categories from GET /category (ACTIVE only) and must not offer INACTIVE
 * ones for new lançamentos. Category and income schedule lists are plain arrays, not Page<T>.
 */
export const endpoints = {
  financialMovement: '/financial_movement',
  fixedBill: '/fixed_bill',
  installmentBill: '/installment_bill',
  categoryGroup: '/category_group',
  category: '/category',
  categorySummary: '/category_summary',
  account: '/account',
  accountTransfer: '/account_transfer',
  creditCard: '/credit_card',
  cardPurchase: '/card_purchase',
  cardInvoice: '/card_invoice',
  envelope: '/envelope',
  forecast: '/forecast',
  incomeSchedule: '/income_schedule',
  holidayCalendar: '/holiday_calendar',
  payCycleConfig: '/pay_cycle_config',
  payCycle: '/pay_cycle',
  dailyBalance: '/balance/daily',
  dashboard: '/dashboard',
  health: '/actuator/health',
} as const

// ───────────────────────── Helpers ─────────────────────────

/** Signed value for display and sums: CREDIT positive, DEBIT negative, whatever the API sent. */
export function signedAmount(operationType: OperationType, amount: Money): Money {
  const abs = Math.abs(amount)
  return operationType === 'DEBIT' ? -abs : abs
}

/** Builds a query string, repeating array params (Spring binds List<Enum> from repeated keys). */
export function toQueryString(params: object): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) value.forEach((v) => search.append(key, String(v)))
    else search.append(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}
