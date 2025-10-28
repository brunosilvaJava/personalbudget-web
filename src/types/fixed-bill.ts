export type OperationType = 'DEBIT' | 'CREDIT';
export type RecurrenceType = 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type FixedBillStatus = 'ACTIVE' | 'INACTIVE';

export interface FixedBill {
  code: string;
  operation_type: OperationType;
  description: string;
  amount: number;
  recurrence_type: RecurrenceType;
  days: number[];
  reference_year?: number;
  status: FixedBillStatus;
  start_date: string;
  end_date?: string;
}

export interface FixedBillRequest {
  operation_type: OperationType;
  description: string;
  amount: number;
  recurrence_type: RecurrenceType;
  days: number[];
  reference_year?: number;
  start_date: string;
  end_date?: string;
}

export interface FixedBillUpdateRequest {
  operation_type?: OperationType;
  description?: string;
  amount?: number;
  recurrence_type?: RecurrenceType;
  days?: number[];
  reference_year?: number;
  status?: FixedBillStatus;
  start_date?: string;
  end_date?: string;
}

export interface FixedBillFilters {
  description?: string;
  operation_type?: OperationType[];
  status?: FixedBillStatus[];
  recurrence_type?: RecurrenceType[];
  page?: number;
  size?: number;
  sortBy?: string;
  sortDirection?: 'ASC' | 'DESC';
}

export interface PagedFixedBillResponse {
  content: FixedBill[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}
