import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { movement } from '@/test/fixtures'
import {
  movementEditDefaults,
  movementEditSchema,
  quickLaunchSchema,
  remainingAmount,
  toQuickLaunchRequests,
  toUpdateRequest,
} from './schema'

describe('quick launch', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T15:30:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('should put another day at noon and pay on that day', () => {
    const values = quickLaunchSchema.parse({
      operation_type: 'DEBIT',
      amount: 1050,
      description: '  Feira  ',
      category_code: null,
      movement_date: '2026-11-08',
      unpaid: false,
      due_date: '',
    })
    expect(toQuickLaunchRequests(values)).toEqual({
      movement: {
        operation_type: 'DEBIT',
        description: 'Feira',
        amount: 10.5,
        movement_date: '2026-11-08T12:00:00',
        due_date: '2026-11-08T12:00:00',
      },
      settlement: { amount: 10.5, effective_date: '2026-11-08' },
    })
  })

  it('should ask for the due date only when unpaid', () => {
    const base = {
      operation_type: 'DEBIT',
      amount: 100,
      description: 'Conta de luz',
      category_code: null,
      movement_date: '2026-11-10',
      due_date: '',
    }
    expect(quickLaunchSchema.safeParse({ ...base, unpaid: false }).success).toBe(true)
    expect(quickLaunchSchema.safeParse({ ...base, unpaid: true }).success).toBe(false)
  })
})

describe('edit', () => {
  it('should send nothing when nothing changed, and keep the times of the dates', () => {
    const item = movement({
      movement_date: '2026-11-08T18:20:00',
      due_date: '2026-11-15T00:00:00',
      category_code: 'c1',
    })
    const unchanged = movementEditSchema.parse(movementEditDefaults(item))
    expect(toUpdateRequest(item, unchanged)).toEqual({})

    expect(
      toUpdateRequest(item, { ...unchanged, movement_date: '2026-11-09', due_date: '2026-11-20' }),
    ).toEqual({ movement_date: '2026-11-09T18:20:00', due_date: '2026-11-20T00:00:00' })
  })

  it('should set or restore the competence', () => {
    const auto = movement({ competence_date: '2026-11-10', competence_overridden: false })
    const values = movementEditSchema.parse(movementEditDefaults(auto))
    expect(
      toUpdateRequest(auto, {
        ...values,
        competence_mode: 'manual',
        competence_date: '2026-10-31',
      }),
    ).toEqual({ competence_date: '2026-10-31' })

    const manual = movement({ competence_date: '2026-10-31', competence_overridden: true })
    expect(
      toUpdateRequest(manual, {
        ...movementEditSchema.parse(movementEditDefaults(manual)),
        competence_mode: 'auto',
      }),
    ).toEqual({ restore_automatic_competence: true })
  })

  it('should compute what is still owed in cents', () => {
    expect(remainingAmount(movement({ amount: 100.3, amount_paid: 50.1 }))).toBe(50.2)
    expect(remainingAmount(movement({ amount: 10, amount_paid: null }))).toBe(10)
  })
})
