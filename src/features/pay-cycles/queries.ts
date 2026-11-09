import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  activatePayCycles,
  adjustEnd,
  closeCycle,
  deactivatePayCycles,
  getPayCycleByDate,
  getPayCycleConfig,
  getPayCycleSummary,
  listPayCycleAdjustments,
  listPayCycles,
  listSnapshots,
  previewActivation,
  previewAnchorTransition,
  previewClosure,
  previewEndAdjustment,
  reopenCycle,
  transitionAnchor,
} from '@/api/payCycles'
import { getMovement } from '@/api/financialMovements'
import type {
  PayCycleActivationPreviewRequest,
  PayCycleActivationRequest,
  PayCycleAnchorTransitionPreviewRequest,
  PayCycleAnchorTransitionRequest,
  PayCycleDeactivationRequest,
  PayCycleEndAdjustmentPreviewRequest,
  PayCycleEndAdjustmentRequest,
  ISODate,
  PayCycleResponse,
  UUID,
} from '@/api/contracts'
import { formatDate } from '@/lib/format'
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

/** Every snapshot of the cycle (one per closure), empty while it was never closed. */
export function useCycleSnapshots(code: UUID) {
  return useQuery({
    queryKey: queryKeys.payCycleSnapshots(code),
    queryFn: ({ signal }) => listSnapshots(code, signal),
  })
}

/**
 * What closing would freeze and what blocks it. A POST that only reads, kept as a query so it
 * reloads with the data around it. It is never kept: the `expected_version` it carries is only
 * good while nothing changed, so every opening asks again.
 */
export function useClosurePreview(code: UUID, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.payCycleClosurePreview(code),
    queryFn: ({ signal }) => previewClosure(code, signal),
    enabled,
    staleTime: 0,
    gcTime: 0,
  })
}

/**
 * The movements the preview names, one by one (it only sends their codes). Only the first `limit`
 * are asked for; the rest are counted by the caller.
 */
export function useMovementsByCode(codes: readonly UUID[], limit: number) {
  return useQueries({
    queries: codes.slice(0, limit).map((code) => ({
      queryKey: queryKeys.movement(code),
      queryFn: ({ signal }: { signal: AbortSignal }) => getMovement(code, signal),
      staleTime: 10_000,
    })),
  })
}

/**
 * The cycle that holds a competence date when it is CLOSED, else null. Off unless the cycles are
 * on (otherwise there is nothing to ask) and while the date is not known.
 */
export function useClosedCycle(date: ISODate | undefined): PayCycleResponse | null {
  const config = usePayCycleConfig()
  const cycle = useQuery({
    queryKey: queryKeys.payCycleByDate(date ?? ''),
    queryFn: ({ signal }) => getPayCycleByDate(date!, signal),
    enabled: config.data?.mode === 'PAY_CYCLE' && Boolean(date),
    staleTime: 60_000,
  })
  return cycle.data?.status === 'CLOSED' ? cycle.data : null
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

/**
 * Every write to the cycles moves boundaries, periods and reports: the whole group is refreshed.
 * The toast is here, not in the sheet that asked: the refreshed data can take that sheet off the
 * screen (a boundary that moved, the cycles that went off) before the answer is handled, and a
 * callback given to `mutate` does not run once its component is gone.
 */
function usePayCycleMutation<TVariables, TData>(
  fn: (variables: TVariables) => Promise<TData>,
  message: (variables: TVariables) => string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: async (_data, variables) => {
      toast.success(message(variables))
      await invalidatePayCycles(queryClient)
    },
  })
}

export const useActivatePayCycles = () =>
  usePayCycleMutation(
    (body: PayCycleActivationRequest) => activatePayCycles(body),
    (body) => `Ciclos ativados a partir de ${formatDate(body.initial_date)}.`,
  )
export const useDeactivatePayCycles = () =>
  usePayCycleMutation(
    (body: PayCycleDeactivationRequest) => deactivatePayCycles(body),
    () => 'Ciclos desligados.',
  )
export const useAdjustCycleEnd = () =>
  usePayCycleMutation(
    ({ code, body }: { code: UUID; body: PayCycleEndAdjustmentRequest }) => adjustEnd(code, body),
    () => 'Virada ajustada.',
  )
export const useTransitionAnchor = () =>
  usePayCycleMutation(
    (body: PayCycleAnchorTransitionRequest) => transitionAnchor(body),
    () => 'Receita âncora atualizada.',
  )

/**
 * Closing freezes the cycle in a snapshot; reopening lets it change again. Both refresh the whole
 * group (status, snapshots, the lists that depend on the period) and, when the back refuses (a
 * stale version, a blocker that appeared), reload it as well, so what the person sees is what the
 * back now has. The toast is here for the same reason as above: the cycle page changes shape when
 * the status does, and a callback given to `mutate` does not run once its component is gone.
 */
export function useCloseCycle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ code, expectedVersion }: { code: UUID; expectedVersion: number }) =>
      closeCycle(code, { expected_version: expectedVersion }),
    onSuccess: async (data) => {
      toast.success(`Ciclo fechado. Fechamento versão ${data.snapshot.snapshot_version}.`)
      await invalidatePayCycles(queryClient)
    },
    onError: () => invalidatePayCycles(queryClient),
  })
}

export function useReopenCycle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ code, expectedVersion }: { code: UUID; expectedVersion: number }) =>
      reopenCycle(code, { expected_version: expectedVersion }),
    onSuccess: async () => {
      toast.success('Ciclo reaberto.')
      await invalidatePayCycles(queryClient)
    },
    onError: () => invalidatePayCycles(queryClient),
  })
}
