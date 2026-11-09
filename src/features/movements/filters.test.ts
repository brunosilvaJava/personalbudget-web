import { describe, expect, it } from 'vitest'

import { movement } from '@/test/fixtures'
import { cardInstallmentLabel, isCardInstallment } from './card'
import { readFilters, toListFilters, writeFilters } from './filters'
import { groupByDay } from './grouping'

describe('movement filters', () => {
  it('should round-trip through the URL in Portuguese', () => {
    const params = writeFilters(new URLSearchParams(), {
      operationType: 'DEBIT',
      statuses: ['LATE', 'PENDING'],
      categoryCodes: ['c1'],
      withoutCategory: false,
      search: ' pão ',
    })
    expect(params.toString()).toBe(
      'tipo=despesa&status=atrasada&status=pendente&categoria=c1&busca=p%C3%A3o',
    )
    expect(readFilters(params)).toEqual({
      operationType: 'DEBIT',
      statuses: ['LATE', 'PENDING'],
      categoryCodes: ['c1'],
      withoutCategory: false,
      search: 'pão',
    })
  })

  it('should build the API query, a category list winning over "sem categoria"', () => {
    const period = { start: '2026-11-01', end: '2026-11-30' }
    expect(
      toListFilters(period, {
        statuses: ['PENDING', 'LATE'],
        categoryCodes: ['c1'],
        withoutCategory: true,
        search: '',
      }),
    ).toEqual({
      start_date: '2026-11-01',
      end_date: '2026-11-30',
      status: ['LATE', 'PENDING'],
      category_code: ['c1'],
    })
    expect(
      toListFilters(period, { statuses: [], categoryCodes: [], withoutCategory: true, search: '' }),
    ).toEqual({ start_date: '2026-11-01', end_date: '2026-11-30', without_category: true })
  })

  it('should ignore unknown values in the URL', () => {
    expect(readFilters(new URLSearchParams('tipo=x&status=paga&status=foo')).statuses).toEqual([
      'PAID_OUT',
    ])
  })
})

describe('card installments', () => {
  it('should read the total from the description the back writes', () => {
    const installment = movement({
      description: 'Geladeira (2/3)',
      card_purchase_code: 'p1',
      card_invoice_code: 'i1',
      installment_number: 2,
    })
    expect(isCardInstallment(installment)).toBe(true)
    expect(cardInstallmentLabel(installment)).toBe('cartão 2/3')
    expect(isCardInstallment(movement())).toBe(false)
  })
})

describe('groupByDay', () => {
  it('should group by the day of movement_date and sum in cents', () => {
    const days = groupByDay([
      movement({ movement_date: '2026-11-10T20:00:00', amount: 0.1 }),
      movement({ movement_date: '2026-11-10T08:00:00', amount: 0.2 }),
      movement({ movement_date: '2026-11-09T12:00:00', amount: 50, operation_type: 'CREDIT' }),
    ])
    expect(days.map((day) => [day.date, day.movements.length, day.net])).toEqual([
      ['2026-11-10', 2, -0.3],
      ['2026-11-09', 1, 50],
    ])
  })
})
