import type { FinancialMovementStatus, OperationType, UUID } from '@/api/contracts'
import type { MovementListFilters } from '@/lib/query-keys'
import type { Period } from '@/features/period/period'

/** What the person filters by, besides the period. Lives in the URL, so a link opens it again. */
export interface MovementFilters {
  operationType?: OperationType
  statuses: FinancialMovementStatus[]
  categoryCodes: UUID[]
  withoutCategory: boolean
  search: string
  /** OWNER_ONLY_MINE, or the code of a third party; empty = everyone's */
  owner?: string
}

/** `?de=meus`: only the movements that are mine, left out whatever is a third party's. */
export const OWNER_ONLY_MINE = 'meus'

export const EMPTY_FILTERS: MovementFilters = {
  statuses: [],
  categoryCodes: [],
  withoutCategory: false,
  search: '',
}

const TYPE_PARAM: Record<OperationType, string> = { DEBIT: 'despesa', CREDIT: 'receita' }
const STATUS_PARAM: Record<FinancialMovementStatus, string> = {
  PENDING: 'pendente',
  LATE: 'atrasada',
  PAID_OUT: 'paga',
}

function fromParam<T extends string>(map: Record<T, string>, value: string | null): T | undefined {
  return (Object.keys(map) as T[]).find((key) => map[key] === value)
}

/** ?tipo=despesa&status=atrasada&status=pendente&categoria=<code>&sem_categoria=1&busca=pão&de=meus */
export function readFilters(params: URLSearchParams): MovementFilters {
  const statuses = params
    .getAll('status')
    .map((value) => fromParam(STATUS_PARAM, value))
    .filter((status): status is FinancialMovementStatus => status !== undefined)
  return {
    operationType: fromParam(TYPE_PARAM, params.get('tipo')),
    statuses: [...new Set(statuses)],
    categoryCodes: [...new Set(params.getAll('categoria'))],
    withoutCategory: params.get('sem_categoria') === '1',
    search: params.get('busca') ?? '',
    owner: params.get('de') || undefined,
  }
}

export function writeFilters(params: URLSearchParams, filters: MovementFilters): URLSearchParams {
  const next = new URLSearchParams(params)
  for (const key of ['tipo', 'status', 'categoria', 'sem_categoria', 'busca', 'de'])
    next.delete(key)
  if (filters.operationType) next.set('tipo', TYPE_PARAM[filters.operationType])
  for (const status of filters.statuses) next.append('status', STATUS_PARAM[status])
  for (const code of filters.categoryCodes) next.append('categoria', code)
  if (filters.withoutCategory) next.set('sem_categoria', '1')
  if (filters.search.trim()) next.set('busca', filters.search.trim())
  if (filters.owner) next.set('de', filters.owner)
  return next
}

/** Filters in the sheet (the search box and the period are outside it). */
export function countSheetFilters(filters: MovementFilters): number {
  return (
    (filters.operationType ? 1 : 0) +
    (filters.statuses.length > 0 ? 1 : 0) +
    (filters.categoryCodes.length > 0 || filters.withoutCategory ? 1 : 0) +
    (filters.owner ? 1 : 0)
  )
}

/**
 * The query of GET /financial_movement without the page. A category list wins over
 * "sem categoria", as on the back. The order is the API default (movement_date DESC).
 */
export function toListFilters(period: Period, filters: MovementFilters): MovementListFilters {
  const query: MovementListFilters = { start_date: period.start, end_date: period.end }
  if (filters.search.trim()) query.description = filters.search.trim()
  if (filters.operationType) query.operation_type = [filters.operationType]
  if (filters.statuses.length > 0) query.status = [...filters.statuses].sort()
  if (filters.categoryCodes.length > 0) query.category_code = [...filters.categoryCodes].sort()
  else if (filters.withoutCategory) query.without_category = true
  if (filters.owner === OWNER_ONLY_MINE) query.own_only = true
  else if (filters.owner) query.third_party_code = filters.owner
  return query
}
