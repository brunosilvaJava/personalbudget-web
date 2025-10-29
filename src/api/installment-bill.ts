import { apiClient } from './client';
import type { 
  InstallmentBill, 
  InstallmentBillRequest, 
  InstallmentBillUpdateRequest, 
  InstallmentBillFilters,
  PagedInstallmentBillResponse 
} from '@/types/installment-bill';

const BASE_PATH = '/installment_bill';

export const installmentBillApi = {
  /**
   * Lista todas as installment bills com filtros opcionais e paginação
   */
  async findAll(filters?: InstallmentBillFilters): Promise<PagedInstallmentBillResponse> {
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
    
    const response = await apiClient.get<PagedInstallmentBillResponse>(url);
    return response.data;
  },

  /**
   * Busca uma installment bill por código
   */
  async findByCode(code: string): Promise<InstallmentBill> {
    const response = await apiClient.get<InstallmentBill>(`${BASE_PATH}/${code}`);
    return response.data;
  },

  /**
   * Cria uma nova installment bill
   */
  async create(data: InstallmentBillRequest): Promise<void> {
    await apiClient.post(BASE_PATH, data);
  },

  /**
   * Atualiza uma installment bill existente
   */
  async update(code: string, data: InstallmentBillUpdateRequest): Promise<InstallmentBill> {
    const response = await apiClient.patch<InstallmentBill>(`${BASE_PATH}/${code}`, data);
    return response.data;
  },

  /**
   * Deleta uma installment bill
   */
  async delete(code: string): Promise<void> {
    await apiClient.delete(`${BASE_PATH}/${code}`);
  },
};