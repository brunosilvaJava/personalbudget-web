import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

import type {
  ThirdPartyRequest,
  ThirdPartyResponse,
  ThirdPartyStatus,
  ThirdPartyUpdateRequest,
  UUID,
} from '@/api/contracts'
import {
  createThirdParty,
  listThirdParties,
  setThirdPartyActive,
  updateThirdParty,
} from '@/api/thirdParties'
import { invalidateFinancial, queryKeys } from '@/lib/query-keys'

const ALL: readonly ThirdPartyStatus[] = ['ACTIVE', 'INACTIVE']
const ACTIVE: readonly ThirdPartyStatus[] = ['ACTIVE']

export function useAllThirdParties() {
  return useQuery({
    queryKey: queryKeys.thirdParties(ALL),
    queryFn: ({ signal }) => listThirdParties({ status: [...ALL] }, signal),
  })
}

export function useActiveThirdParties() {
  return useQuery({
    queryKey: queryKeys.thirdParties(ACTIVE),
    queryFn: ({ signal }) => listThirdParties({}, signal),
  })
}

/** Name of any third party by code, active or not: badges and labels outlive an inactivation. */
export function useThirdPartyLookup(): Map<UUID, ThirdPartyResponse> {
  const { data } = useAllThirdParties()
  return useMemo(() => new Map((data ?? []).map((party) => [party.code, party])), [data])
}

function useThirdPartyMutation<TVariables, TData>(fn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => invalidateFinancial(queryClient) })
}

export function useCreateThirdParty() {
  return useThirdPartyMutation((body: ThirdPartyRequest) => createThirdParty(body))
}

export function useUpdateThirdParty() {
  return useThirdPartyMutation(({ code, body }: { code: UUID; body: ThirdPartyUpdateRequest }) =>
    updateThirdParty(code, body),
  )
}

export function useSetThirdPartyActive() {
  return useThirdPartyMutation(({ code, active }: { code: UUID; active: boolean }) =>
    setThirdPartyActive(code, active),
  )
}
