import { apiClient } from './client';
import type { 
  FinancialMovement, 
  FinancialMovementRequest,
  FinancialMovementFilters 
} from '@/types/financial-movement';

export const financialMovementApi = {
  list: async (filters: FinancialMovementFilters) => {
    const params = new URLSearchParams();
    
    if (filters.description) params.append('description', filters.description);
    if (filters.operationTypes) {
      filters.operationTypes.forEach(type => params.append('operation_type', type));
    }
    if (filters.statuses) {
      filters.statuses.forEach(status => params.append('status', status));
    }
    params.append('start_date', filters.startDate);
    params.append('end_date', filters.endDate);

    const { data } = await apiClient.get<FinancialMovement[]>(
      `/financial_movement?${params.toString()}`
    );
    return data;
  },

  findByCode: async (code: string) => {
    const { data } = await apiClient.get<FinancialMovement>(`/financial_movement/${code}`);
    return data;
  },

  create: async (request: FinancialMovementRequest) => {
    await apiClient.post('/financial_movement', request);
  },

  update: async (code: string, request: Partial<FinancialMovementRequest>) => {
    const { data } = await apiClient.patch<FinancialMovement>(
      `/financial_movement/${code}`,
      request
    );
    return data;
  },

  delete: async (code: string) => {
    await apiClient.delete(`/financial_movement/${code}`);
  },
};
