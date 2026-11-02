import { endpoints, type HealthResponse } from './contracts'
import { request } from './http'

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return request<HealthResponse>(endpoints.health, { signal })
}
