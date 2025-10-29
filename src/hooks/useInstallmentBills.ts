import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { installmentBillApi } from '@/api/installment-bill';
import type { InstallmentBillRequest, InstallmentBillUpdateRequest, InstallmentBillFilters } from '@/types/installment-bill';

const QUERY_KEY = 'installment-bills';

/**
 * Hook para listar installment bills com filtros
 */
export function useInstallmentBills(filters?: InstallmentBillFilters) {
  return useQuery({
    queryKey: [QUERY_KEY, filters],
    queryFn: () => installmentBillApi.findAll(filters),
  });
}

/**
 * Hook para buscar uma installment bill por código
 */
export function useInstallmentBill(code: string) {
  return useQuery({
    queryKey: [QUERY_KEY, code],
    queryFn: () => installmentBillApi.findByCode(code),
    enabled: !!code,
  });
}

/**
 * Hook para criar uma nova installment bill
 */
export function useCreateInstallmentBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: InstallmentBillRequest) => installmentBillApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

/**
 * Hook para atualizar uma installment bill
 */
export function useUpdateInstallmentBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ code, data }: { code: string; data: InstallmentBillUpdateRequest }) =>
      installmentBillApi.update(code, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

/**
 * Hook para deletar uma installment bill
 */
export function useDeleteInstallmentBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (code: string) => installmentBillApi.delete(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
