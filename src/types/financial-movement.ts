export type OperationType = 'CREDIT' | 'DEBIT';
export type FinancialMovementStatus = 'PENDING' | 'PAID_OUT' | 'LATE';

export interface FinancialMovement {
  code: string;
  operationType: OperationType;
  description: string;
  amount: number;
  amountPaid: number;
  movementDate: string;
  dueDate: string;
  payDate: string | null;
  status: FinancialMovementStatus;
  createdDate: string;
  lastModifiedDate: string;
}

export interface FinancialMovementRequest {
  operationType: OperationType;
  description: string;
  amount: number;
  amountPaid?: number;
  movementDate: string;
  dueDate: string;
  payDate?: string;
  status: FinancialMovementStatus;
}

export interface FinancialMovementFilters {
  description?: string;
  operationTypes?: OperationType[];
  statuses?: FinancialMovementStatus[];
  startDate: string;
  endDate: string;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDirection?: 'ASC' | 'DESC';
}

export interface PagedFinancialMovementResponse {
  content: FinancialMovement[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}