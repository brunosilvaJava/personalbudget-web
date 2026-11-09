import type { FinancialMovementStatus, OperationType } from '@/api/contracts'

/** Labels follow the direction of the money: an expense is "Paga", a revenue is "Recebida". */
export function statusLabel(status: FinancialMovementStatus, operationType: OperationType): string {
  switch (status) {
    case 'PAID_OUT':
      return operationType === 'CREDIT' ? 'Recebida' : 'Paga'
    case 'LATE':
      return 'Atrasada'
    case 'PENDING':
      return operationType === 'CREDIT' ? 'A receber' : 'Pendente'
  }
}
