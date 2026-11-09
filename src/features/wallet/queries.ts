import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  activateAccount,
  createAccount,
  createTransfer,
  getAccount,
  getAccountBalance,
  getAccountBalances,
  getAccountStatement,
  inactivateAccount,
  listAccounts,
  listTransfers,
  reverseTransfer,
  updateAccount,
} from '@/api/accounts'
import type {
  AccountRequest,
  AccountResponse,
  AccountStatus,
  AccountTransferRequest,
  AccountUpdateRequest,
  ISODate,
  UUID,
} from '@/api/contracts'
import { invalidateFinancial, queryKeys } from '@/lib/query-keys'

const ALL: readonly AccountStatus[] = ['ACTIVE', 'INACTIVE']
const ACTIVE: readonly AccountStatus[] = ['ACTIVE']

/** Every account, ACTIVE and INACTIVE: transfers and settlements of the past point at both. */
export function useAllAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts(ALL),
    queryFn: ({ signal }) => listAccounts({ status: [...ALL] }, signal),
  })
}

/** The accounts money can move from or to now. */
export function useActiveAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts(ACTIVE),
    queryFn: ({ signal }) => listAccounts({}, signal),
  })
}

export function useAccountLookup(): Map<UUID, AccountResponse> {
  const { data } = useAllAccounts()
  return useMemo(() => new Map((data ?? []).map((account) => [account.code, account])), [data])
}

export function useAccount(code: UUID) {
  return useQuery({
    queryKey: queryKeys.account(code),
    queryFn: ({ signal }) => getAccount(code, signal),
  })
}

/** "Saldo nas contas": every account today and the total (the real balance, initial balance included). */
export function useAccountBalances() {
  return useQuery({
    queryKey: queryKeys.accountBalances('today'),
    queryFn: ({ signal }) => getAccountBalances(undefined, signal),
  })
}

export function useAccountBalance(code: UUID) {
  return useQuery({
    queryKey: queryKeys.accountBalance(code, 'today'),
    queryFn: ({ signal }) => getAccountBalance(code, undefined, signal),
  })
}

export function useAccountStatement(code: UUID, start: ISODate, end: ISODate) {
  return useQuery({
    queryKey: queryKeys.accountStatement(code, start, end),
    queryFn: ({ signal }) =>
      getAccountStatement(code, { start_date: start, end_date: end }, signal),
  })
}

export function useTransfers(start: ISODate, end: ISODate, accountCode: UUID | null = null) {
  return useQuery({
    queryKey: queryKeys.transfers(start, end, accountCode),
    queryFn: ({ signal }) =>
      listTransfers(
        { start_date: start, end_date: end, account_code: accountCode ?? undefined },
        signal,
      ),
  })
}

export function useCreateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: AccountRequest) => createAccount(body),
    onSuccess: () => invalidateFinancial(queryClient),
  })
}

export function useUpdateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ code, body }: { code: UUID; body: AccountUpdateRequest }) =>
      updateAccount(code, body),
    onSuccess: () => invalidateFinancial(queryClient),
  })
}

export function useSetAccountActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ code, active }: { code: UUID; active: boolean }) =>
      active ? activateAccount(code) : inactivateAccount(code),
    onSuccess: () => invalidateFinancial(queryClient),
  })
}

export function useCreateTransfer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: AccountTransferRequest) => createTransfer(body),
    onSuccess: () => invalidateFinancial(queryClient),
  })
}

export function useReverseTransfer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (code: UUID) => reverseTransfer(code),
    onSuccess: () => invalidateFinancial(queryClient),
  })
}
