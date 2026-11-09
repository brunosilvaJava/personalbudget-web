import {
  endpoints,
  toQueryString,
  type ISODate,
  type PayCycleActivationPreviewRequest,
  type PayCycleActivationPreviewResponse,
  type PayCycleActivationRequest,
  type PayCycleAdjustmentResponse,
  type PayCycleAnchorTransitionPreviewRequest,
  type PayCycleAnchorTransitionPreviewResponse,
  type PayCycleAnchorTransitionRequest,
  type PayCycleAnchorTransitionResponse,
  type PayCycleConfigResponse,
  type PayCycleDeactivationRequest,
  type PayCycleEndAdjustmentPreviewRequest,
  type PayCycleEndAdjustmentPreviewResponse,
  type PayCycleEndAdjustmentRequest,
  type PayCycleEndAdjustmentResponse,
  type PayCycleQuery,
  type PayCycleResponse,
  type PayCycleSummaryResponse,
  type UUID,
} from './contracts'
import { ApiError, request } from './http'

const base = endpoints.payCycle
const configBase = endpoints.payCycleConfig

/**
 * The cycle that contains today, or null when there is none: the cycles are off
 * (CALENDAR_MONTH) or today is not covered. The 404 body (PayCycleCurrentNotFoundResponse) says
 * why; the screens only need to fall back to the calendar month.
 */
export async function getCurrentPayCycle(signal?: AbortSignal): Promise<PayCycleResponse | null> {
  try {
    return await request<PayCycleResponse>(`${base}/current`, { signal })
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) return null
    throw error
  }
}

/** The cycle that contains `date`, or null. */
export async function getPayCycleByDate(
  date: ISODate,
  signal?: AbortSignal,
): Promise<PayCycleResponse | null> {
  const cycles = await request<PayCycleResponse[]>(`${base}${toQueryString({ date })}`, { signal })
  return cycles[0] ?? null
}

export function getPayCycle(code: UUID, signal?: AbortSignal): Promise<PayCycleResponse> {
  return request(`${base}/${code}`, { signal })
}

/** A plain array, oldest first as the back keeps it. Cancelled cycles only with include_cancelled. */
export function listPayCycles(
  query: PayCycleQuery = {},
  signal?: AbortSignal,
): Promise<PayCycleResponse[]> {
  return request(`${base}${toQueryString(query)}`, { signal })
}

/** By competence: recognized (paid) x projected, per category. 404 when the cycle is gone. */
export function getPayCycleSummary(
  code: UUID,
  signal?: AbortSignal,
): Promise<PayCycleSummaryResponse> {
  return request(`${base}/${code}/summary`, { signal })
}

/** The history of a cycle, newest first; may be empty. */
export function listPayCycleAdjustments(
  code: UUID,
  signal?: AbortSignal,
): Promise<PayCycleAdjustmentResponse[]> {
  return request(`${base}/${code}/adjustment`, { signal })
}

export function previewEndAdjustment(
  code: UUID,
  body: PayCycleEndAdjustmentPreviewRequest,
): Promise<PayCycleEndAdjustmentPreviewResponse> {
  return request(`${base}/${code}/end_adjustment/preview`, { method: 'POST', body })
}

export function adjustEnd(
  code: UUID,
  body: PayCycleEndAdjustmentRequest,
): Promise<PayCycleEndAdjustmentResponse> {
  return request(`${base}/${code}/end_adjustment`, { method: 'POST', body })
}

// ───────────────────────── /pay_cycle_config ─────────────────────────

export function getPayCycleConfig(signal?: AbortSignal): Promise<PayCycleConfigResponse> {
  return request(configBase, { signal })
}

export function previewActivation(
  body: PayCycleActivationPreviewRequest,
): Promise<PayCycleActivationPreviewResponse> {
  return request(`${configBase}/activation/preview`, { method: 'POST', body })
}

export function activatePayCycles(
  body: PayCycleActivationRequest,
): Promise<PayCycleConfigResponse> {
  return request(`${configBase}/activation`, { method: 'POST', body })
}

export function deactivatePayCycles(
  body: PayCycleDeactivationRequest,
): Promise<PayCycleConfigResponse> {
  return request(`${configBase}/deactivation`, { method: 'POST', body })
}

export function previewAnchorTransition(
  body: PayCycleAnchorTransitionPreviewRequest,
): Promise<PayCycleAnchorTransitionPreviewResponse> {
  return request(`${configBase}/anchor_transition/preview`, { method: 'POST', body })
}

export function transitionAnchor(
  body: PayCycleAnchorTransitionRequest,
): Promise<PayCycleAnchorTransitionResponse> {
  return request(`${configBase}/anchor_transition`, { method: 'POST', body })
}
