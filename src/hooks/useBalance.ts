import { useQuery } from '@tanstack/react-query';
import { balanceApi } from '@/api/balance';
import type { BalanceFilters } from '@/types/balance';

const QUERY_KEY = 'balance';

/**
 * Hook para buscar balanço diário de um período
 */
export function useDailyBalance(filters: BalanceFilters) {
  return useQuery({
    queryKey: [QUERY_KEY, 'daily', filters],
    queryFn: () => balanceApi.getDailyBalance(filters.initialDate, filters.endDate),
    enabled: !!filters.initialDate && !!filters.endDate,
    retry: 2,
    staleTime: 1000 * 60 * 2, // Cache por 2 minutos
  });
}

/**
 * Hook para buscar balanço de uma data específica
 */
export function useDailyBalanceForDate(date: string, enabled: boolean = true) {
  return useQuery({
    queryKey: [QUERY_KEY, 'date', date],
    queryFn: async () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Buscando saldo para data:', date);
      }
      const result = await balanceApi.getDailyBalanceForDate(date);
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Resultado da busca:', result);
      }
      return result;
    },
    enabled: enabled && !!date,
    staleTime: 1000 * 60 * 5, // Cache por 5 minutos
    retry: 1,
  });
}