import { describe, expect, it } from 'vitest'

import { formatDate, formatDayHeader, formatMoney, formatMonth, formatSignedMoney } from './format'

// Intl puts a non-breaking space between "R$" and the number.
const nbsp = (text: string) => text.replace(/ /g, ' ')

describe('formatMoney', () => {
  it('should format reais in pt-BR', () => {
    expect(formatMoney(1234.5)).toBe(nbsp('R$ 1.234,50'))
    expect(formatMoney(0)).toBe(nbsp('R$ 0,00'))
  })
})

describe('formatSignedMoney', () => {
  it('should take the sign from the operation type', () => {
    expect(formatSignedMoney('DEBIT', 50)).toBe(nbsp('-R$ 50,00'))
    expect(formatSignedMoney('CREDIT', -50)).toBe(nbsp('+R$ 50,00'))
  })
})

describe('dates', () => {
  it('should format a LocalDate without shifting the day', () => {
    expect(formatDate('2026-11-10')).toBe('10/11/2026')
    expect(formatDate('2026-11-10T23:59:59')).toBe('10/11/2026')
  })

  it('should format a list header in Portuguese', () => {
    expect(formatDayHeader('2026-11-10')).toBe('terça, 10 de nov')
  })

  it('should format a month in Portuguese', () => {
    expect(formatMonth('2026-11')).toBe('novembro de 2026')
  })
})
