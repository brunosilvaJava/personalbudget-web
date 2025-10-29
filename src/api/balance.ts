import { apiClient } from './client';
import type { DailyBalance } from '@/types/balance';

const BASE_PATH = '/balance';

export const balanceApi = {
  /**
   * Busca o balanço diário entre duas datas
   */
  async getDailyBalance(initialDate: string, endDate: string): Promise<DailyBalance[]> {
    const params = new URLSearchParams({
      initialDate,
      endDate,
    });

    const response = await apiClient.get<DailyBalance[]>(`${BASE_PATH}/daily?${params.toString()}`);
    
    // O backend retorna Set, converter para Array ordenado
    const data = Array.isArray(response.data) ? response.data : Array.from(response.data as any);
    
    // Ordenar por data
    return data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  },

  /**
   * Busca o balanço de um dia específico
   */
  async getDailyBalanceForDate(date: string): Promise<DailyBalance | null> {
    try {
      const response = await apiClient.get<DailyBalance[]>(
        `${BASE_PATH}/daily?initialDate=${date}&endDate=${date}`
      );
      
      const data = Array.isArray(response.data) ? response.data : Array.from(response.data as any);
      return data[0] || null;
    } catch (error) {
      console.error('❌ Erro ao buscar saldo para data:', date, error);
      return null;
    }
  },
};