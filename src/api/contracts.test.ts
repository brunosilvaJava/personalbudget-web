import { describe, expect, it } from 'vitest'

import { signedAmount, toQueryString } from './contracts'

describe('signedAmount', () => {
  it('should make a debit negative whatever sign the API sent', () => {
    expect(signedAmount('DEBIT', 50)).toBe(-50)
    expect(signedAmount('DEBIT', -50)).toBe(-50)
  })

  it('should make a credit positive whatever sign the API sent', () => {
    expect(signedAmount('CREDIT', 50)).toBe(50)
    expect(signedAmount('CREDIT', -50)).toBe(50)
  })
})

describe('toQueryString', () => {
  it('should repeat array params, as Spring binds List<Enum>', () => {
    expect(toQueryString({ operation_type: ['DEBIT', 'CREDIT'], page: 0 })).toBe(
      '?operation_type=DEBIT&operation_type=CREDIT&page=0',
    )
  })

  it('should skip empty values and return an empty string when nothing is left', () => {
    expect(toQueryString({ description: '', status: undefined, sort_by: null })).toBe('')
  })

  it('should encode values', () => {
    expect(toQueryString({ description: 'pão & leite' })).toBe('?description=p%C3%A3o+%26+leite')
  })
})
