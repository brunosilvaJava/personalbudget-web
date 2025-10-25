import { apiClient } from './client';
import type { 
  FinancialMovement, 
  FinancialMovementRequest,
  FinancialMovementFilters,
  PagedFinancialMovementResponse
} from '@/types/financial-movement';

// Interface para o formato que pode vir da API (aceita snake_case e camelCase)
interface FinancialMovementApiResponse {
  code: string;
  operation_type?: string;
  operationType?: string;
  description?: string;
  amount?: number;
  amount_paid?: number;
  amountPaid?: number;
  movement_date?: string;
  movementDate?: string;
  due_date?: string;
  dueDate?: string;
  pay_date?: string | null;
  payDate?: string | null;
  status?: string;
  created_date?: string;
  last_modified_date?: string;
  recurrence_bill_code?: string | null;
  recurrenceBillCode?: string | null;
}

interface PagedApiResponse {
  content: FinancialMovementApiResponse[];
  // aceitar tanto snake_case quanto camelCase
  page?: number;
  size?: number;
  total_elements?: number;
  total_pages?: number;
  totalElements?: number;
  totalPages?: number;
  first?: boolean;
  last?: boolean;
}

// Interface para o formato enviado à API (snake_case)
interface FinancialMovementApiRequest {
  operation_type: string;
  description: string;
  amount: number;
  amount_paid?: number;
  movement_date: string;
  due_date: string;
  pay_date?: string;
  status: string;
}

// Converter de API (snake_case/camelCase) para App (camelCase)
// Usamos fallback seguros para evitar undefined e garantir compatibilidade com a interface FinancialMovement
const mapFromApi = (apiData: FinancialMovementApiResponse): FinancialMovement => {
  // defaults seguros
  const operationType = (apiData.operation_type ?? apiData.operationType ?? 'DEBIT') as any;
  const status = (apiData.status ?? 'PENDING') as any;

  const movementDate = apiData.movement_date ?? apiData.movementDate ?? '';
  const dueDate = apiData.due_date ?? apiData.dueDate ?? '';
  const payDate = apiData.pay_date ?? apiData.payDate ?? null;

  const amount = typeof apiData.amount === 'number' ? apiData.amount : 0;
  const amountPaid = typeof apiData.amount_paid === 'number'
    ? apiData.amount_paid
    : (typeof apiData.amountPaid === 'number' ? apiData.amountPaid : 0);

  return {
    code: apiData.code,
    operationType,
    description: apiData.description ?? '',
    amount,
    amountPaid,
    movementDate,
    dueDate,
    payDate,
    status,
    createdDate: apiData.created_date ?? '',
    lastModifiedDate: apiData.last_modified_date ?? '',
  };
};

// Converter de App (camelCase) para API (snake_case)
const mapToApi = (data: FinancialMovementRequest): FinancialMovementApiRequest => ({
  operation_type: data.operationType,
  description: data.description,
  amount: data.amount,
  amount_paid: data.amountPaid,
  movement_date: data.movementDate,
  due_date: data.dueDate,
  pay_date: data.payDate,
  status: data.status,
});

export const financialMovementApi = {
  list: async (filters: FinancialMovementFilters): Promise<PagedFinancialMovementResponse> => {
    const params = new URLSearchParams();
    
    if (filters.description) {
      params.append('description', filters.description);
    }
    
    if (filters.operationTypes && filters.operationTypes.length > 0) {
      filters.operationTypes.forEach(type => {
        params.append('operation_type', type);
      });
    }
    
    if (filters.statuses && filters.statuses.length > 0) {
      filters.statuses.forEach(status => {
        params.append('status', status);
      });
    }
    
    params.append('start_date', filters.startDate);
    params.append('end_date', filters.endDate);
    params.append('page', String(filters.page ?? 0));
    params.append('size', String(filters.size ?? 10));
    params.append('sortBy', filters.sortBy || 'movementDate');
    params.append('sortDirection', filters.sortDirection || 'DESC');

    const response = await apiClient.get<PagedApiResponse>(
      `/financial_movement?${params.toString()}`
    );
    
    const data = response.data;

    // Comportamento defensivo: aceitar camelCase ou snake_case retornados pela API
    const page = data.page ?? 0;
    const size = data.size ?? (data.content ? data.content.length : 0);
    const totalElements = data.total_elements ?? data.totalElements ?? 0;
    const totalPages = data.total_pages ?? data.totalPages ?? 0;
    const first = data.first ?? false;
    const last = data.last ?? false;

    return {
      content: (data.content ?? []).map(mapFromApi),
      page,
      size,
      totalElements,
      totalPages,
      first,
      last,
    };
  },

  findByCode: async (code: string): Promise<FinancialMovement> => {
    const response = await apiClient.get<FinancialMovementApiResponse>(
      `/financial_movement/${code}`
    );
    return mapFromApi(response.data);
  },

  create: async (data: FinancialMovementRequest): Promise<FinancialMovement> => {
    const apiPayload = mapToApi(data);
    console.log('🔍 Payload sendo enviado para API (após mapToApi):', apiPayload);
    
    const response = await apiClient.post<FinancialMovementApiResponse>(
      '/financial_movement',
      apiPayload
    );
    return mapFromApi(response.data);
  },

  update: async (
    code: string,
    data: Partial<FinancialMovementRequest>
  ): Promise<FinancialMovement> => {
    const response = await apiClient.patch<FinancialMovementApiResponse>(
      `/financial_movement/${code}`,
      mapToApi(data as FinancialMovementRequest)
    );
    return mapFromApi(response.data);
  },

  delete: async (code: string): Promise<void> => {
    await apiClient.delete(`/financial_movement/${code}`);
  },
};