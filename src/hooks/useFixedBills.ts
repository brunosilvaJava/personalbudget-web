import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fixedBillApi } from '@/api/fixed-bill';
import type { FixedBillRequest, FixedBillUpdateRequest, FixedBillFilters } from '@/types/fixed-bill';

const QUERY_KEY = 'fixed-bills';

/**
 * Hook para listar fixed bills com filtros
 */
export function useFixedBills(filters?: FixedBillFilters) {
  return useQuery({
    queryKey: [QUERY_KEY, filters],
    queryFn: () => fixedBillApi.findAll(filters),
  });
}

/**
 * Hook para buscar uma fixed bill por código
 */
export function useFixedBill(code: string) {
  return useQuery({
    queryKey: [QUERY_KEY, code],
    queryFn: () => fixedBillApi.findByCode(code),
    enabled: !!code,
  });
}

/**
 * Hook para criar uma nova fixed bill
 */
export function useCreateFixedBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: FixedBillRequest) => fixedBillApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

/**
 * Hook para atualizar uma fixed bill
 */
export function useUpdateFixedBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ code, data }: { code: string; data: FixedBillUpdateRequest }) =>
      fixedBillApi.update(code, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

/**
 * Hook para inativar uma fixed bill
 */
export function useInactivateFixedBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (code: string) => fixedBillApi.inactivate(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

/**
 * Hook para ativar uma fixed bill
 */
export function useActivateFixedBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (code: string) => fixedBillApi.activate(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

/**
 * Hook para deletar uma fixed bill
 */
export function useDeleteFixedBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (code: string) => fixedBillApi.delete(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
