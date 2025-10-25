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
}

export interface FinancialMovementFilters {
  description?: string;
  operationTypes?: OperationType[];
  statuses?: FinancialMovementStatus[];
  startDate: string;
  endDate: string;
}
