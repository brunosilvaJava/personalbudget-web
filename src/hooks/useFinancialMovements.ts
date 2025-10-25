import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financialMovementApi } from '@/api/financial-movement';
import type { 
  FinancialMovementFilters, 
  FinancialMovementRequest 
} from '@/types/financial-movement';

const QUERY_KEY = 'financial-movements';

// Hook para listar movimentações com paginação
export const useFinancialMovements = (filters: FinancialMovementFilters) => {
  return useQuery({
    queryKey: [QUERY_KEY, filters],
    queryFn: () => financialMovementApi.list(filters),
    staleTime: 30000, // 30 segundos
  });
};

// Hook para buscar uma movimentação específica
export const useFinancialMovement = (code: string) => {
  return useQuery({
    queryKey: [QUERY_KEY, code],
    queryFn: () => financialMovementApi.findByCode(code),
    enabled: !!code,
  });
};

// Hook para criar movimentação
export const useCreateFinancialMovement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: FinancialMovementRequest) => 
      financialMovementApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
};

// Hook para atualizar movimentação
export const useUpdateFinancialMovement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ code, data }: { 
      code: string; 
      data: Partial<FinancialMovementRequest> 
    }) => financialMovementApi.update(code, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
};

// Hook para deletar movimentação
export const useDeleteFinancialMovement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (code: string) => financialMovementApi.delete(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
};