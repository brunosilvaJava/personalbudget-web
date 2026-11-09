import {
  endpoints,
  type BudgetEnvelopeRequest,
  type BudgetEnvelopeResponse,
  type BudgetEnvelopeUpdateRequest,
  type CycleEnvelopesResponse,
  type UUID,
} from './contracts'
import { request } from './http'

/**
 * The active envelopes of a cycle with what was consumed, and the totals. The numbers come from the
 * cycle report, so they match its /summary. 404 when the cycle does not exist.
 */
export function listCycleEnvelopes(
  cycleCode: UUID,
  signal?: AbortSignal,
): Promise<CycleEnvelopesResponse> {
  return request(`${endpoints.payCycle}/${cycleCode}/envelope`, { signal })
}

/** 400 amount or category; 409 the category already has one in the cycle, or the cycle is closed or cancelled. */
export function createEnvelope(
  cycleCode: UUID,
  body: BudgetEnvelopeRequest,
): Promise<BudgetEnvelopeResponse> {
  return request(`${endpoints.payCycle}/${cycleCode}/envelope`, { method: 'POST', body })
}

/** Only the planned amount changes; the category does not (delete and create another). */
export function updateEnvelope(
  code: UUID,
  body: BudgetEnvelopeUpdateRequest,
): Promise<BudgetEnvelopeResponse> {
  return request(`${endpoints.envelope}/${code}`, { method: 'PATCH', body })
}

/** Idempotent: an envelope that is already gone answers 204 as well. 409 in a closed cycle. */
export function deleteEnvelope(code: UUID): Promise<void> {
  return request(`${endpoints.envelope}/${code}`, { method: 'DELETE' })
}
