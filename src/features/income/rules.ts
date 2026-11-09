import type {
  BusinessWeek,
  DateRuleType,
  IncomeOccurrenceResponse,
  IncomeOccurrenceState,
  IncomeScheduleResponse,
  NonBusinessDayPolicy,
} from '@/api/contracts'
import { formatDate, formatShortMonth } from '@/lib/format'

export const DATE_RULE_LABEL: Record<DateRuleType, string> = {
  FIXED_DAY: 'Dia fixo',
  NTH_BUSINESS_DAY: 'Dia útil',
}

export const BUSINESS_WEEK_LABEL: Record<BusinessWeek, string> = {
  MONDAY_TO_FRIDAY: 'Segunda a sexta',
  MONDAY_TO_SATURDAY: 'Segunda a sábado',
}

export const POLICY_LABEL: Record<NonBusinessDayPolicy, string> = {
  ANTICIPATE: 'Antecipar',
  POSTPONE: 'Adiar',
  KEEP: 'Manter',
}

/** What each policy does when the fixed day is not a business day. */
export const POLICY_HELP: Record<NonBusinessDayPolicy, string> = {
  ANTICIPATE: 'Se o dia não for útil, a receita cai no dia útil anterior.',
  POSTPONE: 'Se o dia não for útil, a receita cai no próximo dia útil.',
  KEEP: 'A receita fica no dia, mesmo que não seja útil.',
}

export const OCCURRENCE_STATE_LABEL: Record<IncomeOccurrenceState, string> = {
  MATERIALIZED: 'Lançada',
  PROJECTED: 'Prevista',
  CALENDAR_NOT_REVIEWED: 'Calendário não revisado',
  BUSINESS_DAY_NOT_FOUND: 'Sem esse dia útil',
}

/** The valid range of `rule_value` for each rule type (FIXED_DAY: a day of the month). */
export const RULE_VALUE_RANGE: Record<DateRuleType, { min: number; max: number }> = {
  FIXED_DAY: { min: 1, max: 31 },
  NTH_BUSINESS_DAY: { min: 1, max: 15 },
}

type RuleFields = Pick<
  IncomeScheduleResponse,
  'rule_type' | 'rule_value' | 'business_week' | 'non_business_day_policy'
>

/** "Dia 5 de cada mês, antecipada se não for dia útil" / "5º dia útil do mês". */
export function describeRule(rule: RuleFields): string {
  if (rule.rule_type === 'NTH_BUSINESS_DAY') {
    return `${rule.rule_value}º dia útil do mês`
  }
  const policy =
    rule.non_business_day_policy === 'ANTICIPATE'
      ? ', antecipada se não for dia útil'
      : rule.non_business_day_policy === 'POSTPONE'
        ? ', adiada se não for dia útil'
        : rule.non_business_day_policy === 'KEEP'
          ? ', mesmo em dia não útil'
          : ''
  return `Dia ${rule.rule_value} de cada mês${policy}`
}

/** "desde nov/2026" / "de nov/2026 a mar/2027". */
export function describeValidity(
  schedule: Pick<IncomeScheduleResponse, 'start_month' | 'end_month'>,
) {
  const start = formatShortMonth(schedule.start_month)
  return schedule.end_month
    ? `de ${start} a ${formatShortMonth(schedule.end_month)}`
    : `desde ${start}, sem fim`
}

/** Where an occurrence stands: its date, or why it has none. */
export function describeOccurrenceDate(occurrence: IncomeOccurrenceResponse): string {
  switch (occurrence.state) {
    case 'MATERIALIZED':
    case 'PROJECTED':
      return occurrence.planned_date ? formatDate(occurrence.planned_date) : '—'
    case 'CALENDAR_NOT_REVIEWED':
      return occurrence.pending_year
        ? `data não calculada: calendário de ${occurrence.pending_year} não revisado`
        : 'data não calculada: calendário não revisado'
    case 'BUSINESS_DAY_NOT_FOUND':
      return 'o mês não tem esse dia útil'
  }
}
