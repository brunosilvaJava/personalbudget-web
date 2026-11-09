import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

import { ApiError } from '@/api/http'

export const GENERIC_ERROR_MESSAGE = 'Algo deu errado. Tente de novo.'

/** The message to show for any error a query or mutation threw. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'Registro não encontrado. Ele pode ter sido excluído.'
    if (error.status === 400 && Object.keys(error.validations).length > 0) {
      return Object.values(error.validations).join(' ')
    }
    return error.message
  }
  if (error instanceof Error && error.message) return error.message
  return GENERIC_ERROR_MESSAGE
}

/** 500 and network failures: worth a "Tentar de novo". 4xx will not change by retrying. */
export function isRetryable(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 0 || error.status >= 500)
}

/**
 * Puts each key of a 400's `validations` on the form field with the same snake_case name, and
 * returns what could not be placed on a field (other 400 keys, 404, 409, 500, network), to show
 * above the buttons. Returns null when everything went to a field.
 */
export function applyApiErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  /**
   * The request's field names. They need not be form fields: a key like `days`, which the form
   * splits into one control per recurrence, still gets an error by path that the form reads.
   */
  fields: readonly string[],
): string | null {
  if (!(error instanceof ApiError) || error.status !== 400) return errorMessage(error)

  const leftovers: string[] = []
  for (const [key, message] of Object.entries(error.validations)) {
    if (fields.includes(key)) {
      setError(key as Path<T>, { type: 'server', message })
    } else {
      leftovers.push(message)
    }
  }
  if (Object.keys(error.validations).length === 0) return error.message
  return leftovers.length > 0 ? leftovers.join(' ') : null
}

/** The 400's field → message map, empty for anything else (a key is the snake_case request field). */
export function validationsOf(error: unknown): Record<string, string> {
  return error instanceof ApiError && error.status === 400 ? error.validations : {}
}

/**
 * Splits what a failed write answered when ONE field has its own place on screen: the 400 on
 * `field` goes under it, anything else (other 400 keys, 409, 500, network) above the buttons.
 */
export function splitFieldError(
  error: unknown,
  field: string,
): { field: string | null; message: string | null } {
  const { [field]: own, ...rest } = validationsOf(error)
  const others = Object.values(rest)
  if (own || others.length > 0) {
    return { field: own ?? null, message: others.length > 0 ? others.join(' ') : null }
  }
  return { field: null, message: errorMessage(error) }
}

/** The record is gone (deleted elsewhere, or a stale link). */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.isNotFound
}
