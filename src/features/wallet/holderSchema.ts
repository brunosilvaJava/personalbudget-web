import { z } from 'zod'

import type {
  CreditCardHolderRequest,
  CreditCardHolderResponse,
  CreditCardHolderUpdateRequest,
  CreditCardPlasticKind,
  CreditCardPlasticRequest,
  CreditCardPlasticResponse,
  CreditCardPlasticStatus,
  CreditCardPlasticUpdateRequest,
} from '@/api/contracts'

// ───────────────────────── Holder ─────────────────────────

export const holderSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome.').max(80, 'No máximo 80 letras.'),
})

export type HolderFormInput = z.input<typeof holderSchema>
export type HolderFormValues = z.output<typeof holderSchema>
export const HOLDER_FIELDS = ['name'] as const

export function holderDefaults(holder?: CreditCardHolderResponse): HolderFormInput {
  return { name: holder?.name ?? '' }
}

export function toHolderRequest(values: HolderFormValues): CreditCardHolderRequest {
  return { name: values.name }
}

export function toHolderUpdate(
  holder: CreditCardHolderResponse,
  values: HolderFormValues,
): CreditCardHolderUpdateRequest {
  return values.name !== holder.name ? { name: values.name } : {}
}

// ───────────────────────── Plastic ─────────────────────────

export const plasticSchema = z.object({
  holder_code: z.string().min(1, 'Escolha o titular.'),
  last_digits: z.string().regex(/^\d{4}$/, 'Informe os 4 últimos dígitos.'),
  kind: z.enum(['PHYSICAL', 'VIRTUAL', 'UNKNOWN']),
  status: z.enum(['ACTIVE', 'REPLACED', 'INACTIVE']),
})

export type PlasticFormInput = z.input<typeof plasticSchema>
export type PlasticFormValues = z.output<typeof plasticSchema>
export const PLASTIC_FIELDS = ['holder_code', 'last_digits', 'kind', 'status'] as const

export function plasticDefaults(
  plastic?: CreditCardPlasticResponse,
  holderCode?: string,
): PlasticFormInput {
  return {
    holder_code: plastic?.holder_code ?? holderCode ?? '',
    last_digits: plastic?.last_digits ?? '',
    kind: plastic?.kind ?? 'UNKNOWN',
    status: plastic?.status ?? 'ACTIVE',
  }
}

export function toPlasticRequest(values: PlasticFormValues): CreditCardPlasticRequest {
  return {
    holder_code: values.holder_code,
    last_digits: values.last_digits,
    kind: values.kind as CreditCardPlasticKind,
  }
}

/** Only the kind and the status can change: the holder and the digits are the plastic's identity. */
export function toPlasticUpdate(
  plastic: CreditCardPlasticResponse,
  values: PlasticFormValues,
): CreditCardPlasticUpdateRequest {
  const body: CreditCardPlasticUpdateRequest = {}
  if (values.kind !== plastic.kind) body.kind = values.kind as CreditCardPlasticKind
  if (values.status !== plastic.status) body.status = values.status as CreditCardPlasticStatus
  return body
}
