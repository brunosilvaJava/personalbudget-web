import type {
  PayCycleAdjustmentResponse,
  PayCycleAdjustmentType,
  PayCycleKind,
  PayCycleMode,
  PayCyclePendingResponse,
  PayCyclePendingType,
  PayCycleResponse,
  PayCycleStatus,
  PayCycleSummaryPendingResponse,
  PayCycleTransitionShape,
} from '@/api/contracts'
import { PAY_CYCLE_PENDING_TYPES } from '@/api/contracts'
import type { VariantProps } from 'class-variance-authority'

import type { badgeVariants } from '@/components/ui/badge'
import { formatDate, formatDateRange, formatMonth } from '@/lib/format'

export const MODE_LABEL: Record<PayCycleMode, string> = {
  CALENDAR_MONTH: 'Mês do calendário',
  PAY_CYCLE: 'Ciclos da receita âncora',
}

export const CYCLE_STATUS_LABEL: Record<PayCycleStatus, string> = {
  PLANNED: 'Planejado',
  OPEN: 'Aberto',
  PENDING_CLOSE: 'A fechar',
  CLOSED: 'Fechado',
  CANCELLED: 'Cancelado',
}

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>

export const CYCLE_STATUS_VARIANT: Record<PayCycleStatus, BadgeVariant> = {
  PLANNED: 'muted',
  OPEN: 'default',
  PENDING_CLOSE: 'warning',
  CLOSED: 'secondary',
  CANCELLED: 'muted',
}

export const CYCLE_KIND_LABEL: Record<PayCycleKind, string> = {
  REGULAR: 'Regular',
  TRANSITION: 'Transição',
}

export const ADJUSTMENT_TYPE_LABEL: Record<PayCycleAdjustmentType, string> = {
  MANUAL_BOUNDARY: 'Virada ajustada',
  ANCHOR_TRANSITION: 'Troca de âncora',
  ACTIVATION: 'Ciclos ligados',
  DEACTIVATION: 'Ciclos desligados',
}

export const SHAPE_LABEL: Record<PayCycleTransitionShape, string> = {
  SHORT: 'Curto',
  LONG: 'Longo',
}

/** What each shape of the transition cycle does when the anchor changes. */
export const SHAPE_HELP: Record<PayCycleTransitionShape, string> = {
  SHORT: 'Um ciclo de transição mais curto: vai até a primeira data da nova receita.',
  LONG: 'Um ciclo de transição mais longo: vai até a segunda data da nova receita.',
}

/** The longest justification the back keeps (it answers 400 above this). */
export const JUSTIFICATION_MAX_LENGTH = 500

/** "05/11 a 03/12 · 29 dias" (the last day is inclusive). */
export function describeCycleDates(
  cycle: Pick<PayCycleResponse, 'start_date' | 'last_day' | 'total_days'>,
) {
  return `${formatDateRange(cycle.start_date, cycle.last_day)} · ${cycle.total_days} ${cycle.total_days === 1 ? 'dia' : 'dias'}`
}

/** One line for a pendency of the pay cycles. */
export function describePayCyclePending(pending: PayCyclePendingResponse): string {
  switch (pending.type) {
    case 'BOUNDARY_DIVERGES_FROM_ANCHOR':
      return pending.boundary_date && pending.anchor_date
        ? `A virada de ${formatDate(pending.boundary_date)} fica diferente da receita âncora, que cai em ${formatDate(pending.anchor_date)}.`
        : 'Uma virada de ciclo fica diferente da receita âncora.'
    case 'CALENDAR_NOT_REVIEWED':
      return pending.year
        ? `O calendário de ${pending.year} não está revisado.`
        : 'Há um calendário não revisado.'
    case 'BUSINESS_DAY_NOT_FOUND':
      return pending.nominal_month
        ? `Em ${formatMonth(pending.nominal_month)}, o mês não tem o dia útil da receita âncora.`
        : 'Um mês não tem o dia útil da receita âncora.'
    case 'ANCHOR_SCHEDULE_ENDS':
      return pending.nominal_month
        ? `A receita âncora não cobre ${formatMonth(pending.nominal_month)}.`
        : 'A receita âncora termina antes do fim dos ciclos.'
    case 'NO_CURRENT_CYCLE':
      return 'Nenhum ciclo contém a data de hoje.'
  }
}

/** Where to go to fix a pendency, when there is a place for it. */
export function pendingAction(
  pending: PayCyclePendingResponse,
): { to: string; label: string } | null {
  switch (pending.type) {
    case 'CALENDAR_NOT_REVIEWED':
      return pending.year
        ? { to: `/receita/calendario?ano=${pending.year}`, label: `Revisar ${pending.year}` }
        : { to: '/receita/calendario', label: 'Abrir o calendário' }
    case 'BUSINESS_DAY_NOT_FOUND':
    case 'ANCHOR_SCHEDULE_ENDS':
      return { to: '/receita/agenda', label: 'Abrir a agenda de receita' }
    case 'BOUNDARY_DIVERGES_FROM_ANCHOR':
      return pending.cycle_code
        ? { to: `/ciclos/${pending.cycle_code}`, label: 'Abrir o ciclo' }
        : null
    case 'NO_CURRENT_CYCLE':
      return null
  }
}

function isPendingType(type: string): type is PayCyclePendingType {
  return (PAY_CYCLE_PENDING_TYPES as readonly string[]).includes(type)
}

/**
 * What keeps the projection of a cycle report incomplete. The back can send types this app does
 * not know: they get a generic line instead of an empty one.
 */
export function describeSummaryPending(pending: PayCycleSummaryPendingResponse): string {
  if (!isPendingType(pending.type)) return 'Há algo pendente que deixa a projeção incompleta.'
  return describePayCyclePending({
    type: pending.type,
    nominal_month: pending.nominal_month,
    year: pending.year,
    cycle_code: pending.source === 'PAY_CYCLE' ? pending.source_code : null,
    boundary_date: pending.boundary_date,
    anchor_date: pending.anchor_date,
  })
}

/** "04/12/2026 → 03/12/2026" for a boundary that moved; what was there before when it was only cancelled. */
export function describeAdjustment(adjustment: PayCycleAdjustmentResponse): string {
  if (adjustment.type === 'DEACTIVATION') {
    return adjustment.old_boundary
      ? `O primeiro ciclo cancelado começava em ${formatDate(adjustment.old_boundary)}.`
      : 'Nenhum ciclo futuro foi cancelado.'
  }
  if (adjustment.old_boundary && adjustment.new_boundary) {
    return `${formatDate(adjustment.old_boundary)} → ${formatDate(adjustment.new_boundary)}`
  }
  return ''
}
