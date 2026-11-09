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

/** The record is gone (deleted elsewhere, or a stale link). */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.isNotFound
}
