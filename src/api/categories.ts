import {
  endpoints,
  toQueryString,
  type CategoryGroupResponse,
  type CategoryQuery,
  type CategoryResponse,
} from './contracts'
import { request } from './http'

/** A plain array. Without `status`, only ACTIVE. */
export function listCategories(
  query: CategoryQuery = {},
  signal?: AbortSignal,
): Promise<CategoryResponse[]> {
  return request(`${endpoints.category}${toQueryString(query)}`, { signal })
}

/** Sorted by display_order. */
export function listCategoryGroups(signal?: AbortSignal): Promise<CategoryGroupResponse[]> {
  return request(endpoints.categoryGroup, { signal })
}
