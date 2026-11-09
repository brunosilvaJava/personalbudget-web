import {
  endpoints,
  toQueryString,
  type FinancialMovementQuery,
  type FinancialMovementRequest,
  type FinancialMovementResponse,
  type FinancialMovementUpdateRequest,
  type MovementSettlementRequest,
  type MovementSettlementResponse,
  type Page,
  type UUID,
} from './contracts'
import { request } from './http'

const base = endpoints.financialMovement

export function listMovements(
  query: FinancialMovementQuery,
  signal?: AbortSignal,
): Promise<Page<FinancialMovementResponse>> {
  return request(`${base}${toQueryString(query)}`, { signal })
}

export function getMovement(code: UUID, signal?: AbortSignal): Promise<FinancialMovementResponse> {
  return request(`${base}/${code}`, { signal })
}

/** Creates an UNPAID movement: a payment is a settlement (see createSettlement). */
export function createMovement(body: FinancialMovementRequest): Promise<FinancialMovementResponse> {
  return request(base, { method: 'POST', body })
}

export function updateMovement(
  code: UUID,
  body: FinancialMovementUpdateRequest,
): Promise<FinancialMovementResponse> {
  return request(`${base}/${code}`, { method: 'PATCH', body })
}

export function deleteMovement(code: UUID): Promise<void> {
  return request(`${base}/${code}`, { method: 'DELETE' })
}

export function listSettlements(
  movementCode: UUID,
  signal?: AbortSignal,
): Promise<MovementSettlementResponse[]> {
  return request(`${base}/${movementCode}/settlements`, { signal })
}

export function createSettlement(
  movementCode: UUID,
  body: MovementSettlementRequest,
): Promise<MovementSettlementResponse> {
  return request(`${base}/${movementCode}/settlements`, { method: 'POST', body })
}

export function reverseSettlement(
  movementCode: UUID,
  settlementCode: UUID,
): Promise<MovementSettlementResponse> {
  return request(`${base}/${movementCode}/settlements/${settlementCode}/reversal`, {
    method: 'POST',
  })
}
