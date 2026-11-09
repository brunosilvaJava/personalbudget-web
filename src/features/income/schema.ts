import { z } from 'zod'

import type {
  HolidayRequest,
  HolidayResponse,
  IncomeScheduleRequest,
  IncomeScheduleResponse,
  IncomeScheduleUpdateRequest,
} from '@/api/contracts'
import { BUSINESS_WEEKS, DATE_RULE_TYPES, NON_BUSINESS_DAY_POLICIES } from '@/api/contracts'
import { amountSchema } from '@/features/movements/schema'
import { currentMonth } from '@/lib/dates'
import { fromCents, toCents } from '@/lib/money'
import { RULE_VALUE_RANGE } from './rules'

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

// ───────────────────────── Income schedule ─────────────────────────

/**
 * `editing` relaxes the start month: it cannot be changed after the schedule exists, and one that
 * started in the past is fine. Creating requires the current month or later (past receipts are
 * registered as movements, the back answers 400 otherwise).
 */
export function incomeScheduleSchema(editing: boolean) {
  return z
    .object({
      description: z
        .string()
        .trim()
        .min(3, 'Use ao menos 3 letras.')
        .max(50, 'No máximo 50 letras.'),
      /** cents */
      amount: amountSchema,
      category_code: z.string().nullable(),
      rule_type: z.enum(DATE_RULE_TYPES),
      rule_value: z.number({ error: 'Informe o dia.' }).int('Use um número inteiro.'),
      business_week: z.enum(BUSINESS_WEEKS),
      /** only read for FIXED_DAY */
      non_business_day_policy: z.enum(NON_BUSINESS_DAY_POLICIES),
      start_month: z.string().regex(MONTH, 'Informe o mês de início.'),
      /** empty means no end */
      end_month: z.string().refine((value) => value === '' || MONTH.test(value), {
        message: 'Informe o mês do fim (aaaa-mm).',
      }),
      anchor: z.boolean(),
      replaces_fixed_bill_code: z.string().nullable(),
    })
    .superRefine((value, ctx) => {
      const { min, max } = RULE_VALUE_RANGE[value.rule_type]
      if (
        Number.isInteger(value.rule_value) &&
        (value.rule_value < min || value.rule_value > max)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['rule_value'],
          message:
            value.rule_type === 'FIXED_DAY' ? 'Use um dia de 1 a 31.' : 'Use de 1º a 15º dia útil.',
        })
      }
      if (!editing && MONTH.test(value.start_month) && value.start_month < currentMonth()) {
        ctx.addIssue({
          code: 'custom',
          path: ['start_month'],
          message:
            'O início não pode ser antes deste mês. Receitas passadas entram como lançamentos.',
        })
      }
      if (
        MONTH.test(value.end_month) &&
        MONTH.test(value.start_month) &&
        value.end_month < value.start_month
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['end_month'],
          message: 'O fim não pode ser antes do início.',
        })
      }
    })
}

export type IncomeScheduleFormInput = z.input<ReturnType<typeof incomeScheduleSchema>>
export type IncomeScheduleFormValues = z.output<ReturnType<typeof incomeScheduleSchema>>
export const INCOME_SCHEDULE_FIELDS = [
  'description',
  'amount',
  'category_code',
  'rule_type',
  'rule_value',
  'business_week',
  'non_business_day_policy',
  'start_month',
  'end_month',
  'anchor',
  'replaces_fixed_bill_code',
] as const

export function incomeScheduleDefaults(schedule?: IncomeScheduleResponse): IncomeScheduleFormInput {
  if (!schedule) {
    return {
      description: '',
      amount: null as unknown as number,
      category_code: null,
      rule_type: 'FIXED_DAY',
      rule_value: null as unknown as number,
      business_week: 'MONDAY_TO_FRIDAY',
      non_business_day_policy: 'ANTICIPATE',
      start_month: currentMonth(),
      end_month: '',
      anchor: false,
      replaces_fixed_bill_code: null,
    }
  }
  return {
    description: schedule.description,
    amount: toCents(schedule.amount),
    category_code: schedule.category_code,
    rule_type: schedule.rule_type,
    rule_value: schedule.rule_value,
    business_week: schedule.business_week,
    non_business_day_policy: schedule.non_business_day_policy ?? 'ANTICIPATE',
    start_month: schedule.start_month,
    end_month: schedule.end_month ?? '',
    anchor: schedule.anchor,
    replaces_fixed_bill_code: schedule.replaces_fixed_bill_code,
  }
}

export function toIncomeScheduleRequest(values: IncomeScheduleFormValues): IncomeScheduleRequest {
  const body: IncomeScheduleRequest = {
    description: values.description,
    amount: fromCents(values.amount),
    rule_type: values.rule_type,
    rule_value: values.rule_value,
    business_week: values.business_week,
    start_month: values.start_month,
  }
  // The policy only exists for a fixed day; the back ignores it for the N-th business day.
  if (values.rule_type === 'FIXED_DAY')
    body.non_business_day_policy = values.non_business_day_policy
  if (values.category_code) body.category_code = values.category_code
  if (values.end_month) body.end_month = values.end_month
  if (values.anchor) body.anchor = true
  if (values.replaces_fixed_bill_code) {
    body.replaces_fixed_bill_code = values.replaces_fixed_bill_code
  }
  return body
}

/**
 * Only what changed. The start month and the fixed bill it replaced do not change; the category
 * can be replaced but not removed (null means "keep"); an end month that was cleared goes as
 * `remove_end_month`.
 */
export function toIncomeScheduleUpdate(
  schedule: IncomeScheduleResponse,
  values: IncomeScheduleFormValues,
): IncomeScheduleUpdateRequest {
  const body: IncomeScheduleUpdateRequest = {}
  if (values.description !== schedule.description) body.description = values.description
  if (values.amount !== toCents(schedule.amount)) body.amount = fromCents(values.amount)
  if (values.category_code && values.category_code !== schedule.category_code) {
    body.category_code = values.category_code
  }
  if (values.rule_type !== schedule.rule_type) body.rule_type = values.rule_type
  if (values.rule_value !== schedule.rule_value) body.rule_value = values.rule_value
  if (values.business_week !== schedule.business_week) body.business_week = values.business_week
  if (
    values.rule_type === 'FIXED_DAY' &&
    values.non_business_day_policy !== schedule.non_business_day_policy
  ) {
    body.non_business_day_policy = values.non_business_day_policy
  }
  if (values.end_month && values.end_month !== schedule.end_month) body.end_month = values.end_month
  if (!values.end_month && schedule.end_month) body.remove_end_month = true
  if (values.anchor !== schedule.anchor) body.anchor = values.anchor
  return body
}

// ───────────────────────── Holiday calendar ─────────────────────────

/** The holidays of ONE year, as the form edits them. The date must fall in `year`. */
export function holidayYearSchema(year: number) {
  return z
    .object({
      holidays: z.array(
        z.object({
          date: z
            .string()
            .regex(DATE, 'Informe a data.')
            .refine((value) => !DATE.test(value) || value.startsWith(`${year}-`), {
              message: `A data precisa ser de ${year}.`,
            }),
          name: z.string().trim().min(1, 'Dê um nome.').max(100, 'No máximo 100 letras.'),
        }),
      ),
    })
    .superRefine((value, ctx) => {
      const seen = new Set<string>()
      value.holidays.forEach((holiday, index) => {
        if (seen.has(holiday.date)) {
          ctx.addIssue({
            code: 'custom',
            path: ['holidays', index, 'date'],
            message: 'Já há um feriado nesta data.',
          })
        }
        seen.add(holiday.date)
      })
    })
}

export type HolidayYearFormInput = z.input<ReturnType<typeof holidayYearSchema>>
export type HolidayYearFormValues = z.output<ReturnType<typeof holidayYearSchema>>

export function holidayYearDefaults(holidays: readonly HolidayResponse[]): HolidayYearFormInput {
  return { holidays: holidays.map(({ date, name }) => ({ date, name })) }
}

/** By date, as the back keeps them. */
export function toHolidayRequests(values: HolidayYearFormValues): HolidayRequest[] {
  return [...values.holidays]
    .map(({ date, name }) => ({ date, name }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
