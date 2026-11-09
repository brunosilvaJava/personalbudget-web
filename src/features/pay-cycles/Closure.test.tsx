import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  FinancialMovementResponse,
  PayCycleClosurePreviewResponse,
  PayCycleClosureRequest,
  PayCycleConfigResponse,
  PayCycleResponse,
  PayCycleSnapshotResponse,
} from '@/api/contracts'
import { mockCommonApi } from '@/test/api'
import {
  closurePreview,
  movement,
  page,
  payCycle,
  payCycleConfig,
  payCycleSnapshot,
  payCycleSummary,
} from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

const CYCLES_ON = payCycleConfig({
  mode: 'PAY_CYCLE',
  anchor_schedule_code: 'anchor-1',
  activation_date: '2026-10-05',
  version: 5,
})

/** Ended on 04/11: waits to be closed. */
const ENDED = payCycle({
  code: 'cycle-prev',
  label: 'Out/Nov',
  start_date: '2026-10-05',
  end_date_exclusive: '2026-11-05',
  last_day: '2026-11-04',
  total_days: 31,
  reference_month: '2026-10',
  status: 'PENDING_CLOSE',
  version: 2,
})

interface ClosureMocks {
  cycle: PayCycleResponse
  config?: PayCycleConfigResponse
  preview?: PayCycleClosurePreviewResponse
  snapshots?: PayCycleSnapshotResponse[]
  movements?: FinancialMovementResponse[]
  /** answers for the next closures, in order, before the ones that work */
  closeFailures?: { status: number; message: string }[]
  reopenFailure?: { status: number; message: string }
}

/**
 * One cycle with its closure, as the back keeps it: the preview carries the version, closing with
 * another version is a 409, closing creates the next snapshot and reopening makes the cycle open
 * again. `state` is for the test to change what the back answers next.
 */
function mockClosure(options: ClosureMocks) {
  const state = {
    cycle: options.cycle,
    preview: options.preview ?? closurePreview(),
    snapshots: options.snapshots ?? [],
    closeFailures: [...(options.closeFailures ?? [])],
  }
  const calls = {
    previews: 0,
    closed: [] as PayCycleClosureRequest[],
    reopened: [] as PayCycleClosureRequest[],
    movementGets: [] as string[],
  }
  server.use(
    http.get('/api/pay_cycle_config', () => HttpResponse.json(options.config ?? CYCLES_ON)),
    http.get('/api/pay_cycle/current', () =>
      HttpResponse.json(
        { message: 'Nenhum ciclo contém a data de hoje', pending: [] },
        { status: 404 },
      ),
    ),
    http.get('/api/pay_cycle', () => HttpResponse.json([state.cycle])),
    http.get('/api/pay_cycle/:code/summary', () =>
      HttpResponse.json({ ...payCycleSummary(), cycle: state.cycle }),
    ),
    http.get('/api/pay_cycle/:code/adjustment', () => HttpResponse.json([])),
    http.get('/api/pay_cycle/:code/snapshots', () => HttpResponse.json(state.snapshots)),
    http.get('/api/pay_cycle/:code', () => HttpResponse.json(state.cycle)),
    http.post('/api/pay_cycle/:code/closure/preview', () => {
      calls.previews += 1
      return HttpResponse.json(state.preview)
    }),
    http.post('/api/pay_cycle/:code/closure', async ({ request }) => {
      const body = (await request.json()) as PayCycleClosureRequest
      calls.closed.push(body)
      const failure = state.closeFailures.shift()
      if (failure) {
        return HttpResponse.json({ message: failure.message }, { status: failure.status })
      }
      if (body.expected_version !== state.preview.expected_version) {
        return HttpResponse.json(
          { message: 'O ciclo foi alterado; recarregue e tente novamente' },
          { status: 409 },
        )
      }
      const snapshot = payCycleSnapshot({
        cycle_code: state.cycle.code,
        snapshot_version: state.snapshots.length + 1,
        cycle_version: state.cycle.version ?? 0,
        closed_at: '2026-11-10T17:30:00Z',
      })
      state.cycle = { ...state.cycle, status: 'CLOSED', version: (state.cycle.version ?? 0) + 1 }
      state.snapshots = [...state.snapshots, snapshot]
      return HttpResponse.json({ cycle: state.cycle, snapshot })
    }),
    http.post('/api/pay_cycle/:code/reopen', async ({ request }) => {
      calls.reopened.push((await request.json()) as PayCycleClosureRequest)
      if (options.reopenFailure) {
        return HttpResponse.json(
          { message: options.reopenFailure.message },
          { status: options.reopenFailure.status },
        )
      }
      state.cycle = {
        ...state.cycle,
        status: 'PENDING_CLOSE',
        version: (state.cycle.version ?? 0) + 1,
      }
      return HttpResponse.json(state.cycle)
    }),
    http.get('/api/financial_movement/:code', ({ params }) => {
      calls.movementGets.push(String(params.code))
      const found = options.movements?.find((item) => item.code === params.code)
      return found
        ? HttpResponse.json(found)
        : HttpResponse.json({ message: 'Registro não encontrado' }, { status: 404 })
    }),
  )
  return { state, calls }
}

function section() {
  return screen.getByRole('region', { name: 'Fechamento' })
}

describe('Fechamento do ciclo', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T15:00:00Z'))
    mockCommonApi()
  })
  afterEach(() => vi.useRealTimers())

  describe('antes de fechar', () => {
    it('should say a planned cycle has not started and offer nothing', async () => {
      mockClosure({ cycle: payCycle({ status: 'PLANNED', label: 'Dez/Jan' }) })
      renderApp('/ciclos/p0000001-0000-4000-8000-000000000001')

      await screen.findByRole('heading', { name: /Ciclo Dez\/Jan/ })
      expect(within(section()).getByText('Este ciclo ainda não começou.')).toBeInTheDocument()
      expect(within(section()).queryByRole('button')).not.toBeInTheDocument()
    })

    it('should say a cancelled cycle is not closed', async () => {
      mockClosure({ cycle: payCycle({ status: 'CANCELLED' }) })
      renderApp('/ciclos/p0000001-0000-4000-8000-000000000001')

      await screen.findByRole('heading', { name: /Ciclo Nov\/Dez/ })
      expect(
        within(section()).getByText('Este ciclo foi cancelado e não é fechado.'),
      ).toBeInTheDocument()
    })

    it('should let an open cycle show what is missing, without a way to close it', async () => {
      const { calls } = mockClosure({
        cycle: payCycle({ status: 'OPEN' }),
        preview: closurePreview({ can_close: false, blockers: ['CYCLE_NOT_ENDED'] }),
      })
      renderApp('/ciclos/p0000001-0000-4000-8000-000000000001')

      await screen.findByRole('heading', { name: /Ciclo Nov\/Dez/ })
      expect(within(section()).getByText(/vai até 03\/12\/2026/)).toBeInTheDocument()
      // The preview is only asked for when the person opens the review.
      expect(calls.previews).toBe(0)
      await userEvent.click(
        await within(section()).findByRole('button', { name: 'Ver o que falta para fechar' }),
      )

      const sheet = await screen.findByRole('dialog', { name: 'Fechamento de Nov/Dez' })
      expect(await within(sheet).findByText('O ciclo ainda não terminou')).toBeInTheDocument()
      expect(within(sheet).getByText(/Só dá para fechar depois desse dia/)).toBeInTheDocument()
      expect(within(sheet).getByText('O que fica registrado')).toBeInTheDocument()
      expect(
        within(sheet).queryByRole('button', { name: 'Fechar o ciclo' }),
      ).not.toBeInTheDocument()
    })

    it('should not offer to close while the cycles are off', async () => {
      mockClosure({ cycle: ENDED, config: payCycleConfig() })
      renderApp(`/ciclos/${ENDED.code}`)

      await screen.findByRole('heading', { name: /Ciclo Out\/Nov/ })
      expect(
        within(section()).getByText(/O ciclo terminou e espera o fechamento/),
      ).toBeInTheDocument()
      expect(
        within(section()).queryByRole('button', { name: 'Fechar o ciclo' }),
      ).not.toBeInTheDocument()
    })
  })

  describe('fechar', () => {
    it('should close with the version of the preview and show the snapshot', async () => {
      const { calls } = mockClosure({
        cycle: ENDED,
        preview: closurePreview({ expected_version: 9 }),
      })
      renderApp(`/ciclos/${ENDED.code}`)

      await userEvent.click(await screen.findByRole('button', { name: 'Fechar o ciclo' }))
      const sheet = await screen.findByRole('dialog', { name: 'Fechar Out/Nov' })
      expect(await within(sheet).findByText('Nada impede o fechamento')).toBeInTheDocument()
      await userEvent.click(within(sheet).getByRole('button', { name: 'Fechar o ciclo' }))

      await waitFor(() => expect(calls.closed).toEqual([{ expected_version: 9 }]))
      expect(await screen.findAllByText('Ciclo fechado. Fechamento versão 1.')).not.toHaveLength(0)
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: 'Fechar Out/Nov' })).not.toBeInTheDocument(),
      )
      expect(await within(section()).findByText(/Este ciclo está fechado/)).toBeInTheDocument()
      const history = await within(section()).findByRole('region', { name: 'Fechamentos' })
      expect(within(history).getByText('Fechamento 1')).toBeInTheDocument()
      expect(within(history).getByText('Em vigor')).toBeInTheDocument()
      expect(within(history).getByText('10/11/2026 às 14:30')).toBeInTheDocument()
      expect(within(section()).getByRole('button', { name: 'Reabrir o ciclo' })).toBeInTheDocument()
      expect(
        within(section()).queryByRole('button', { name: 'Fechar o ciclo' }),
      ).not.toBeInTheDocument()
    })

    it('should explain each blocker, list the late movements and not close', async () => {
      const late = [
        movement({ code: 'late-1', description: 'Aluguel', amount: 1800, status: 'LATE' }),
        movement({ code: 'late-2', description: 'Internet', amount: 120, status: 'LATE' }),
      ]
      mockClosure({
        cycle: ENDED,
        movements: late,
        preview: closurePreview({
          can_close: false,
          blockers: ['PROJECTION_INCOMPLETE', 'LATE_MOVEMENTS', 'OVERDUE_PENDING_MOVEMENTS'],
          late_movement_codes: ['late-1', 'late-2'],
          summary: payCycleSummary({
            projection_incomplete: true,
            pending: [
              {
                source: 'INCOME_SCHEDULE',
                type: 'CALENDAR_NOT_REVIEWED',
                source_code: null,
                nominal_month: null,
                year: 2027,
                boundary_date: null,
                anchor_date: null,
              },
            ],
          }),
        }),
      })
      renderApp(`/ciclos/${ENDED.code}`)

      await userEvent.click(await screen.findByRole('button', { name: 'Fechar o ciclo' }))
      const sheet = await screen.findByRole('dialog', { name: 'Fechar Out/Nov' })

      expect(await within(sheet).findByText('A projeção está incompleta')).toBeInTheDocument()
      expect(within(sheet).getByText('O calendário de 2027 não está revisado.')).toBeInTheDocument()
      expect(within(sheet).getByText('Há movimentações atrasadas')).toBeInTheDocument()
      expect(await within(sheet).findByText('Aluguel')).toBeInTheDocument()
      expect(within(sheet).getByText('Internet')).toBeInTheDocument()
      expect(
        within(sheet).getByText('Há movimentações pendentes que já venceram'),
      ).toBeInTheDocument()
      expect(
        within(sheet).getByRole('link', { name: 'Ver as atrasadas do ciclo' }),
      ).toHaveAttribute('href', '/movimentacoes?inicio=2026-10-05&fim=2026-11-04&status=atrasada')
      expect(
        within(sheet).getByRole('link', { name: 'Ver as pendentes do ciclo' }),
      ).toHaveAttribute('href', '/movimentacoes?inicio=2026-10-05&fim=2026-11-04&status=pendente')
      expect(within(sheet).getByRole('button', { name: 'Fechar o ciclo' })).toBeDisabled()
      // The warning about the projection is said once, as a blocker.
      expect(within(sheet).getAllByText('A projeção está incompleta')).toHaveLength(1)
    })

    it('should look up only the first late movements and count the rest', async () => {
      const codes = Array.from({ length: 12 }, (_, index) => `late-${index + 1}`)
      const { calls } = mockClosure({
        cycle: ENDED,
        movements: codes.map((code, index) =>
          movement({ code, description: `Conta ${index + 1}`, status: 'LATE' }),
        ),
        preview: closurePreview({
          can_close: false,
          blockers: ['LATE_MOVEMENTS'],
          late_movement_codes: codes,
        }),
      })
      renderApp(`/ciclos/${ENDED.code}`)

      await userEvent.click(await screen.findByRole('button', { name: 'Fechar o ciclo' }))
      const sheet = await screen.findByRole('dialog', { name: 'Fechar Out/Nov' })

      expect(await within(sheet).findByText('Conta 10')).toBeInTheDocument()
      expect(within(sheet).getByText('e mais 2')).toBeInTheDocument()
      expect(within(sheet).queryByText('Conta 11')).not.toBeInTheDocument()
      expect(calls.movementGets).toHaveLength(10)
    })

    it('should say when a late movement could not be loaded', async () => {
      mockClosure({
        cycle: ENDED,
        movements: [],
        preview: closurePreview({
          can_close: false,
          blockers: ['LATE_MOVEMENTS'],
          late_movement_codes: ['gone-1'],
        }),
      })
      renderApp(`/ciclos/${ENDED.code}`)

      await userEvent.click(await screen.findByRole('button', { name: 'Fechar o ciclo' }))
      const sheet = await screen.findByRole('dialog', { name: 'Fechar Out/Nov' })

      expect(
        await within(sheet).findByText('Não foi possível carregar esta movimentação.'),
      ).toBeInTheDocument()
    })

    it('should reload the review and use the new version after a stale 409', async () => {
      const { state, calls } = mockClosure({
        cycle: ENDED,
        preview: closurePreview({ expected_version: 9 }),
      })
      renderApp(`/ciclos/${ENDED.code}`)

      await userEvent.click(await screen.findByRole('button', { name: 'Fechar o ciclo' }))
      const sheet = await screen.findByRole('dialog', { name: 'Fechar Out/Nov' })
      await within(sheet).findByText('Nada impede o fechamento')
      // Something changed the cycle while the review was open.
      state.preview = closurePreview({ expected_version: 10 })
      await userEvent.click(within(sheet).getByRole('button', { name: 'Fechar o ciclo' }))

      expect(
        await within(sheet).findByText('O ciclo foi alterado; recarregue e tente novamente'),
      ).toBeInTheDocument()
      await waitFor(() => expect(calls.previews).toBe(2))
      expect(screen.getByRole('dialog', { name: 'Fechar Out/Nov' })).toBeInTheDocument()

      await waitFor(() =>
        expect(within(sheet).getByRole('button', { name: 'Fechar o ciclo' })).toBeEnabled(),
      )
      await userEvent.click(within(sheet).getByRole('button', { name: 'Fechar o ciclo' }))
      await waitFor(() =>
        expect(calls.closed).toEqual([{ expected_version: 9 }, { expected_version: 10 }]),
      )
      expect(await within(section()).findByText(/Este ciclo está fechado/)).toBeInTheDocument()
    })

    it('should show the blockers of a 409 in words', async () => {
      mockClosure({
        cycle: ENDED,
        closeFailures: [
          {
            status: 409,
            message: 'O ciclo não pode ser fechado: LATE_MOVEMENTS, OVERDUE_PENDING_MOVEMENTS',
          },
        ],
      })
      renderApp(`/ciclos/${ENDED.code}`)

      await userEvent.click(await screen.findByRole('button', { name: 'Fechar o ciclo' }))
      const sheet = await screen.findByRole('dialog', { name: 'Fechar Out/Nov' })
      await within(sheet).findByText('Nada impede o fechamento')
      await userEvent.click(within(sheet).getByRole('button', { name: 'Fechar o ciclo' }))

      expect(
        await within(sheet).findByText(
          'O ciclo não pode ser fechado: movimentações atrasadas, movimentações pendentes vencidas',
        ),
      ).toBeInTheDocument()
    })

    it('should show an error and a way to retry when the review cannot be loaded', async () => {
      mockClosure({ cycle: ENDED })
      server.use(
        http.post('/api/pay_cycle/:code/closure/preview', () =>
          HttpResponse.json({ message: 'Os ciclos estão desligados' }, { status: 409 }),
        ),
      )
      renderApp(`/ciclos/${ENDED.code}`)

      await userEvent.click(await screen.findByRole('button', { name: 'Fechar o ciclo' }))
      const sheet = await screen.findByRole('dialog', { name: 'Fechar Out/Nov' })

      expect(await within(sheet).findByText('Os ciclos estão desligados')).toBeInTheDocument()
      expect(
        within(sheet).queryByRole('button', { name: 'Fechar o ciclo' }),
      ).not.toBeInTheDocument()
    })
  })

  describe('depois de fechar', () => {
    const closed = payCycle({ ...ENDED, status: 'CLOSED', version: 3 })

    it('should show what was frozen and keep the older closures folded', async () => {
      mockClosure({
        cycle: closed,
        snapshots: [
          payCycleSnapshot({
            code: 's1',
            snapshot_version: 1,
            closed_at: '2026-11-06T17:30:00Z',
            recognized_expense: 3100,
          }),
          payCycleSnapshot({
            code: 's2',
            snapshot_version: 2,
            closed_at: '2026-11-09T12:00:00Z',
            recognized_expense: 3300,
          }),
        ],
      })
      renderApp(`/ciclos/${closed.code}`)

      const history = await within(
        await screen.findByRole('region', { name: 'Fechamento' }),
      ).findByRole('region', { name: 'Fechamentos' })
      // Only the closures, not the category lists inside them.
      const items = Array.from(history.querySelector('ul')!.children) as HTMLElement[]
      // Newest first, even though the back sends them by version.
      expect(within(items[0]!).getByText('Fechamento 2')).toBeInTheDocument()
      expect(within(items[0]!).getByText('Em vigor')).toBeInTheDocument()
      expect(
        within(items[0]!).getByRole('table', { name: 'Totais do fechamento 2' }),
      ).toBeInTheDocument()
      expect(within(items[1]!).getByText('Fechamento 1')).toBeInTheDocument()
      expect(within(items[1]!).queryByText('Em vigor')).not.toBeInTheDocument()
      expect(items[1]!.querySelector('details')).not.toHaveAttribute('open')
    })

    it('should reopen with the version of the cycle after confirming', async () => {
      const { calls } = mockClosure({
        cycle: closed,
        snapshots: [payCycleSnapshot({ code: 's1', cycle_code: closed.code })],
      })
      renderApp(`/ciclos/${closed.code}`)

      await userEvent.click(await screen.findByRole('button', { name: 'Reabrir o ciclo' }))
      const dialog = await screen.findByRole('alertdialog', { name: 'Reabrir Out/Nov?' })
      expect(within(dialog).getByText(/fica guardado no histórico/)).toBeInTheDocument()
      expect(calls.reopened).toEqual([])
      await userEvent.click(within(dialog).getByRole('button', { name: 'Reabrir' }))

      await waitFor(() => expect(calls.reopened).toEqual([{ expected_version: 3 }]))
      expect(await screen.findAllByText('Ciclo reaberto.')).not.toHaveLength(0)
      expect(
        await within(section()).findByRole('button', { name: 'Fechar o ciclo' }),
      ).toBeInTheDocument()
      // The closure that was undone stays in the history, folded and without "Em vigor".
      const history = await within(section()).findByRole('region', {
        name: 'Fechamentos anteriores',
      })
      expect(within(history).getByText('Fechamento 1')).toBeInTheDocument()
      expect(within(history).queryByText('Em vigor')).not.toBeInTheDocument()
    })

    it('should show the message when the back refuses to reopen', async () => {
      mockClosure({
        cycle: closed,
        snapshots: [payCycleSnapshot({ code: 's1' })],
        reopenFailure: { status: 409, message: 'Somente um ciclo fechado pode ser reaberto' },
      })
      renderApp(`/ciclos/${closed.code}`)

      await userEvent.click(await screen.findByRole('button', { name: 'Reabrir o ciclo' }))
      const dialog = await screen.findByRole('alertdialog', { name: 'Reabrir Out/Nov?' })
      await userEvent.click(within(dialog).getByRole('button', { name: 'Reabrir' }))

      expect(
        await within(section()).findByText('Somente um ciclo fechado pode ser reaberto'),
      ).toBeInTheDocument()
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    it('should keep the history but not offer to reopen while the cycles are off', async () => {
      mockClosure({
        cycle: closed,
        config: payCycleConfig(),
        snapshots: [payCycleSnapshot({ code: 's1' })],
      })
      renderApp(`/ciclos/${closed.code}`)

      const history = await within(
        await screen.findByRole('region', { name: 'Fechamento' }),
      ).findByRole('region', { name: 'Fechamentos' })
      expect(within(history).getByText('Fechamento 1')).toBeInTheDocument()
      expect(
        within(section()).queryByRole('button', { name: 'Reabrir o ciclo' }),
      ).not.toBeInTheDocument()
    })

    it('should say there is no record when a closed cycle has no snapshot', async () => {
      mockClosure({ cycle: closed, snapshots: [] })
      renderApp(`/ciclos/${closed.code}`)

      expect(
        await within(await screen.findByRole('region', { name: 'Fechamento' })).findByText(
          'Nenhum registro de fechamento encontrado.',
        ),
      ).toBeInTheDocument()
    })
  })

  describe('movimentações de um ciclo fechado', () => {
    const closedCycle = payCycle({ ...ENDED, status: 'CLOSED', version: 3 })
    const inside = movement({
      code: 'm-in',
      description: 'Mercado de outubro',
      amount: 250,
      competence_date: '2026-10-20',
    })

    function mockMovementIn(item: FinancialMovementResponse, cycles: PayCycleResponse[]) {
      const calls = { byDate: [] as string[], deleted: [] as string[] }
      server.use(
        http.get('/api/pay_cycle', ({ request }) => {
          const date = new URL(request.url).searchParams.get('date')
          if (date) calls.byDate.push(date)
          return HttpResponse.json(
            cycles.filter(
              (cycle) => !date || (cycle.start_date <= date && date < cycle.end_date_exclusive),
            ),
          )
        }),
        http.get('/api/financial_movement', () => HttpResponse.json(page([item]))),
        http.get('/api/financial_movement/:code', () => HttpResponse.json(item)),
        http.get('/api/financial_movement/:code/settlements', () => HttpResponse.json([])),
        http.delete('/api/financial_movement/:code', ({ params }) => {
          calls.deleted.push(String(params.code))
          return new HttpResponse(null, { status: 204 })
        }),
      )
      return calls
    }

    async function openMovement(description: string) {
      renderApp('/movimentacoes?inicio=2026-10-01&fim=2026-10-31')
      await userEvent.click(await screen.findByRole('button', { name: new RegExp(description) }))
      return screen.findByRole('dialog', { name: new RegExp(description) })
    }

    it('should explain that the movement is locked, keep paying and lock only the delete', async () => {
      mockCommonApi({ payCycleConfig: CYCLES_ON })
      mockMovementIn(inside, [closedCycle])
      const sheet = await openMovement('Mercado de outubro')

      const note = await within(sheet).findByRole('note')
      expect(within(note).getByText('O ciclo Out/Nov está fechado.')).toBeInTheDocument()
      expect(within(note).getByRole('link', { name: 'Abrir o ciclo' })).toHaveAttribute(
        'href',
        `/ciclos/${closedCycle.code}`,
      )
      expect(within(sheet).getByRole('button', { name: 'Excluir' })).toBeDisabled()
      expect(within(sheet).getByRole('button', { name: /Pagar/ })).toBeEnabled()
      expect(within(sheet).getByRole('button', { name: 'Editar' })).toBeEnabled()
    })

    it('should warn on the edit form too, which the back still decides', async () => {
      mockCommonApi({ payCycleConfig: CYCLES_ON })
      mockMovementIn(inside, [closedCycle])
      const sheet = await openMovement('Mercado de outubro')

      await userEvent.click(await within(sheet).findByRole('button', { name: 'Editar' }))

      const note = await within(sheet).findByRole('note')
      expect(within(note).getByText('O ciclo Out/Nov está fechado.')).toBeInTheDocument()
      expect(within(note).getByText(/a descrição e o vencimento sim/)).toBeInTheDocument()
      expect(within(sheet).getByRole('button', { name: 'Salvar' })).toBeEnabled()
    })

    it('should not say anything when the cycle of the movement is open', async () => {
      mockCommonApi({ payCycleConfig: CYCLES_ON })
      mockMovementIn(inside, [payCycle({ ...ENDED, status: 'PENDING_CLOSE' })])
      const sheet = await openMovement('Mercado de outubro')

      expect(within(sheet).getByRole('button', { name: 'Editar' })).toBeEnabled()
      expect(within(sheet).getByRole('button', { name: 'Excluir' })).toBeEnabled()
      expect(within(sheet).queryByRole('note')).not.toBeInTheDocument()
    })

    it('should not even ask for the cycle while the cycles are off', async () => {
      mockCommonApi()
      const calls = mockMovementIn(inside, [closedCycle])
      const sheet = await openMovement('Mercado de outubro')

      expect(within(sheet).getByRole('button', { name: 'Excluir' })).toBeEnabled()
      expect(calls.byDate).toEqual([])
    })

    it('should not ask for the cycle of a movement without a competence', async () => {
      mockCommonApi({ payCycleConfig: CYCLES_ON })
      const calls = mockMovementIn({ ...inside, competence_date: null }, [closedCycle])
      const sheet = await openMovement('Mercado de outubro')

      expect(within(sheet).getByRole('button', { name: 'Excluir' })).toBeEnabled()
      expect(calls.byDate).toEqual([])
    })

    it('should let a payment of a movement of a closed cycle go ahead', async () => {
      mockCommonApi({ payCycleConfig: CYCLES_ON })
      mockMovementIn(inside, [closedCycle])
      const sheet = await openMovement('Mercado de outubro')

      await userEvent.click(await within(sheet).findByRole('button', { name: /Pagar/ }))
      expect(
        await within(sheet).findByRole('button', { name: 'Confirmar pagamento' }),
      ).toBeEnabled()
    })
  })
})
