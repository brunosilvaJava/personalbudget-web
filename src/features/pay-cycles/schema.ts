import { z } from 'zod'

import type {
  IncomeScheduleResponse,
  ISODate,
  PayCycleAnchorTransitionPreviewRequest,
  PayCycleResponse,
} from '@/api/contracts'
import {
  BUSINESS_WEEKS,
  DATE_RULE_TYPES,
  NON_BUSINESS_DAY_POLICIES,
  PAY_CYCLE_TRANSITION_SHAPES,
} from '@/api/contracts'
import { RULE_VALUE_RANGE } from '@/features/income/rules'
import { shiftDate, todayIso } from '@/lib/dates'
import { formatDate } from '@/lib/format'
import { JUSTIFICATION_MAX_LENGTH } from './rules'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

// ───────────────────────── Justification ─────────────────────────

/** Asked before every change of the cycles that goes to the history. */
export const justificationSchema = z.object({
  justification: z
    .string()
    .trim()
    .min(1, 'Explique o motivo: ele fica no histórico.')
    .max(JUSTIFICATION_MAX_LENGTH, `No máximo ${JUSTIFICATION_MAX_LENGTH} letras.`),
})
export type JustificationFormInput = z.input<typeof justificationSchema>
export type JustificationFormValues = z.output<typeof justificationSchema>

// ───────────────────────── Activation ─────────────────────────

/** The back accepts a first day up to this many days before or after today. */
export const ACTIVATION_WINDOW_DAYS = 31

export function activationWindow(today: ISODate = todayIso()) {
  return {
    earliest: shiftDate(today, -ACTIVATION_WINDOW_DAYS),
    latest: shiftDate(today, ACTIVATION_WINDOW_DAYS),
  }
}

export function activationSchema(today: ISODate = todayIso()) {
  const { earliest, latest } = activationWindow(today)
  return z.object({
    initial_date: z
      .string()
      .regex(DATE, 'Informe a data.')
      .refine((value) => !DATE.test(value) || (value >= earliest && value <= latest), {
        message: `Use uma data entre ${formatDate(earliest)} e ${formatDate(latest)}.`,
      }),
  })
}
export type ActivationFormInput = z.input<ReturnType<typeof activationSchema>>
export type ActivationFormValues = z.output<ReturnType<typeof activationSchema>>
export const ACTIVATION_FIELDS = ['initial_date'] as const

// ───────────────────────── Boundary adjustment ─────────────────────────

/**
 * The day the NEXT cycle opens, which is also the exclusive end of this one. It has to leave a day
 * in each of the two cycles. `nextEnd` is the end of the next cycle when it is known.
 */
export function endAdjustmentSchema(
  cycle: Pick<PayCycleResponse, 'start_date' | 'end_date_exclusive'>,
  nextEnd: ISODate | null,
) {
  const earliest = shiftDate(cycle.start_date, 1)
  const latest = nextEnd ? shiftDate(nextEnd, -1) : null
  return z
    .object({ new_end_date: z.string().regex(DATE, 'Informe a data.') })
    .superRefine((value, ctx) => {
      if (!DATE.test(value.new_end_date)) return
      const date = value.new_end_date
      if (date === cycle.end_date_exclusive) {
        ctx.addIssue({
          code: 'custom',
          path: ['new_end_date'],
          message: `Escolha uma data diferente de hoje (${formatDate(cycle.end_date_exclusive)}).`,
        })
      } else if (date < earliest || (latest !== null && date > latest)) {
        ctx.addIssue({
          code: 'custom',
          path: ['new_end_date'],
          message: latest
            ? `Use uma data entre ${formatDate(earliest)} e ${formatDate(latest)}, para nenhum dos dois ciclos ficar vazio.`
            : `A data precisa ser depois de ${formatDate(cycle.start_date)}.`,
        })
      }
    })
}
export type EndAdjustmentFormInput = z.input<ReturnType<typeof endAdjustmentSchema>>
export type EndAdjustmentFormValues = z.output<ReturnType<typeof endAdjustmentSchema>>
export const END_ADJUSTMENT_FIELDS = [
  'new_end_date',
  'justification',
  'expected_version',
  'expected_next_version',
] as const

// ───────────────────────── Anchor transition ─────────────────────────

/** Switch to another active schedule, or change the rule of the current anchor. */
export const ANCHOR_TRANSITION_MODES = ['switch', 'rule'] as const
export type AnchorTransitionMode = (typeof ANCHOR_TRANSITION_MODES)[number]

export function anchorTransitionSchema(anchor: IncomeScheduleResponse) {
  return z
    .object({
      mode: z.enum(ANCHOR_TRANSITION_MODES),
      anchor_schedule_code: z.string().nullable(),
      rule_type: z.enum(DATE_RULE_TYPES),
      rule_value: z.number({ error: 'Informe o dia.' }).int('Use um número inteiro.'),
      business_week: z.enum(BUSINESS_WEEKS),
      /** only read for FIXED_DAY */
      non_business_day_policy: z.enum(NON_BUSINESS_DAY_POLICIES),
      /** empty means no end */
      end_month: z.string().refine((value) => value === '' || MONTH.test(value), {
        message: 'Informe o mês do fim (aaaa-mm).',
      }),
      transition_shape: z.enum(PAY_CYCLE_TRANSITION_SHAPES).nullable(),
    })
    .superRefine((value, ctx) => {
      if (value.mode === 'switch') {
        if (!value.anchor_schedule_code) {
          ctx.addIssue({
            code: 'custom',
            path: ['anchor_schedule_code'],
            message: 'Escolha a nova receita âncora.',
          })
        }
        return
      }
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
        return
      }
      if (Object.keys(toAnchorTransitionRequest(value, anchor)).length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['rule_value'],
          message: 'Mude ao menos um campo da regra, ou escolha outra receita.',
        })
      }
    })
}
export type AnchorTransitionFormInput = z.input<ReturnType<typeof anchorTransitionSchema>>
export type AnchorTransitionFormValues = z.output<ReturnType<typeof anchorTransitionSchema>>
export const ANCHOR_TRANSITION_FIELDS = [
  'anchor_schedule_code',
  'rule_type',
  'rule_value',
  'business_week',
  'non_business_day_policy',
  'end_month',
  'remove_end_month',
  'transition_shape',
  'justification',
  'expected_version',
] as const

export function anchorTransitionDefaults(
  anchor: IncomeScheduleResponse,
  canSwitch: boolean,
): AnchorTransitionFormInput {
  return {
    mode: canSwitch ? 'switch' : 'rule',
    anchor_schedule_code: null,
    rule_type: anchor.rule_type,
    rule_value: anchor.rule_value,
    business_week: anchor.business_week,
    non_business_day_policy: anchor.non_business_day_policy ?? 'ANTICIPATE',
    end_month: anchor.end_month ?? '',
    transition_shape: null,
  }
}

/**
 * Switching sends only the new schedule. Changing the rule sends only what changed (the back
 * refuses to mix a new rule with another schedule); a cleared end month is `remove_end_month`.
 * The shape goes whenever it was chosen.
 */
export function toAnchorTransitionRequest(
  values: Pick<
    AnchorTransitionFormValues,
    | 'mode'
    | 'anchor_schedule_code'
    | 'rule_type'
    | 'rule_value'
    | 'business_week'
    | 'non_business_day_policy'
    | 'end_month'
    | 'transition_shape'
  >,
  anchor: IncomeScheduleResponse,
): PayCycleAnchorTransitionPreviewRequest {
  const body: PayCycleAnchorTransitionPreviewRequest = {}
  if (values.mode === 'switch') {
    if (values.anchor_schedule_code) body.anchor_schedule_code = values.anchor_schedule_code
  } else {
    if (values.rule_type !== anchor.rule_type) body.rule_type = values.rule_type
    if (values.rule_value !== anchor.rule_value) body.rule_value = values.rule_value
    if (values.business_week !== anchor.business_week) body.business_week = values.business_week
    if (
      values.rule_type === 'FIXED_DAY' &&
      values.non_business_day_policy !== anchor.non_business_day_policy
    ) {
      body.non_business_day_policy = values.non_business_day_policy
    }
    if (values.end_month && values.end_month !== anchor.end_month) body.end_month = values.end_month
    if (!values.end_month && anchor.end_month) body.remove_end_month = true
  }
  if (values.transition_shape) body.transition_shape = values.transition_shape
  return body
}
