import { apiClient } from './client';
import type { 
  FixedBill, 
  FixedBillRequest, 
  FixedBillUpdateRequest, 
  FixedBillFilters,
  PagedFixedBillResponse 
} from '@/types/fixed-bill';

const BASE_PATH = '/fixed_bill';

export const fixedBillApi = {
  /**
   * Lista todas as fixed bills com filtros opcionais e paginação
   */
  async findAll(filters?: FixedBillFilters): Promise<PagedFixedBillResponse> {
    const params = new URLSearchParams();
    
    if (filters?.description) {
      params.append('description', filters.description);
    }
    
    if (filters?.operation_type?.length) {
      filters.operation_type.forEach(type => params.append('operation_type', type));
    }
    
    if (filters?.status?.length) {
      filters.status.forEach(status => params.append('status', status));
    }
    
    if (filters?.recurrence_type?.length) {
      filters.recurrence_type.forEach(type => params.append('recurrence_type', type));
    }

    if (filters?.page !== undefined) {
      params.append('page', filters.page.toString());
    }

    if (filters?.size !== undefined) {
      params.append('size', filters.size.toString());
    }

    if (filters?.sortBy) {
      params.append('sortBy', filters.sortBy);
    }

    if (filters?.sortDirection) {
      params.append('sortDirection', filters.sortDirection);
    }

    const queryString = params.toString();
    const url = queryString ? `${BASE_PATH}?${queryString}` : BASE_PATH;
    
    const response = await apiClient.get<PagedFixedBillResponse>(url);
    return response.data;
  },

  /**
   * Busca uma fixed bill por código
   */
  async findByCode(code: string): Promise<FixedBill> {
    const response = await apiClient.get<FixedBill>(`${BASE_PATH}/${code}`);
    return response.data;
  },

  /**
   * Cria uma nova fixed bill
   */
  async create(data: FixedBillRequest): Promise<void> {
    await apiClient.post(BASE_PATH, data);
  },

  /**
   * Atualiza uma fixed bill existente
   */
  async update(code: string, data: FixedBillUpdateRequest): Promise<FixedBill> {
    const response = await apiClient.patch<FixedBill>(`${BASE_PATH}/${code}`, data);
    return response.data;
  },

  /**
   * Inativa uma fixed bill
   */
  async inactivate(code: string): Promise<FixedBill> {
    const response = await apiClient.patch<FixedBill>(`${BASE_PATH}/${code}/inactivate`);
    return response.data;
  },

  /**
   * Ativa uma fixed bill
   */
  async activate(code: string): Promise<FixedBill> {
    const response = await apiClient.patch<FixedBill>(`${BASE_PATH}/${code}/activate`);
    return response.data;
  },

  /**
   * Deleta uma fixed bill
   */
  async delete(code: string): Promise<void> {
    await apiClient.delete(`${BASE_PATH}/${code}`);
  },
};
