import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { incomeSchedule } from '@/test/fixtures'
import {
  holidayYearSchema,
  incomeScheduleDefaults,
  incomeScheduleSchema,
  toHolidayRequests,
  toIncomeScheduleRequest,
  toIncomeScheduleUpdate,
  type IncomeScheduleFormInput,
} from './schema'

const valid: IncomeScheduleFormInput = {
  description: 'Salário',
  amount: 685_000,
  category_code: null,
  rule_type: 'FIXED_DAY',
  rule_value: 5,
  business_week: 'MONDAY_TO_FRIDAY',
  non_business_day_policy: 'ANTICIPATE',
  start_month: '2026-11',
  end_month: '',
  anchor: false,
  replaces_fixed_bill_code: null,
}

function messages(input: IncomeScheduleFormInput, editing = false) {
  const result = incomeScheduleSchema(editing).safeParse(input)
  return result.success
    ? []
    : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
}

describe('incomeScheduleSchema', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T15:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('should accept a valid schedule', () => {
    expect(messages(valid)).toEqual([])
  })

  it('should limit a fixed day to 1..31 and the N-th business day to 1..15', () => {
    expect(messages({ ...valid, rule_value: 32 })).toEqual(['rule_value: Use um dia de 1 a 31.'])
    expect(messages({ ...valid, rule_value: 0 })).toEqual(['rule_value: Use um dia de 1 a 31.'])
    expect(messages({ ...valid, rule_type: 'NTH_BUSINESS_DAY', rule_value: 16 })).toEqual([
      'rule_value: Use de 1º a 15º dia útil.',
    ])
    expect(messages({ ...valid, rule_type: 'NTH_BUSINESS_DAY', rule_value: 15 })).toEqual([])
  })

  it('should ask for the day when the field is empty', () => {
    expect(messages({ ...valid, rule_value: Number.NaN })).toEqual(['rule_value: Informe o dia.'])
  })

  it('should refuse a start before the current month only when creating', () => {
    expect(messages({ ...valid, start_month: '2026-10' })).toEqual([
      'start_month: O início não pode ser antes deste mês. Receitas passadas entram como lançamentos.',
    ])
    expect(messages({ ...valid, start_month: '2026-01' }, true)).toEqual([])
  })

  it('should refuse an end before the start, and accept no end', () => {
    expect(messages({ ...valid, end_month: '2026-10' })).toEqual([
      'end_month: O fim não pode ser antes do início.',
    ])
    expect(messages({ ...valid, end_month: '2026-11' })).toEqual([])
    expect(messages({ ...valid, end_month: '' })).toEqual([])
  })

  it('should refuse a month that is not aaaa-mm', () => {
    expect(messages({ ...valid, end_month: '12/2026' })).toEqual([
      'end_month: Informe o mês do fim (aaaa-mm).',
    ])
  })
})

describe('toIncomeScheduleRequest', () => {
  it('should send the policy only for a fixed day, and the optional fields only when set', () => {
    const fixed = incomeScheduleSchema(false).parse(valid)
    expect(toIncomeScheduleRequest(fixed)).toEqual({
      description: 'Salário',
      amount: 6850,
      rule_type: 'FIXED_DAY',
      rule_value: 5,
      business_week: 'MONDAY_TO_FRIDAY',
      non_business_day_policy: 'ANTICIPATE',
      start_month: '2026-11',
    })

    const nth = incomeScheduleSchema(false).parse({
      ...valid,
      rule_type: 'NTH_BUSINESS_DAY',
      end_month: '2027-03',
      anchor: true,
      category_code: 'c1',
      replaces_fixed_bill_code: 'f1',
    })
    expect(toIncomeScheduleRequest(nth)).toEqual({
      description: 'Salário',
      amount: 6850,
      rule_type: 'NTH_BUSINESS_DAY',
      rule_value: 5,
      business_week: 'MONDAY_TO_FRIDAY',
      start_month: '2026-11',
      end_month: '2027-03',
      anchor: true,
      category_code: 'c1',
      replaces_fixed_bill_code: 'f1',
    })
  })
})

describe('toIncomeScheduleUpdate', () => {
  const schedule = incomeSchedule({ end_month: '2027-03', category_code: 'c1' })
  const values = (patch: Partial<IncomeScheduleFormInput>) =>
    incomeScheduleSchema(true).parse({ ...incomeScheduleDefaults(schedule), ...patch })

  it('should send nothing when nothing changed', () => {
    expect(toIncomeScheduleUpdate(schedule, values({}))).toEqual({})
  })

  it('should send only what changed', () => {
    expect(
      toIncomeScheduleUpdate(
        schedule,
        values({ amount: 700_000, rule_value: 7, business_week: 'MONDAY_TO_SATURDAY' }),
      ),
    ).toEqual({ amount: 7000, rule_value: 7, business_week: 'MONDAY_TO_SATURDAY' })
  })

  it('should send remove_end_month when the end was cleared, and the new end when it moved', () => {
    expect(toIncomeScheduleUpdate(schedule, values({ end_month: '' }))).toEqual({
      remove_end_month: true,
    })
    expect(toIncomeScheduleUpdate(schedule, values({ end_month: '2027-06' }))).toEqual({
      end_month: '2027-06',
    })
  })

  it('should never send a null category (it cannot be removed)', () => {
    expect(toIncomeScheduleUpdate(schedule, values({ category_code: null }))).toEqual({})
  })

  it('should send the policy when it changes, or when switching to a fixed day', () => {
    expect(
      toIncomeScheduleUpdate(schedule, values({ non_business_day_policy: 'POSTPONE' })),
    ).toEqual({
      non_business_day_policy: 'POSTPONE',
    })
    const nth = incomeSchedule({
      rule_type: 'NTH_BUSINESS_DAY',
      non_business_day_policy: null,
    })
    expect(
      toIncomeScheduleUpdate(
        nth,
        incomeScheduleSchema(true).parse({
          ...incomeScheduleDefaults(nth),
          rule_type: 'FIXED_DAY',
        }),
      ),
    ).toEqual({ rule_type: 'FIXED_DAY', non_business_day_policy: 'ANTICIPATE' })
  })

  it('should not send the policy for the N-th business day', () => {
    expect(
      toIncomeScheduleUpdate(
        schedule,
        values({ rule_type: 'NTH_BUSINESS_DAY', non_business_day_policy: 'KEEP' }),
      ),
    ).toEqual({ rule_type: 'NTH_BUSINESS_DAY' })
  })

  it('should send the anchor flag when it changes', () => {
    expect(toIncomeScheduleUpdate(schedule, values({ anchor: true }))).toEqual({ anchor: true })
  })
})

describe('holidayYearSchema', () => {
  const messagesOf = (year: number, holidays: { date: string; name: string }[]) => {
    const result = holidayYearSchema(year).safeParse({ holidays })
    return result.success
      ? []
      : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
  }

  it('should accept an empty list (a reviewed year without holidays)', () => {
    expect(messagesOf(2027, [])).toEqual([])
  })

  it('should refuse a date from another year', () => {
    expect(messagesOf(2027, [{ date: '2026-12-25', name: 'Natal' }])).toEqual([
      'holidays.0.date: A data precisa ser de 2027.',
    ])
  })

  it('should refuse an empty date, an empty name and a duplicated date', () => {
    expect(messagesOf(2027, [{ date: '', name: '' }])).toEqual([
      'holidays.0.date: Informe a data.',
      'holidays.0.name: Dê um nome.',
    ])
    expect(
      messagesOf(2027, [
        { date: '2027-12-25', name: 'Natal' },
        { date: '2027-12-25', name: 'Natal de novo' },
      ]),
    ).toEqual(['holidays.1.date: Já há um feriado nesta data.'])
  })
})

describe('toHolidayRequests', () => {
  it('should send the list ordered by date, with the names trimmed', () => {
    const values = holidayYearSchema(2027).parse({
      holidays: [
        { date: '2027-12-25', name: ' Natal ' },
        { date: '2027-01-01', name: 'Confraternização Universal' },
      ],
    })
    expect(toHolidayRequests(values)).toEqual([
      { date: '2027-01-01', name: 'Confraternização Universal' },
      { date: '2027-12-25', name: 'Natal' },
    ])
  })
})
