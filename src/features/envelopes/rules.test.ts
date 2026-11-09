import { describe, expect, it } from 'vitest'

import { formatMoney } from '@/lib/format'
import { envelope, payCycle } from '@/test/fixtures'
import {
  describeConsumption,
  describeRemaining,
  envelopeState,
  readOnlyReason,
  usedShare,
} from './rules'

describe('envelope rules', () => {
  it('should read the share used from consumed over planned', () => {
    expect(usedShare(envelope())).toBe(0.5)
  })

  it('should hold the share between 0 and 1', () => {
    expect(usedShare(envelope({ consumed_amount: 900, planned_amount: 300 }))).toBe(1)
    expect(usedShare(envelope({ consumed_amount: 0 }))).toBe(0)
  })

  it('should count an envelope with nothing planned as fully used', () => {
    expect(usedShare(envelope({ planned_amount: 0, consumed_amount: 0 }))).toBe(1)
  })

  it('should classify the state: ok, near the limit, over', () => {
    expect(envelopeState(envelope())).toBe('ok')
    expect(envelopeState(envelope({ consumed_amount: 680, planned_amount: 800 }))).toBe('near')
    expect(envelopeState(envelope({ consumed_amount: 850, overrun_amount: 50 }))).toBe('over')
  })

  it('should say what is left or by how much it ran over', () => {
    expect(describeRemaining(envelope())).toBe(`Restam ${formatMoney(400)}`)
    expect(describeRemaining(envelope({ overrun_amount: 35, remaining_amount: -35 }))).toBe(
      `Estourou ${formatMoney(35)}`,
    )
  })

  it('should say what the consumption is made of', () => {
    expect(describeConsumption(envelope())).toBe(
      `Pago ${formatMoney(300)} · A pagar ${formatMoney(100)}`,
    )
  })

  it('should only let the envelopes change in a cycle that is not closed or cancelled', () => {
    expect(readOnlyReason(payCycle({ status: 'OPEN' }))).toBeNull()
    expect(readOnlyReason(payCycle({ status: 'PENDING_CLOSE' }))).toBeNull()
    expect(readOnlyReason(payCycle({ status: 'CLOSED' }))).toMatch(/fechado/)
    expect(readOnlyReason(payCycle({ status: 'CANCELLED' }))).toMatch(/cancelado/)
  })
})
