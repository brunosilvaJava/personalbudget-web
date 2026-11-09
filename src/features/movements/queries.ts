import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type {
  FinancialMovementRequest,
  FinancialMovementResponse,
  FinancialMovementUpdateRequest,
  MovementSettlementRequest,
  UUID,
} from '@/api/contracts'
import {
  createMovement,
  createSettlement,
  deleteMovement,
  getMovement,
  listMovements,
  listSettlements,
  reverseSettlement,
  updateMovement,
} from '@/api/financialMovements'
import { invalidateFinancial, queryKeys, type MovementListFilters } from '@/lib/query-keys'

/** The list loads 20 at a time while scrolling. */
export const MOVEMENTS_PAGE_SIZE = 20

export function useMovementList(filters: MovementListFilters | undefined) {
  return useInfiniteQuery({
    queryKey: queryKeys.movements(filters ?? { start_date: '', end_date: '' }),
    queryFn: ({ pageParam, signal }) =>
      listMovements({ ...filters!, page: pageParam, size: MOVEMENTS_PAGE_SIZE }, signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage.last ? undefined : lastPage.page + 1),
    enabled: filters !== undefined,
  })
}

// ───────────────────────── One movement, its settlements and the writes ─────────────────────────

export function useMovement(movement: FinancialMovementResponse | null) {
  return useQuery({
    queryKey: queryKeys.movement(movement?.code ?? ''),
    queryFn: ({ signal }) => getMovement(movement!.code, signal),
    enabled: movement !== null,
    initialData: movement ?? undefined,
    // The list row is fresh enough to open with; refetch after a write invalidates it.
    staleTime: 10_000,
  })
}

export function useSettlements(movementCode: UUID | undefined) {
  return useQuery({
    queryKey: queryKeys.settlements(movementCode ?? ''),
    queryFn: ({ signal }) => listSettlements(movementCode!, signal),
    enabled: Boolean(movementCode),
  })
}

export interface QuickLaunchResult {
  movement: FinancialMovementResponse
  /** set when the movement was created but the settlement failed: it stayed unpaid */
  settlementError: unknown
}

/**
 * Creates the movement and, when already paid, the settlement. A failed settlement does not undo
 * the movement (there is no shortcut on the back): the result says so and the sheet offers to try
 * paying again.
 */
export function useQuickLaunch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (requests: {
      movement: FinancialMovementRequest
      settlement: MovementSettlementRequest | null
    }): Promise<QuickLaunchResult> => {
      const movement = await createMovement(requests.movement)
      if (!requests.settlement) return { movement, settlementError: null }
      try {
        await createSettlement(movement.code, requests.settlement)
        return { movement, settlementError: null }
      } catch (settlementError) {
        return { movement, settlementError }
      }
    },
    onSuccess: () => invalidateFinancial(queryClient),
  })
}

export function useCreateSettlement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ code, body }: { code: UUID; body: MovementSettlementRequest }) =>
      createSettlement(code, body),
    onSuccess: () => invalidateFinancial(queryClient),
  })
}

export function useReverseSettlement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ movementCode, settlementCode }: { movementCode: UUID; settlementCode: UUID }) =>
      reverseSettlement(movementCode, settlementCode),
    onSuccess: () => invalidateFinancial(queryClient),
  })
}

export function useUpdateMovement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ code, body }: { code: UUID; body: FinancialMovementUpdateRequest }) =>
      updateMovement(code, body),
    onSuccess: () => invalidateFinancial(queryClient),
  })
}

export function useDeleteMovement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (code: UUID) => deleteMovement(code),
    onSuccess: () => invalidateFinancial(queryClient),
  })
}
