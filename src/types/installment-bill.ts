export type OperationType = 'DEBIT' | 'CREDIT';
export type InstallmentBillStatus = 'PENDING' | 'DONE' | 'CANCELED';

export interface InstallmentBill {
  code: string;
  operation_type: OperationType;
  description: string;
  amount: number;
  status: InstallmentBillStatus;
  purchase_date: string;
  installment_total: number;
  installment_count?: number;
  last_installment_date?: string;
  next_installment_date?: string;
}

export interface InstallmentBillRequest {
  operation_type: OperationType;
  description: string;
  amount: number;
  purchase_date: string;
  installment_total: number;
}

export interface InstallmentBillUpdateRequest {
  operation_type?: OperationType;
  description?: string;
  amount?: number;
  purchase_date?: string;
  installment_total?: number;
}

export interface InstallmentBillFilters {
  description?: string;
  operation_type?: OperationType[];
  status?: InstallmentBillStatus[];
  page?: number;
  size?: number;
  sortBy?: string;
  sortDirection?: 'ASC' | 'DESC';
}

export interface PagedInstallmentBillResponse {
  content: InstallmentBill[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}