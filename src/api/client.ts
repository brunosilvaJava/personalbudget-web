import axios, { AxiosError } from 'axios';
import { ENV } from '@/config/env';

// Tipo para o formato de erro da API
export interface ApiValidationError {
  message: string;
  validations: Record<string, string>;
}

// Tipo para erros gerais
export interface ApiError {
  message: string;
  status: number;
  validations?: Record<string, string>;
}

export const apiClient = axios.create({
  baseURL: ENV.PERSONALBUDGET_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 segundos
});

// Interceptor de Request
apiClient.interceptors.request.use(
  (config) => {
    const method = config.method?.toUpperCase();
    const url = config.url;
    console.log(`[PersonalBudget API] 🚀 ${method} ${url}`);
    
    // Log do payload para debug (apenas em dev)
    if (ENV.IS_DEVELOPMENT && config.data) {
      console.log('[PersonalBudget API] 📦 Payload:', config.data);
    }
    
    return config;
  },
  (error) => {
    console.error('[PersonalBudget API] ❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Interceptor de Response
apiClient.interceptors.response.use(
  (response) => {
    const method = response.config.method?.toUpperCase();
    const url = response.config.url;
    const status = response.status;
    console.log(`[PersonalBudget API] ✅ ${method} ${url} - ${status}`);
    return response;
  },
  (error: AxiosError<ApiValidationError>) => {
    if (error.response) {
      const { status, data } = error.response;
      const method = error.config?.method?.toUpperCase();
      const url = error.config?.url;

      console.error(`[PersonalBudget API] ❌ ${method} ${url} - ${status}`);

      // Tratamento específico por status code
      switch (status) {
        case 400:
          // Bad Request - Erros de validação
          console.error('[PersonalBudget API] Validation Error:', {
            message: data.message,
            validations: data.validations,
          });
          break;
        
        case 404:
          // Not Found
          console.error('[PersonalBudget API] Resource not found');
          break;
        
        case 500:
          // Internal Server Error
          console.error('[PersonalBudget API] Internal server error');
          break;
        
        default:
          console.error('[PersonalBudget API] Error:', status, data);
      }
    } else if (error.request) {
      // Requisição foi feita mas não houve resposta
      console.error('[PersonalBudget API] No response received:', error.message);
      console.error('Certifique-se de que o backend está rodando em:', ENV.PERSONALBUDGET_API_URL);
    } else {
      // Erro na configuração da requisição
      console.error('[PersonalBudget API] Request setup error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// Helper para extrair mensagens de erro
export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiValidationError>;
    
    if (axiosError.response?.data?.message) {
      return axiosError.response.data.message;
    }
    
    if (axiosError.response?.status === 404) {
      return 'Recurso não encontrado';
    }
    
    if (axiosError.response?.status === 500) {
      return 'Erro interno do servidor';
    }
    
    if (!axiosError.response) {
      return 'Não foi possível conectar ao servidor. Verifique se o backend está rodando.';
    }
    
    return axiosError.message;
  }
  
  return 'Erro desconhecido';
};

// Helper para extrair erros de validação
export const getValidationErrors = (error: unknown): Record<string, string> | null => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiValidationError>;
    return axiosError.response?.data?.validations || null;
  }
  return null;
};
