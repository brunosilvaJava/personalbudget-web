import { describe, expect, it } from 'vitest'

import { formatCentsForInput, fromCents, parseMoneyInput, toCents } from './money'

describe('parseMoneyInput', () => {
  it('should read a comma or a dot as the decimal separator', () => {
    expect(parseMoneyInput('8,5')).toBe(850)
    expect(parseMoneyInput('8,50')).toBe(850)
    expect(parseMoneyInput('8.50')).toBe(850)
    expect(parseMoneyInput('8')).toBe(800)
  })

  it('should read thousands separators in both styles', () => {
    expect(parseMoneyInput('1.234,56')).toBe(123456)
    expect(parseMoneyInput('1,234.56')).toBe(123456)
    expect(parseMoneyInput('1.234')).toBe(123400)
    expect(parseMoneyInput('R$ 1.234,56')).toBe(123456)
  })

  it('should return null for nothing or a negative value', () => {
    expect(parseMoneyInput('')).toBeNull()
    expect(parseMoneyInput('R$ ')).toBeNull()
    expect(parseMoneyInput(',')).toBeNull()
    expect(parseMoneyInput('-5')).toBeNull()
  })

  it('should keep a trailing separator while typing', () => {
    expect(parseMoneyInput('8,')).toBe(800)
  })
})

describe('cents', () => {
  it('should not meet floating point errors', () => {
    expect(toCents(0.29)).toBe(29)
    expect(toCents(0.1 + 0.2)).toBe(30)
    expect(fromCents(toCents(0.1) + toCents(0.2))).toBe(0.3)
  })

  it('should format cents for the input', () => {
    expect(formatCentsForInput(123456)).toBe('1.234,56')
    expect(formatCentsForInput(5)).toBe('0,05')
  })
})
