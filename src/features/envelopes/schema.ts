import { z } from 'zod'

import type {
  BudgetEnvelopeRequest,
  BudgetEnvelopeResponse,
  BudgetEnvelopeUpdateRequest,
} from '@/api/contracts'
import { amountSchema } from '@/features/movements/schema'
import { fromCents, toCents } from '@/lib/money'

export const envelopeSchema = z.object({
  category_code: z.string().min(1, 'Escolha a categoria.'),
  /** cents */
  planned_amount: amountSchema,
})

export type EnvelopeFormInput = z.input<typeof envelopeSchema>
export type EnvelopeFormValues = z.output<typeof envelopeSchema>
/** The field names the back's 400 can point at (snake_case: the back converts the camelCase). */
export const ENVELOPE_FIELDS = ['category_code', 'planned_amount'] as const

export function envelopeDefaults(envelope?: BudgetEnvelopeResponse): EnvelopeFormInput {
  return {
    category_code: envelope?.category_code ?? '',
    planned_amount: envelope ? toCents(envelope.planned_amount) : (null as unknown as number),
  }
}

export function toEnvelopeRequest(values: EnvelopeFormValues): BudgetEnvelopeRequest {
  return { category_code: values.category_code, planned_amount: fromCents(values.planned_amount) }
}

export function toEnvelopeUpdate(values: EnvelopeFormValues): BudgetEnvelopeUpdateRequest {
  return { planned_amount: fromCents(values.planned_amount) }
}
