import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import type {
  FixedBillQuery,
  FixedBillRequest,
  FixedBillUpdateRequest,
  InstallmentBillQuery,
  InstallmentBillRequest,
  InstallmentBillUpdateRequest,
  UUID,
} from '@/api/contracts'
import {
  createFixedBill,
  deleteFixedBill,
  listFixedBills,
  setFixedBillActive,
  updateFixedBill,
} from '@/api/fixedBills'
import {
  createInstallmentBill,
  deleteInstallmentBill,
  listInstallmentBills,
  updateInstallmentBill,
} from '@/api/installmentBills'
import { invalidateFinancial, queryKeys } from '@/lib/query-keys'

const PAGE_SIZE = 20

export function useFixedBills(filters: Omit<FixedBillQuery, 'page' | 'size'>) {
  return useInfiniteQuery({
    queryKey: queryKeys.fixedBills(filters),
    queryFn: ({ pageParam, signal }) =>
      listFixedBills({ ...filters, page: pageParam, size: PAGE_SIZE }, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.last ? undefined : last.page + 1),
  })
}

export function useInstallmentBills(filters: Omit<InstallmentBillQuery, 'page' | 'size'>) {
  return useInfiniteQuery({
    queryKey: queryKeys.installmentBills(filters),
    queryFn: ({ pageParam, signal }) =>
      listInstallmentBills({ ...filters, page: pageParam, size: PAGE_SIZE }, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.last ? undefined : last.page + 1),
  })
}

/** Every write here can post movements on the server: invalidate the whole financial group. */
function useFinancialMutation<TVariables, TData>(fn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => invalidateFinancial(queryClient) })
}

export const useCreateFixedBill = () =>
  useFinancialMutation((body: FixedBillRequest) => createFixedBill(body))
export const useUpdateFixedBill = () =>
  useFinancialMutation(({ code, body }: { code: UUID; body: FixedBillUpdateRequest }) =>
    updateFixedBill(code, body),
  )
export const useSetFixedBillActive = () =>
  useFinancialMutation(({ code, active }: { code: UUID; active: boolean }) =>
    setFixedBillActive(code, active),
  )
export const useDeleteFixedBill = () => useFinancialMutation((code: UUID) => deleteFixedBill(code))

export const useCreateInstallmentBill = () =>
  useFinancialMutation((body: InstallmentBillRequest) => createInstallmentBill(body))
export const useUpdateInstallmentBill = () =>
  useFinancialMutation(({ code, body }: { code: UUID; body: InstallmentBillUpdateRequest }) =>
    updateInstallmentBill(code, body),
  )
export const useDeleteInstallmentBill = () =>
  useFinancialMutation((code: UUID) => deleteInstallmentBill(code))
