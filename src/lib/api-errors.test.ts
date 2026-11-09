import type { FieldValues, UseFormSetError } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/http'
import { applyApiErrors, errorMessage, isRetryable } from './api-errors'

describe('applyApiErrors', () => {
  it('should put each 400 validation on the field with the same name', () => {
    const setError = vi.fn<UseFormSetError<FieldValues>>()
    const error = new ApiError(400, {
      message: 'Campos inválidos',
      validations: { description: 'tamanho deve ser entre 4 e 50', category_code: 'inativa' },
    })

    const leftover = applyApiErrors(error, setError, ['description', 'amount', 'category_code'])

    expect(setError).toHaveBeenCalledWith('description', {
      type: 'server',
      message: 'tamanho deve ser entre 4 e 50',
    })
    expect(setError).toHaveBeenCalledWith('category_code', { type: 'server', message: 'inativa' })
    expect(leftover).toBeNull()
  })

  it('should return what has no field, and the message of a 409 as it is', () => {
    const setError = vi.fn<UseFormSetError<FieldValues>>()
    const unknownField = new ApiError(400, {
      message: 'Campos inválidos',
      validations: { effective_date: 'antes do saldo inicial' },
    })
    expect(applyApiErrors(unknownField, setError, ['amount'])).toBe('antes do saldo inicial')

    const conflict = new ApiError(409, { message: 'O valor ultrapassa o que falta pagar.' })
    expect(applyApiErrors(conflict, setError, ['amount'])).toBe(
      'O valor ultrapassa o que falta pagar.',
    )
    expect(setError).not.toHaveBeenCalled()
  })
})

describe('errorMessage', () => {
  it('should explain a 404 as a removed record', () => {
    expect(errorMessage(new ApiError(404, { message: 'Registro não encontrado' }))).toMatch(
      /excluído/,
    )
  })

  it('should only retry network errors and 5xx', () => {
    expect(isRetryable(new ApiError(0, undefined, 'sem rede'))).toBe(true)
    expect(isRetryable(new ApiError(500, { message: 'Erro interno' }))).toBe(true)
    expect(isRetryable(new ApiError(409, { message: 'conflito' }))).toBe(false)
  })
})
