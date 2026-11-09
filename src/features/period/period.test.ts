import { describe, expect, it } from 'vitest'

import { payCycle } from '@/test/fixtures'
import { cyclePeriod, periodKind, readPeriod, shiftCustomPeriod, writePeriod } from './period'

describe('period', () => {
  it('should end a cycle period on last_day, as /balance/daily is inclusive', () => {
    expect(cyclePeriod(payCycle())).toEqual({
      start: '2026-11-05',
      end: '2026-12-03',
      cycleCode: payCycle().code,
    })
  })

  it('should tell a month from a custom period', () => {
    expect(periodKind({ start: '2026-11-01', end: '2026-11-30' })).toBe('month')
    expect(periodKind({ start: '2026-11-01', end: '2026-11-29' })).toBe('custom')
    expect(periodKind(cyclePeriod(payCycle()))).toBe('cycle')
  })

  it('should move a custom period by its own length', () => {
    expect(shiftCustomPeriod({ start: '2026-11-01', end: '2026-11-10' }, 1)).toEqual({
      start: '2026-11-11',
      end: '2026-11-20',
    })
  })

  it('should round-trip through the URL and refuse an inverted period', () => {
    const params = writePeriod(new URLSearchParams('tipo=despesa'), cyclePeriod(payCycle()))
    expect(readPeriod(params)).toEqual(cyclePeriod(payCycle()))
    expect(params.get('tipo')).toBe('despesa')
    expect(readPeriod(new URLSearchParams('inicio=2026-11-10&fim=2026-11-01'))).toBeNull()
    expect(readPeriod(new URLSearchParams('inicio=2026-11-10'))).toBeNull()
  })
})
