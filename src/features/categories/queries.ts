import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { listCategories, listCategoryGroups } from '@/api/categories'
import type {
  CategoryGroupResponse,
  CategoryResponse,
  CategoryStatus,
  OperationType,
  UUID,
} from '@/api/contracts'
import { queryKeys } from '@/lib/query-keys'

const ALL_STATUSES: readonly CategoryStatus[] = ['ACTIVE', 'INACTIVE']

/** Categories change only through the API (Swagger) in the MVP: a long cache is fine. */
const CATEGORY_STALE_TIME = 10 * 60_000

/**
 * Every category, ACTIVE and INACTIVE, so the history shows the names of inactivated ones too.
 * Pick lists filter ACTIVE ones (see categoriesFor).
 */
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories(ALL_STATUSES),
    queryFn: ({ signal }) => listCategories({ status: [...ALL_STATUSES] }, signal),
    staleTime: CATEGORY_STALE_TIME,
  })
}

export function useCategoryGroups() {
  return useQuery({
    queryKey: queryKeys.categoryGroups,
    queryFn: ({ signal }) => listCategoryGroups(signal),
    staleTime: CATEGORY_STALE_TIME,
  })
}

/** code → category, for the names in the lists. Empty while loading. */
export function useCategoryLookup(): Map<UUID, CategoryResponse> {
  const { data } = useCategories()
  return useMemo(() => new Map((data ?? []).map((category) => [category.code, category])), [data])
}

export interface CategoryGroupOption {
  code: UUID
  name: string
  categories: CategoryResponse[]
}

/**
 * Categories grouped in the groups' display order, names sorted inside each group.
 * `activeOnly` for pick lists (new lançamentos never get an INACTIVE category).
 */
export function groupCategories(
  categories: readonly CategoryResponse[],
  groups: readonly CategoryGroupResponse[],
  options: { operationType?: OperationType; activeOnly?: boolean } = {},
): CategoryGroupOption[] {
  const order = new Map(groups.map((group) => [group.code, group.display_order]))
  const byGroup = new Map<UUID, CategoryGroupOption>()
  for (const category of categories) {
    if (options.operationType && category.operation_type !== options.operationType) continue
    if (options.activeOnly && category.status !== 'ACTIVE') continue
    let group = byGroup.get(category.group_code)
    if (!group) {
      group = { code: category.group_code, name: category.group_name, categories: [] }
      byGroup.set(category.group_code, group)
    }
    group.categories.push(category)
  }
  const sorted = [...byGroup.values()].sort(
    (a, b) =>
      (order.get(a.code) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(b.code) ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, 'pt-BR'),
  )
  for (const group of sorted) {
    group.categories.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }
  return sorted
}

/** Grouped categories ready for a picker or a filter. */
export function useGroupedCategories(options: {
  operationType?: OperationType
  activeOnly?: boolean
}) {
  const categories = useCategories()
  const groups = useCategoryGroups()
  const { operationType, activeOnly } = options
  const data = useMemo(
    () =>
      categories.data && groups.data
        ? groupCategories(categories.data, groups.data, { operationType, activeOnly })
        : undefined,
    [categories.data, groups.data, operationType, activeOnly],
  )
  return {
    data,
    isPending: categories.isPending || groups.isPending,
    error: categories.error ?? groups.error,
    refetch: () => {
      void categories.refetch()
      void groups.refetch()
    },
  }
}
