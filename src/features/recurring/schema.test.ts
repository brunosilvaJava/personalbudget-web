import { describe, expect, it } from 'vitest'

import { fixedBill, installmentBill } from '@/test/fixtures'
import {
  fixedBillDefaults,
  fixedBillSchema,
  installmentBillSchema,
  toFixedBillRequest,
  toFixedBillUpdate,
  toInstallmentBillRequest,
  toInstallmentBillUpdate,
  type FixedBillFormInput,
} from './schema'

function monthly(overrides: Partial<FixedBillFormInput> = {}): FixedBillFormInput {
  return {
    ...fixedBillDefaults(),
    description: 'Aluguel',
    amount: 150000,
    monthly_days: [20, 5],
    start_date: '2026-11-10',
    ...overrides,
  }
}

describe('fixedBillSchema', () => {
  it('should ask for the days when none was chosen for the recurrence', () => {
    const result = fixedBillSchema.safeParse(monthly({ monthly_days: [] }))
    expect(result.success).toBe(false)
    expect(result.error?.issues.find((issue) => issue.path[0] === 'days')?.message).toBe(
      'Escolha quando ela vence.',
    )
  })

  it('should ignore the days of the other recurrences', () => {
    expect(fixedBillSchema.safeParse(monthly({ weekly_days: [] })).success).toBe(true)
  })

  it('should refuse an end before the start', () => {
    const result = fixedBillSchema.safeParse(monthly({ end_date: '2026-11-01' }))
    expect(result.error?.issues.find((issue) => issue.path[0] === 'end_date')).toBeDefined()
  })

  it('should keep the description at 3 to 50 characters', () => {
    expect(fixedBillSchema.safeParse(monthly({ description: 'ab' })).success).toBe(false)
    expect(fixedBillSchema.safeParse(monthly({ description: 'x'.repeat(51) })).success).toBe(false)
  })
})

describe('toFixedBillRequest', () => {
  it('should send sorted days, reais and an explicit start_date', () => {
    const values = fixedBillSchema.parse(monthly())
    expect(toFixedBillRequest(values)).toEqual({
      operation_type: 'DEBIT',
      description: 'Aluguel',
      amount: 1500,
      recurrence_type: 'MONTHLY',
      days: [5, 20],
      start_date: '2026-11-10',
    })
  })

  it('should turn a yearly date into the day of the year and its reference year', () => {
    const values = fixedBillSchema.parse(
      monthly({ recurrence_type: 'YEARLY', yearly_date: '2026-11-10' }),
    )
    expect(toFixedBillRequest(values)).toMatchObject({
      recurrence_type: 'YEARLY',
      days: [314],
      reference_year: 2026,
      flg_leap_year: false,
    })
  })

  it('should send end date and category only when chosen', () => {
    const values = fixedBillSchema.parse(monthly({ end_date: '2027-11-10', category_code: 'c-1' }))
    expect(toFixedBillRequest(values)).toMatchObject({
      end_date: '2027-11-10',
      category_code: 'c-1',
    })
  })
})

describe('toFixedBillUpdate', () => {
  it('should send only the description when nothing changed', () => {
    const bill = fixedBill({ days: [5, 20], start_date: '2026-11-10' })
    const values = fixedBillSchema.parse(fixedBillDefaultsOf(bill))
    expect(toFixedBillUpdate(bill, values)).toEqual({ description: 'Aluguel' })
  })

  it('should send what changed, and read a negative amount of the response as positive', () => {
    const bill = fixedBill({ amount: -1500, days: [5], start_date: '2026-11-10' })
    const same = fixedBillSchema.parse(fixedBillDefaultsOf(bill))
    expect(toFixedBillUpdate(bill, same)).toEqual({ description: 'Aluguel' })

    const changed = fixedBillSchema.parse({
      ...fixedBillDefaultsOf(bill),
      amount: 160000,
      monthly_days: [10],
    })
    expect(toFixedBillUpdate(bill, changed)).toEqual({
      description: 'Aluguel',
      amount: 1600,
      days: [10],
    })
  })
})

function fixedBillDefaultsOf(bill: ReturnType<typeof fixedBill>) {
  return fixedBillDefaults(bill)
}

describe('installment bill schema and bodies', () => {
  const input = {
    operation_type: 'DEBIT' as const,
    description: 'Carnê da loja',
    amount: 15000,
    installment_total: 10,
    purchase_date: '2026-11-10',
    category_code: null,
  }

  it('should send the value of each installment in reais', () => {
    expect(toInstallmentBillRequest(installmentBillSchema.parse(input))).toEqual({
      operation_type: 'DEBIT',
      description: 'Carnê da loja',
      amount: 150,
      purchase_date: '2026-11-10',
      installment_total: 10,
    })
  })

  it('should ask for at least one installment and 4 letters', () => {
    expect(installmentBillSchema.safeParse({ ...input, installment_total: 0 }).success).toBe(false)
    expect(installmentBillSchema.safeParse({ ...input, description: 'abc' }).success).toBe(false)
  })

  it('should send only what changed on an update', () => {
    const bill = installmentBill({ purchase_date: '2026-11-10' })
    const values = installmentBillSchema.parse({ ...input, installment_total: 12 })
    expect(toInstallmentBillUpdate(bill, values)).toEqual({
      description: 'Carnê da loja',
      installment_total: 12,
    })
  })
})
