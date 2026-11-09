import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api/http'
import { payCycle, payCycleSnapshot } from '@/test/fixtures'
import {
  blockedMovementsLink,
  canPreviewClosure,
  closureErrorMessage,
  closureOffer,
  describeBlocker,
  describeClosedAt,
  newestSnapshotsFirst,
  snapshotAsSummary,
} from './closure'

describe('closureOffer', () => {
  it.each([
    ['PENDING_CLOSE', 'close'],
    ['OPEN', 'review'],
    ['CLOSED', 'closed'],
    ['PLANNED', 'none'],
    ['CANCELLED', 'none'],
  ] as const)('should offer %s → %s', (status, offer) => {
    expect(closureOffer({ status })).toBe(offer)
  })

  it('should not ask the back to preview a closed or cancelled cycle (it answers 409)', () => {
    expect(canPreviewClosure({ status: 'OPEN' })).toBe(true)
    expect(canPreviewClosure({ status: 'PENDING_CLOSE' })).toBe(true)
    expect(canPreviewClosure({ status: 'CLOSED' })).toBe(false)
    expect(canPreviewClosure({ status: 'CANCELLED' })).toBe(false)
  })
})

describe('describeBlocker', () => {
  const cycle = { last_day: '2026-11-04' }

  it('should say when the cycle ends', () => {
    const text = describeBlocker('CYCLE_NOT_ENDED', cycle)
    expect(text.title).toBe('O ciclo ainda não terminou')
    expect(text.detail).toContain('04/11/2026')
  })

  it.each(['LATE_MOVEMENTS', 'OVERDUE_PENDING_MOVEMENTS', 'PROJECTION_INCOMPLETE'])(
    'should explain %s',
    (blocker) => {
      const text = describeBlocker(blocker, cycle)
      expect(text.title).not.toContain('Algo impede')
      expect(text.detail.length).toBeGreaterThan(10)
    },
  )

  it('should keep the code of a blocker this app does not know', () => {
    const text = describeBlocker('SOMETHING_NEW', cycle)
    expect(text.title).toBe('Algo impede o fechamento')
    expect(text.detail).toContain('SOMETHING_NEW')
  })
})

describe('closureErrorMessage', () => {
  it('should turn the blocker codes of a 409 into words', () => {
    const error = new ApiError(409, {
      message: 'O ciclo não pode ser fechado: LATE_MOVEMENTS, OVERDUE_PENDING_MOVEMENTS',
    } as never)
    expect(closureErrorMessage(error)).toBe(
      'O ciclo não pode ser fechado: movimentações atrasadas, movimentações pendentes vencidas',
    )
  })

  it('should leave an unknown code and the other messages as the back wrote them', () => {
    const unknown = new ApiError(409, { message: 'Não pode: SOMETHING_NEW' } as never)
    expect(closureErrorMessage(unknown)).toBe('Não pode: SOMETHING_NEW')
    const stale = new ApiError(409, {
      message: 'O ciclo foi alterado; recarregue e tente novamente',
    } as never)
    expect(closureErrorMessage(stale)).toBe('O ciclo foi alterado; recarregue e tente novamente')
  })

  it('should not touch what is not a 409', () => {
    const error = new ApiError(500, { message: 'Erro LATE_MOVEMENTS' } as never)
    expect(closureErrorMessage(error)).toBe('Erro LATE_MOVEMENTS')
  })
})

describe('blockedMovementsLink', () => {
  it('should open the list on the days of the cycle, with only that status', () => {
    expect(
      blockedMovementsLink({ start_date: '2026-10-05', last_day: '2026-11-04' }, 'atrasada'),
    ).toBe('/movimentacoes?inicio=2026-10-05&fim=2026-11-04&status=atrasada')
  })
})

describe('snapshots', () => {
  it('should put the newest version first without touching the original', () => {
    const v1 = payCycleSnapshot({ snapshot_version: 1 })
    const v3 = payCycleSnapshot({ snapshot_version: 3 })
    const v2 = payCycleSnapshot({ snapshot_version: 2 })
    const original = [v1, v3, v2]

    expect(newestSnapshotsFirst(original).map((item) => item.snapshot_version)).toEqual([3, 2, 1])
    expect(original.map((item) => item.snapshot_version)).toEqual([1, 3, 2])
  })

  it('should show the instant in Brasília time', () => {
    expect(describeClosedAt('2026-11-06T17:30:00Z')).toBe('06/11/2026 às 14:30')
  })

  it('should read a snapshot as a complete cycle report', () => {
    const cycle = payCycle()
    const snapshot = payCycleSnapshot({ recognized_expense: 3100 })
    const summary = snapshotAsSummary(snapshot, cycle)

    expect(summary.cycle).toBe(cycle)
    expect(summary.recognized_expense).toBe(3100)
    expect(summary.categories).toBe(snapshot.categories)
    expect(summary.projection_incomplete).toBe(false)
    expect(summary.pending).toEqual([])
  })
})
