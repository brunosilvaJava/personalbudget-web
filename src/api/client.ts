import axios, { AxiosError } from 'axios';
import { ENV } from '@/config/env';

export interface ApiValidationError {
  message: string;
  validations: Record<string, string>;
}

export interface ApiError {
  message: string;
  status: number;
  validations?: Record<string, string>;
}

export const apiClient = axios.create({
  baseURL: ENV.PERSONALBUDGET_API_URL,
  headers: {
    'Content-Type': 'application/json; charset=UTF-8',
    'Accept': 'application/json',
  },
  timeout: 10000,
});

apiClient.interceptors.request.use(
  (config) => {
    const method = config.method?.toUpperCase();
    const url = config.url;
    console.log(`[PersonalBudget API] 🚀 ${method} ${url}`);
    
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

      switch (status) {
        case 400:
          console.error('[PersonalBudget API] Validation Error:', {
            message: data.message,
            validations: data.validations,
          });
          break;
        case 404:
          console.error('[PersonalBudget API] Resource not found');
          break;
        case 500:
          console.error('[PersonalBudget API] Internal server error');
          break;
        default:
          console.error('[PersonalBudget API] Error:', status, data);
      }
    } else if (error.request) {
      console.error('[PersonalBudget API] No response received:', error.message);
      console.error('Certifique-se de que o backend está rodando em:', ENV.PERSONALBUDGET_API_URL);
    } else {
      console.error('[PersonalBudget API] Request setup error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

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
      return 'Ocorreu um erro inesperado. Contate o administrador do sistema.';
    }
    
    return axiosError.message;
  }
  
  return 'Erro desconhecido';
};

export const getValidationErrors = (error: unknown): Record<string, string> | null => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiValidationError>;
    return axiosError.response?.data?.validations || null;
  }
  return null;
};
