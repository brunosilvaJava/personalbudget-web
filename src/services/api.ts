import apiClient from './apiClient';
import type {
  Transaction,
  Category,
  Budget,
  DashboardStats,
  ApiResponse,
  PaginatedResponse,
} from '../types/api';

// Transaction API endpoints
export const transactionService = {
  // Get all transactions with optional pagination
  getAll: async (page = 1, pageSize = 10) => {
    const response = await apiClient.get<PaginatedResponse<Transaction>>(
      `/transactions?page=${page}&pageSize=${pageSize}`
    );
    return response.data;
  },

  // Get a single transaction by ID
  getById: async (id: number) => {
    const response = await apiClient.get<ApiResponse<Transaction>>(`/transactions/${id}`);
    return response.data;
  },

  // Create a new transaction
  create: async (transaction: Omit<Transaction, 'id'>) => {
    const response = await apiClient.post<ApiResponse<Transaction>>('/transactions', transaction);
    return response.data;
  },

  // Update an existing transaction
  update: async (id: number, transaction: Partial<Transaction>) => {
    const response = await apiClient.put<ApiResponse<Transaction>>(
      `/transactions/${id}`,
      transaction
    );
    return response.data;
  },

  // Delete a transaction
  delete: async (id: number) => {
    const response = await apiClient.delete<ApiResponse<void>>(`/transactions/${id}`);
    return response.data;
  },

  // Get transactions by type (INCOME or EXPENSE)
  getByType: async (type: 'INCOME' | 'EXPENSE', page = 1, pageSize = 10) => {
    const response = await apiClient.get<PaginatedResponse<Transaction>>(
      `/transactions/type/${type}?page=${page}&pageSize=${pageSize}`
    );
    return response.data;
  },

  // Get transactions by date range
  getByDateRange: async (startDate: string, endDate: string) => {
    const response = await apiClient.get<ApiResponse<Transaction[]>>(
      `/transactions/range?start=${startDate}&end=${endDate}`
    );
    return response.data;
  },
};

// Category API endpoints
export const categoryService = {
  // Get all categories
  getAll: async () => {
    const response = await apiClient.get<ApiResponse<Category[]>>('/categories');
    return response.data;
  },

  // Get a single category by ID
  getById: async (id: number) => {
    const response = await apiClient.get<ApiResponse<Category>>(`/categories/${id}`);
    return response.data;
  },

  // Create a new category
  create: async (category: Omit<Category, 'id'>) => {
    const response = await apiClient.post<ApiResponse<Category>>('/categories', category);
    return response.data;
  },

  // Update an existing category
  update: async (id: number, category: Partial<Category>) => {
    const response = await apiClient.put<ApiResponse<Category>>(`/categories/${id}`, category);
    return response.data;
  },

  // Delete a category
  delete: async (id: number) => {
    const response = await apiClient.delete<ApiResponse<void>>(`/categories/${id}`);
    return response.data;
  },
};

// Budget API endpoints
export const budgetService = {
  // Get all budgets
  getAll: async () => {
    const response = await apiClient.get<ApiResponse<Budget[]>>('/budgets');
    return response.data;
  },

  // Get a single budget by ID
  getById: async (id: number) => {
    const response = await apiClient.get<ApiResponse<Budget>>(`/budgets/${id}`);
    return response.data;
  },

  // Create a new budget
  create: async (budget: Omit<Budget, 'id'>) => {
    const response = await apiClient.post<ApiResponse<Budget>>('/budgets', budget);
    return response.data;
  },

  // Update an existing budget
  update: async (id: number, budget: Partial<Budget>) => {
    const response = await apiClient.put<ApiResponse<Budget>>(`/budgets/${id}`, budget);
    return response.data;
  },

  // Delete a budget
  delete: async (id: number) => {
    const response = await apiClient.delete<ApiResponse<void>>(`/budgets/${id}`);
    return response.data;
  },
};

// Dashboard API endpoints
export const dashboardService = {
  // Get dashboard statistics
  getStats: async () => {
    const response = await apiClient.get<ApiResponse<DashboardStats>>('/dashboard/stats');
    return response.data;
  },

  // Get monthly statistics for a specific year
  getMonthlyStats: async (year: number) => {
    const response = await apiClient.get<ApiResponse<DashboardStats[]>>(
      `/dashboard/monthly/${year}`
    );
    return response.data;
  },
};
