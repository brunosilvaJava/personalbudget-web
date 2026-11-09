import type { BudgetEnvelopeResponse, PayCycleResponse } from '@/api/contracts'
import { formatMoney } from '@/lib/format'

export type EnvelopeState = 'ok' | 'near' | 'over'

/** From this share of the planned amount on, the envelope is about to run out. */
const NEAR_SHARE = 0.85

/** consumed / planned, held between 0 and 1 for the bar. */
export function usedShare(envelope: BudgetEnvelopeResponse): number {
  if (envelope.planned_amount <= 0) return 1
  return Math.min(1, Math.max(0, envelope.consumed_amount / envelope.planned_amount))
}

/** "over": spent more than planned (the back says so in overrun_amount). */
export function envelopeState(envelope: BudgetEnvelopeResponse): EnvelopeState {
  if (envelope.overrun_amount > 0) return 'over'
  return usedShare(envelope) >= NEAR_SHARE ? 'near' : 'ok'
}

/** "Restam R$ 120,00" while there is something left, "Estourou R$ 35,00" when it ran over. */
export function describeRemaining(envelope: BudgetEnvelopeResponse): string {
  if (envelope.overrun_amount > 0) return `Estourou ${formatMoney(envelope.overrun_amount)}`
  return `Restam ${formatMoney(envelope.remaining_amount)}`
}

/** "Pago R$ 80,00 · A pagar R$ 40,00": what the consumption is made of. */
export function describeConsumption(envelope: BudgetEnvelopeResponse): string {
  return `Pago ${formatMoney(envelope.recognized_amount)} · A pagar ${formatMoney(envelope.committed_amount)}`
}

/** Why the envelopes of a cycle can only be read, or null when they can be changed. */
export function readOnlyReason(cycle: PayCycleResponse): string | null {
  if (cycle.status === 'CLOSED')
    return 'Este ciclo está fechado: os envelopes só podem ser consultados.'
  if (cycle.status === 'CANCELLED') {
    return 'Este ciclo foi cancelado: os envelopes só podem ser consultados.'
  }
  return null
}
