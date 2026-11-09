import { describe, expect, it } from 'vitest'

import type { PayCyclePendingResponse, PayCycleSummaryPendingResponse } from '@/api/contracts'
import { payCycle } from '@/test/fixtures'
import {
  describeAdjustment,
  describeCycleDates,
  describePayCyclePending,
  describeSummaryPending,
  pendingAction,
} from './rules'

const none = {
  nominal_month: null,
  year: null,
  cycle_code: null,
  boundary_date: null,
  anchor_date: null,
} satisfies Omit<PayCyclePendingResponse, 'type'>

describe('describeCycleDates', () => {
  it('should show the range with the last day and the number of days', () => {
    expect(describeCycleDates(payCycle())).toBe('05/11 a 03/12 · 29 dias')
  })

  it('should show both years when the cycle crosses the new year', () => {
    expect(
      describeCycleDates(
        payCycle({ start_date: '2026-12-05', last_day: '2027-01-03', total_days: 30 }),
      ),
    ).toBe('05/12/2026 a 03/01/2027 · 30 dias')
  })
})

describe('describePayCyclePending', () => {
  it('should name both dates of a boundary that diverges from the anchor', () => {
    expect(
      describePayCyclePending({
        ...none,
        type: 'BOUNDARY_DIVERGES_FROM_ANCHOR',
        nominal_month: '2026-12',
        boundary_date: '2026-12-04',
        anchor_date: '2026-12-03',
      }),
    ).toBe('A virada de 04/12/2026 fica diferente da receita âncora, que cai em 03/12/2026.')
  })

  it('should name the year of a calendar that is not reviewed', () => {
    expect(describePayCyclePending({ ...none, type: 'CALENDAR_NOT_REVIEWED', year: 2027 })).toBe(
      'O calendário de 2027 não está revisado.',
    )
  })

  it('should name the month that has no business day or no anchor occurrence', () => {
    expect(
      describePayCyclePending({
        ...none,
        type: 'BUSINESS_DAY_NOT_FOUND',
        nominal_month: '2027-02',
      }),
    ).toBe('Em fevereiro de 2027, o mês não tem o dia útil da receita âncora.')
    expect(
      describePayCyclePending({ ...none, type: 'ANCHOR_SCHEDULE_ENDS', nominal_month: '2027-03' }),
    ).toBe('A receita âncora não cobre março de 2027.')
  })
})

describe('pendingAction', () => {
  it('should send an unreviewed year to that year of the calendar', () => {
    expect(pendingAction({ ...none, type: 'CALENDAR_NOT_REVIEWED', year: 2027 })).toEqual({
      to: '/receita/calendario?ano=2027',
      label: 'Revisar 2027',
    })
  })

  it('should send a diverging boundary to the cycle that starts on it', () => {
    expect(
      pendingAction({
        ...none,
        type: 'BOUNDARY_DIVERGES_FROM_ANCHOR',
        cycle_code: 'c-1',
      }),
    ).toEqual({ to: '/ciclos/c-1', label: 'Abrir o ciclo' })
  })

  it('should offer nothing for a missing current cycle', () => {
    expect(pendingAction({ ...none, type: 'NO_CURRENT_CYCLE' })).toBeNull()
  })
})

describe('describeSummaryPending', () => {
  const base = {
    source: 'PAY_CYCLE',
    source_code: null,
    nominal_month: null,
    year: null,
    boundary_date: null,
    anchor_date: null,
  } satisfies Omit<PayCycleSummaryPendingResponse, 'type'>

  it('should read a known type like the pendency of the cycle', () => {
    expect(describeSummaryPending({ ...base, type: 'CALENDAR_NOT_REVIEWED', year: 2027 })).toBe(
      'O calendário de 2027 não está revisado.',
    )
  })

  it('should keep a generic line for a type this app does not know', () => {
    expect(describeSummaryPending({ ...base, type: 'SOMETHING_NEW' })).toBe(
      'Há algo pendente que deixa a projeção incompleta.',
    )
  })
})

describe('describeAdjustment', () => {
  const entry = {
    code: 'x',
    previous_cycle_code: null,
    next_cycle_code: null,
    justification: 'Pagamento antecipado',
    expected_previous_version: 1,
    expected_next_version: 1,
    expected_config_version: null,
    created_date: '2026-11-09T10:00:00',
  } as const

  it('should show a boundary that moved', () => {
    expect(
      describeAdjustment({
        ...entry,
        type: 'MANUAL_BOUNDARY',
        old_boundary: '2026-12-04',
        new_boundary: '2026-12-03',
      }),
    ).toBe('04/12/2026 → 03/12/2026')
  })

  it('should say where the first cancelled cycle started on a deactivation', () => {
    expect(
      describeAdjustment({
        ...entry,
        type: 'DEACTIVATION',
        old_boundary: '2027-01-04',
        new_boundary: null,
      }),
    ).toBe('O primeiro ciclo cancelado começava em 04/01/2027.')
  })
})
