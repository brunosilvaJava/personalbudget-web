import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  activatePayCycles,
  adjustEnd,
  deactivatePayCycles,
  getPayCycleConfig,
  getPayCycleSummary,
  listPayCycleAdjustments,
  listPayCycles,
  previewActivation,
  previewAnchorTransition,
  previewEndAdjustment,
  transitionAnchor,
} from '@/api/payCycles'
import type {
  PayCycleActivationPreviewRequest,
  PayCycleActivationRequest,
  PayCycleAnchorTransitionPreviewRequest,
  PayCycleAnchorTransitionRequest,
  PayCycleDeactivationRequest,
  PayCycleEndAdjustmentPreviewRequest,
  PayCycleEndAdjustmentRequest,
  UUID,
} from '@/api/contracts'
import { invalidatePayCycles, queryKeys } from '@/lib/query-keys'

/** The mode (calendar month or pay cycles), the anchor, its version and the pendencies. */
export function usePayCycleConfig() {
  return useQuery({
    queryKey: queryKeys.payCycleConfig,
    queryFn: ({ signal }) => getPayCycleConfig(signal),
  })
}

/** Every cycle that is not cancelled, plus the cancelled ones on request. */
export function usePayCycles(includeCancelled: boolean) {
  return useQuery({
    queryKey: queryKeys.payCycles(includeCancelled),
    queryFn: ({ signal }) => listPayCycles({ include_cancelled: includeCancelled }, signal),
  })
}

/** By competence. Off while the cycle is not known (the 404 of a stale link is handled upstream). */
export function usePayCycleSummary(code: UUID | undefined) {
  return useQuery({
    queryKey: queryKeys.payCycleSummary(code ?? ''),
    queryFn: ({ signal }) => getPayCycleSummary(code!, signal),
    enabled: Boolean(code),
  })
}

export function usePayCycleAdjustments(code: UUID) {
  return useQuery({
    queryKey: queryKeys.payCycleAdjustments(code),
    queryFn: ({ signal }) => listPayCycleAdjustments(code, signal),
  })
}

// Previews change nothing, so they invalidate nothing.
export const usePreviewActivation = () =>
  useMutation({ mutationFn: (body: PayCycleActivationPreviewRequest) => previewActivation(body) })
export const usePreviewEndAdjustment = () =>
  useMutation({
    mutationFn: ({ code, body }: { code: UUID; body: PayCycleEndAdjustmentPreviewRequest }) =>
      previewEndAdjustment(code, body),
  })
export const usePreviewAnchorTransition = () =>
  useMutation({
    mutationFn: (body: PayCycleAnchorTransitionPreviewRequest) => previewAnchorTransition(body),
  })

/** Every write to the cycles moves boundaries, periods and reports: the whole group is refreshed. */
function usePayCycleMutation<TVariables, TData>(fn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => invalidatePayCycles(queryClient) })
}

export const useActivatePayCycles = () =>
  usePayCycleMutation((body: PayCycleActivationRequest) => activatePayCycles(body))
export const useDeactivatePayCycles = () =>
  usePayCycleMutation((body: PayCycleDeactivationRequest) => deactivatePayCycles(body))
export const useAdjustCycleEnd = () =>
  usePayCycleMutation(({ code, body }: { code: UUID; body: PayCycleEndAdjustmentRequest }) =>
    adjustEnd(code, body),
  )
export const useTransitionAnchor = () =>
  usePayCycleMutation((body: PayCycleAnchorTransitionRequest) => transitionAnchor(body))
