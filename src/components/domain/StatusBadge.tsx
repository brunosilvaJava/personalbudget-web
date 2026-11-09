import type { FinancialMovementStatus, OperationType } from '@/api/contracts'
import { Badge } from '@/components/ui/badge'
import { statusLabel } from '@/lib/labels'

/** The status the SERVER derived (LATE included); the front never works it out. */
export function StatusBadge({
  status,
  operationType,
}: {
  status: FinancialMovementStatus
  operationType: OperationType
}) {
  const variant = status === 'PAID_OUT' ? 'muted' : status === 'LATE' ? 'warning' : 'outline'
  return <Badge variant={variant}>{statusLabel(status, operationType)}</Badge>
}
