import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { CardPurchaseBatchRequest } from '@/api/contracts'
import { importPurchases } from '@/api/creditCards'
import { invalidateFinancial } from '@/lib/query-keys'

/** The dry run: nothing is written, so it is a plain mutation that invalidates nothing. */
export function usePreviewImport() {
  return useMutation({ mutationFn: (body: CardPurchaseBatchRequest) => importPurchases(body) })
}

export function useImportPurchases() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CardPurchaseBatchRequest) => importPurchases(body),
    onSuccess: (lines) => {
      const created = lines.filter((line) => line.status === 'NEW').length
      toast.success(created === 1 ? '1 compra importada.' : `${created} compras importadas.`)
      return invalidateFinancial(queryClient)
    },
  })
}
