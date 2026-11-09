import type { ErrorResponse, ValidationErrorResponse } from './contracts'

/**
 * Base of every call. Always the front-end's own origin: the Vite dev server (and nginx, in
 * Docker) proxies /api to the Spring API and strips the prefix.
 */
export const API_BASE_URL = '/api'

export const REQUEST_TIMEOUT_MS = 10_000

export const NETWORK_ERROR_MESSAGE =
  'Sem conexão com o app. Confira se o PC está ligado e na mesma rede.'
export const TIMEOUT_ERROR_MESSAGE = 'A API demorou demais para responder. Tente de novo.'
export const API_UNAVAILABLE_MESSAGE = 'A API não respondeu. Confira se ela está rodando no PC.'

type ErrorBody = ValidationErrorResponse | ErrorResponse

/**
 * Thrown by `request` for non-2xx answers, malformed JSON, and with status 0 when there was no
 * answer at all (network down, PC off, timeout).
 */
export class ApiError extends Error {
  readonly status: number
  readonly body: ErrorBody | undefined

  constructor(status: number, body: ErrorBody | undefined, message?: string) {
    super(message ?? body?.message ?? `HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }

  /** Field → message of a 400, keyed by the snake_case request field: feeds setError. */
  get validations(): Record<string, string> {
    return this.body && 'validations' in this.body ? this.body.validations : {}
  }

  get isNetworkError(): boolean {
    return this.status === 0
  }

  get isNotFound(): boolean {
    return this.status === 404
  }
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface RequestOptions {
  method?: HttpMethod
  /** serialized as JSON */
  body?: unknown
  /** the signal TanStack Query passes, to cancel a request nobody waits for anymore */
  signal?: AbortSignal
  timeoutMs?: number
}

/**
 * The only place that calls fetch. Resolves with the parsed JSON body, or `undefined` for an
 * empty one (201 without body, 204).
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, timeoutMs = REQUEST_TIMEOUT_MS } = options

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const forwardAbort = () => controller.abort(signal?.reason)
  if (signal?.aborted) forwardAbort()
  else signal?.addEventListener('abort', forwardAbort, { once: true })

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: buildHeaders(body !== undefined),
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      signal: controller.signal,
    })

    const payload = await readJson(response)

    if (!response.ok) {
      const errorBody = isErrorBody(payload) ? payload : undefined
      // A 5xx without a JSON body comes from the proxy, not from Spring: the API is down.
      const message = !errorBody && response.status >= 500 ? API_UNAVAILABLE_MESSAGE : undefined
      throw new ApiError(response.status, errorBody, message)
    }

    return payload as T
  } catch (error) {
    // Cancelled by the caller: let it propagate as an AbortError, as TanStack Query expects.
    if (signal?.aborted) throw error
    if (error instanceof ApiError) throw error
    throw new ApiError(0, undefined, timedOut ? TIMEOUT_ERROR_MESSAGE : NETWORK_ERROR_MESSAGE)
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', forwardAbort)
  }
}

/**
 * Single point for request headers. Phase 5 (login) changes nothing here if the token travels
 * in an httpOnly cookie, as planned; otherwise this is where the Authorization header goes.
 */
function buildHeaders(hasBody: boolean): HeadersInit {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (hasBody) headers['Content-Type'] = 'application/json'
  return headers
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined
  const text = await response.text()
  if (!text) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    if (response.ok) {
      throw new ApiError(response.status, undefined, 'A API retornou uma resposta inválida.')
    }
    return undefined
  }
}

function isErrorBody(value: unknown): value is ErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { message?: unknown }).message === 'string'
  )
}
