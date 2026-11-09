import type {
  ISOInstant,
  PayCycleResponse,
  PayCycleSnapshotResponse,
  PayCycleSummaryResponse,
} from '@/api/contracts'
import { PAY_CYCLE_CLOSURE_BLOCKERS } from '@/api/contracts'
import { ApiError } from '@/api/http'
import { errorMessage } from '@/lib/api-errors'
import { formatDate, formatTime } from '@/lib/format'

/** How many late movements the closure review lists before "e mais N". */
export const LATE_LISTED = 10

/** What the Fechamento section of a cycle offers, by status. */
export type ClosureOffer =
  /** PENDING_CLOSE: the cycle ended; close it */
  | 'close'
  /** OPEN: it has not ended; the review still says what is missing */
  | 'review'
  /** CLOSED: the snapshot and the reopen */
  | 'closed'
  /** PLANNED and CANCELLED: nothing to do */
  | 'none'

export function closureOffer(cycle: Pick<PayCycleResponse, 'status'>): ClosureOffer {
  switch (cycle.status) {
    case 'PENDING_CLOSE':
      return 'close'
    case 'OPEN':
      return 'review'
    case 'CLOSED':
      return 'closed'
    case 'PLANNED':
    case 'CANCELLED':
      return 'none'
  }
}

/** The preview is only asked for what the back can answer: it answers 409 for CLOSED and CANCELLED. */
export function canPreviewClosure(cycle: Pick<PayCycleResponse, 'status'>): boolean {
  return cycle.status === 'OPEN' || cycle.status === 'PENDING_CLOSE' || cycle.status === 'PLANNED'
}

const KNOWN_BLOCKERS: readonly string[] = PAY_CYCLE_CLOSURE_BLOCKERS

/** Short names, used inside the sentence of a 409 ("O ciclo não pode ser fechado: …"). */
export const CLOSURE_BLOCKER_SHORT: Record<(typeof PAY_CYCLE_CLOSURE_BLOCKERS)[number], string> = {
  PROJECTION_INCOMPLETE: 'projeção incompleta',
  LATE_MOVEMENTS: 'movimentações atrasadas',
  OVERDUE_PENDING_MOVEMENTS: 'movimentações pendentes vencidas',
  CYCLE_NOT_ENDED: 'ciclo ainda não terminou',
}

export interface BlockerText {
  title: string
  detail: string
}

/**
 * One blocker in words. The back can send a type this app does not know: it gets a generic line
 * with the code, so the person still sees that something blocks.
 */
export function describeBlocker(
  blocker: string,
  cycle: Pick<PayCycleResponse, 'last_day'>,
): BlockerText {
  switch (blocker) {
    case 'CYCLE_NOT_ENDED':
      return {
        title: 'O ciclo ainda não terminou',
        detail: `Ele vai até ${formatDate(cycle.last_day)}. Só dá para fechar depois desse dia.`,
      }
    case 'LATE_MOVEMENTS':
      return {
        title: 'Há movimentações atrasadas',
        detail: 'Pague, mude o vencimento ou exclua cada uma delas antes de fechar.',
      }
    case 'OVERDUE_PENDING_MOVEMENTS':
      return {
        title: 'Há movimentações pendentes que já venceram',
        detail: 'Elas ainda não viraram atrasadas. Pague, mude o vencimento ou exclua cada uma.',
      }
    case 'PROJECTION_INCOMPLETE':
      return {
        title: 'A projeção está incompleta',
        detail: 'Resolva as pendências abaixo para o relatório ficar completo antes de congelá-lo.',
      }
    default:
      return {
        title: 'Algo impede o fechamento',
        detail: `O back informou o motivo “${blocker}”, que este app ainda não conhece.`,
      }
  }
}

/**
 * The message of a failed closure, with the blocker codes the back writes ("LATE_MOVEMENTS,
 * OVERDUE_PENDING_MOVEMENTS") turned into words. Everything else is shown as the back wrote it.
 */
export function closureErrorMessage(error: unknown): string {
  const message = errorMessage(error)
  if (!(error instanceof ApiError) || error.status !== 409) return message
  return message.replace(/\b[A-Z]+(?:_[A-Z]+)+\b/g, (code) =>
    KNOWN_BLOCKERS.includes(code)
      ? CLOSURE_BLOCKER_SHORT[code as keyof typeof CLOSURE_BLOCKER_SHORT]
      : code,
  )
}

/**
 * The movements list that holds what blocks the closure: the period of the cycle, only the given
 * status. The list does not know "competência", so a movement near a boundary may show up in
 * the neighbouring cycle's list.
 */
export function blockedMovementsLink(
  cycle: Pick<PayCycleResponse, 'start_date' | 'last_day'>,
  status: 'atrasada' | 'pendente',
): string {
  const params = new URLSearchParams({
    inicio: cycle.start_date,
    fim: cycle.last_day,
    status,
  })
  return `/movimentacoes?${params.toString()}`
}

/** "10/11/2026 às 14:30" (the instant arrives in UTC; it is shown in the person's time). */
export function describeClosedAt(closedAt: ISOInstant): string {
  return `${formatDate(closedAt)} às ${formatTime(closedAt)}`
}

/** Newest version first: the first one is the closure in force while the cycle is CLOSED. */
export function newestSnapshotsFirst(
  snapshots: readonly PayCycleSnapshotResponse[],
): PayCycleSnapshotResponse[] {
  return [...snapshots].sort((a, b) => b.snapshot_version - a.snapshot_version)
}

/**
 * A snapshot in the shape of the cycle report, to show it with the same table and category
 * lists. A closed cycle never had an incomplete projection (the closure is blocked by it).
 */
export function snapshotAsSummary(
  snapshot: PayCycleSnapshotResponse,
  cycle: PayCycleResponse,
): PayCycleSummaryResponse {
  return {
    cycle,
    recognized_revenue: snapshot.recognized_revenue,
    recognized_expense: snapshot.recognized_expense,
    projected_revenue: snapshot.projected_revenue,
    projected_expense: snapshot.projected_expense,
    projection_incomplete: false,
    categories: snapshot.categories,
    pending: [],
  }
}
