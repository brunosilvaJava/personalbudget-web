import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  IncomeScheduleResponse,
  PayCycleActivationPreviewResponse,
  PayCycleActivationRequest,
  PayCycleAdjustmentResponse,
  PayCycleAnchorTransitionPreviewRequest,
  PayCycleAnchorTransitionPreviewResponse,
  PayCycleAnchorTransitionRequest,
  PayCycleConfigResponse,
  PayCycleDeactivationRequest,
  PayCycleEndAdjustmentPreviewResponse,
  PayCycleEndAdjustmentRequest,
  PayCycleResponse,
  PayCycleSummaryResponse,
} from '@/api/contracts'
import { mockCommonApi } from '@/test/api'
import {
  incomeSchedule,
  payCycle,
  payCycleAdjustment,
  payCycleConfig,
  payCyclePending,
  payCycleSummary,
} from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

const ANCHOR = incomeSchedule({ code: 'anchor-1', description: 'Salário', anchor: true })
const FREELA = incomeSchedule({
  code: 'freela-1',
  description: 'Freela mensal',
  rule_type: 'NTH_BUSINESS_DAY',
  rule_value: 3,
  non_business_day_policy: null,
})

const PREVIOUS = payCycle({
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
const CURRENT = payCycle({ code: 'cycle-now', version: 4 })
const NEXT = payCycle({
  code: 'cycle-next',
  label: 'Dez/Jan',
  start_date: '2026-12-04',
  end_date_exclusive: '2027-01-05',
  last_day: '2027-01-04',
  total_days: 32,
  reference_month: '2026-12',
  status: 'PLANNED',
  version: 7,
})

const CYCLES_ON = payCycleConfig({
  mode: 'PAY_CYCLE',
  anchor_schedule_code: 'anchor-1',
  activation_date: '2026-10-05',
  version: 5,
})

interface CycleMocks {
  config?: PayCycleConfigResponse
  cycles?: PayCycleResponse[]
  current?: PayCycleResponse | null
  summary?: PayCycleSummaryResponse
  adjustments?: PayCycleAdjustmentResponse[]
  schedules?: IncomeScheduleResponse[]
  activationPreview?: PayCycleActivationPreviewResponse
  endPreview?: PayCycleEndAdjustmentPreviewResponse
  anchorPreview?: PayCycleAnchorTransitionPreviewResponse
}

function mockCycles(options: CycleMocks = {}) {
  let config = options.config ?? payCycleConfig({ version: 3 })
  let cycles = options.cycles ?? []
  const schedules = options.schedules ?? [ANCHOR]
  const calls = {
    cycleQueries: [] as string[],
    activationPreviews: [] as unknown[],
    activated: [] as PayCycleActivationRequest[],
    deactivated: [] as PayCycleDeactivationRequest[],
    endPreviews: [] as unknown[],
    adjusted: [] as { code: string; body: PayCycleEndAdjustmentRequest }[],
    anchorPreviews: [] as PayCycleAnchorTransitionPreviewRequest[],
    transitions: [] as PayCycleAnchorTransitionRequest[],
  }
  server.use(
    http.get('/api/pay_cycle_config', () => HttpResponse.json(config)),
    http.get('/api/pay_cycle/current', () =>
      options.current
        ? HttpResponse.json(options.current)
        : HttpResponse.json(
            { message: 'Nenhum ciclo contém a data de hoje', pending: [] },
            { status: 404 },
          ),
    ),
    http.get('/api/pay_cycle', ({ request }) => {
      const query = new URL(request.url).searchParams
      calls.cycleQueries.push(query.toString())
      return HttpResponse.json(
        cycles.filter(
          (cycle) => query.get('include_cancelled') === 'true' || cycle.status !== 'CANCELLED',
        ),
      )
    }),
    http.get('/api/pay_cycle/:code/summary', ({ params }) => {
      const cycle = cycles.find((item) => item.code === params.code)
      return cycle
        ? HttpResponse.json({ ...(options.summary ?? payCycleSummary()), cycle })
        : HttpResponse.json({ message: 'Registro não encontrado' }, { status: 404 })
    }),
    http.get('/api/pay_cycle/:code/adjustment', () => HttpResponse.json(options.adjustments ?? [])),
    http.get('/api/pay_cycle/:code', ({ params }) => {
      const cycle = cycles.find((item) => item.code === params.code)
      return cycle
        ? HttpResponse.json(cycle)
        : HttpResponse.json({ message: 'Registro não encontrado' }, { status: 404 })
    }),
    http.post('/api/pay_cycle/:code/end_adjustment/preview', async ({ request }) => {
      calls.endPreviews.push(await request.json())
      return HttpResponse.json(options.endPreview)
    }),
    http.post('/api/pay_cycle/:code/end_adjustment', async ({ request, params }) => {
      calls.adjusted.push({
        code: String(params.code),
        body: (await request.json()) as PayCycleEndAdjustmentRequest,
      })
      return HttpResponse.json({
        adjustment: payCycleAdjustment(),
        cycle: CURRENT,
        next_cycle: NEXT,
      })
    }),
    http.post('/api/pay_cycle_config/activation/preview', async ({ request }) => {
      calls.activationPreviews.push(await request.json())
      return HttpResponse.json(
        options.activationPreview ?? { expected_version: 3, cycles: [CURRENT, NEXT], pending: [] },
      )
    }),
    http.post('/api/pay_cycle_config/activation', async ({ request }) => {
      const body = (await request.json()) as PayCycleActivationRequest
      calls.activated.push(body)
      config = payCycleConfig({
        mode: 'PAY_CYCLE',
        anchor_schedule_code: 'anchor-1',
        activation_date: body.initial_date,
        version: 4,
      })
      cycles = [CURRENT, NEXT]
      return HttpResponse.json(config)
    }),
    http.post('/api/pay_cycle_config/deactivation', async ({ request }) => {
      calls.deactivated.push((await request.json()) as PayCycleDeactivationRequest)
      config = payCycleConfig({ version: 6 })
      return HttpResponse.json(config)
    }),
    http.post('/api/pay_cycle_config/anchor_transition/preview', async ({ request }) => {
      calls.anchorPreviews.push((await request.json()) as PayCycleAnchorTransitionPreviewRequest)
      return HttpResponse.json(options.anchorPreview)
    }),
    http.post('/api/pay_cycle_config/anchor_transition', async ({ request }) => {
      calls.transitions.push((await request.json()) as PayCycleAnchorTransitionRequest)
      return HttpResponse.json({
        configuration: config,
        adjustment: payCycleAdjustment({ type: 'ANCHOR_TRANSITION' }),
        preserved_cycles: [],
        cancelled_cycles: [],
        new_cycles: [],
      })
    }),
    http.get('/api/income_schedule', ({ request }) => {
      const statuses = new URL(request.url).searchParams.getAll('status')
      return HttpResponse.json(
        schedules.filter((item) => (statuses.length ? statuses : ['ACTIVE']).includes(item.status)),
      )
    }),
    http.get('/api/income_schedule/:code', ({ params }) => {
      const found = schedules.find((item) => item.code === params.code)
      return found
        ? HttpResponse.json(found)
        : HttpResponse.json({ message: 'Registro não encontrado' }, { status: 404 })
    }),
    http.get('/api/income_schedule/:code/occurrence', () => HttpResponse.json([])),
    http.get('/api/fixed_bill', () =>
      HttpResponse.json({
        content: [],
        page: 0,
        size: 20,
        total_elements: 0,
        total_pages: 0,
        first: true,
        last: true,
      }),
    ),
  )
  return calls
}

describe('Ciclos', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T15:00:00Z'))
    mockCommonApi()
  })
  afterEach(() => vi.useRealTimers())

  describe('ligar e desligar', () => {
    it('should say the cycles are off and offer to activate them', async () => {
      mockCycles()
      renderApp('/ciclos')

      expect(await screen.findByText('Mês do calendário')).toBeInTheDocument()
      expect(screen.getByText('desligados')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Ativar os ciclos' })).toBeInTheDocument()
      expect(await screen.findByText('Nenhum ciclo ainda')).toBeInTheDocument()
    })

    it('should list the way to Ciclos in Mais', async () => {
      mockCycles()
      renderApp('/mais')

      const nav = await screen.findByRole('navigation', { name: 'Outras telas' })
      expect(within(nav).getByRole('link', { name: 'Ciclos' })).toHaveAttribute('href', '/ciclos')
    })

    it('should not let the cycles be activated without an active anchor schedule', async () => {
      mockCycles({ schedules: [incomeSchedule({ description: 'Freela', anchor: false })] })
      renderApp('/ciclos')

      await userEvent.click(await screen.findByRole('button', { name: 'Ativar os ciclos' }))
      const sheet = await screen.findByRole('dialog', { name: 'Ativar os ciclos' })

      expect(
        await within(sheet).findByText(/Nenhuma receita ativa abre os ciclos/),
      ).toBeInTheDocument()
      expect(within(sheet).getByRole('link', { name: 'Receita › Agenda' })).toHaveAttribute(
        'href',
        '/receita/agenda',
      )
      expect(within(sheet).getByRole('button', { name: 'Ver os primeiros ciclos' })).toBeDisabled()
    })

    it('should activate in two steps: see the first cycles, then confirm with the version', async () => {
      const calls = mockCycles()
      renderApp('/ciclos')

      await userEvent.click(await screen.findByRole('button', { name: 'Ativar os ciclos' }))
      const sheet = await screen.findByRole('dialog', { name: 'Ativar os ciclos' })
      expect(await within(sheet).findByText('Salário')).toBeInTheDocument()
      expect(
        within(sheet).getByText('Dia 5 de cada mês, antecipada se não for dia útil'),
      ).toBeInTheDocument()
      expect(within(sheet).getByLabelText('Primeiro dia do primeiro ciclo')).toHaveValue(
        '2026-11-10',
      )

      await userEvent.click(within(sheet).getByRole('button', { name: 'Ver os primeiros ciclos' }))
      expect(await within(sheet).findByText('Nov/Dez')).toBeInTheDocument()
      expect(within(sheet).getByText('Dez/Jan')).toBeInTheDocument()
      expect(within(sheet).getByText('05/11 a 03/12 · 29 dias')).toBeInTheDocument()
      expect(calls.activationPreviews).toEqual([{ initial_date: '2026-11-10' }])
      expect(calls.activated).toEqual([])

      await userEvent.click(within(sheet).getByRole('button', { name: 'Ativar os ciclos' }))

      await waitFor(() =>
        expect(calls.activated).toEqual([{ initial_date: '2026-11-10', expected_version: 3 }]),
      )
      expect(await screen.findByText('Ciclos ativados a partir de 10/11/2026.')).toBeInTheDocument()
      expect(await screen.findByText('Ciclos da receita âncora')).toBeInTheDocument()
      expect(screen.getByText('ligados desde 10/11/2026')).toBeInTheDocument()
    })

    it('should not offer to activate when the first cycle cannot be calculated, and say why', async () => {
      const calls = mockCycles({
        activationPreview: {
          expected_version: 3,
          cycles: [],
          pending: [payCyclePending({ type: 'CALENDAR_NOT_REVIEWED', year: 2026 })],
        },
      })
      renderApp('/ciclos')

      await userEvent.click(await screen.findByRole('button', { name: 'Ativar os ciclos' }))
      const sheet = await screen.findByRole('dialog', { name: 'Ativar os ciclos' })
      await userEvent.click(
        await within(sheet).findByRole('button', { name: 'Ver os primeiros ciclos' }),
      )

      expect(
        await within(sheet).findByText(/Ainda não dá para calcular o primeiro ciclo/),
      ).toBeInTheDocument()
      expect(within(sheet).getByText('O calendário de 2026 não está revisado.')).toBeInTheDocument()
      expect(within(sheet).getByRole('link', { name: 'Revisar 2026' })).toHaveAttribute(
        'href',
        '/receita/calendario?ano=2026',
      )
      expect(within(sheet).getByRole('button', { name: 'Ativar os ciclos' })).toBeDisabled()
      expect(calls.activated).toEqual([])
    })

    it('should refuse a first day more than 31 days away without asking the back', async () => {
      const calls = mockCycles()
      renderApp('/ciclos')

      await userEvent.click(await screen.findByRole('button', { name: 'Ativar os ciclos' }))
      const sheet = await screen.findByRole('dialog', { name: 'Ativar os ciclos' })
      await within(sheet).findByText('Salário')
      fireEvent.change(within(sheet).getByLabelText('Primeiro dia do primeiro ciclo'), {
        target: { value: '2027-01-15' },
      })
      await userEvent.click(within(sheet).getByRole('button', { name: 'Ver os primeiros ciclos' }))

      expect(
        await within(sheet).findByText('Use uma data entre 10/10/2026 e 11/12/2026.'),
      ).toBeInTheDocument()
      expect(calls.activationPreviews).toEqual([])
    })

    it('should deactivate only with a justification, and send the version', async () => {
      const calls = mockCycles({
        config: CYCLES_ON,
        cycles: [PREVIOUS, CURRENT, NEXT],
        current: CURRENT,
      })
      renderApp('/ciclos')

      await userEvent.click(await screen.findByRole('button', { name: 'Desligar os ciclos' }))
      const sheet = await screen.findByRole('dialog', { name: 'Desligar os ciclos' })
      expect(
        within(sheet).getByText(/Os ciclos que ainda não começaram são cancelados/),
      ).toBeInTheDocument()

      await userEvent.click(within(sheet).getByRole('button', { name: 'Desligar os ciclos' }))
      expect(
        await within(sheet).findByText('Explique o motivo: ele fica no histórico.'),
      ).toBeInTheDocument()
      expect(calls.deactivated).toEqual([])

      await userEvent.type(
        within(sheet).getByLabelText('Motivo'),
        'Voltei a usar o mês do calendário',
      )
      await userEvent.click(within(sheet).getByRole('button', { name: 'Desligar os ciclos' }))

      await waitFor(() =>
        expect(calls.deactivated).toEqual([
          { expected_version: 5, justification: 'Voltei a usar o mês do calendário' },
        ]),
      )
      expect(await screen.findByText('Ciclos desligados.')).toBeInTheDocument()
      expect(await screen.findByText('Mês do calendário')).toBeInTheDocument()
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      // The sheet is not left "open" behind the screen: turning the cycles on again does not bring it back.
      expect(screen.getByRole('button', { name: 'Ativar os ciclos' })).toBeInTheDocument()
    })

    it('should show the 409 of a configuration changed elsewhere', async () => {
      mockCycles({ config: CYCLES_ON, cycles: [CURRENT], current: CURRENT })
      server.use(
        http.post('/api/pay_cycle_config/deactivation', () =>
          HttpResponse.json(
            {
              message:
                'A configuração dos ciclos foi alterada por outra operação; recarregue e tente novamente',
            },
            { status: 409 },
          ),
        ),
      )
      renderApp('/ciclos')

      await userEvent.click(await screen.findByRole('button', { name: 'Desligar os ciclos' }))
      const sheet = await screen.findByRole('dialog', { name: 'Desligar os ciclos' })
      await userEvent.type(within(sheet).getByLabelText('Motivo'), 'Teste')
      await userEvent.click(within(sheet).getByRole('button', { name: 'Desligar os ciclos' }))

      expect(
        await within(sheet).findByText(/foi alterada por outra operação; recarregue/),
      ).toBeInTheDocument()
    })
  })

  describe('lista e ciclo atual', () => {
    it('should show the current cycle with its totals, and the list newest first', async () => {
      mockCycles({
        config: {
          ...CYCLES_ON,
          pending: [payCyclePending({ type: 'CALENDAR_NOT_REVIEWED', year: 2027 })],
        },
        cycles: [PREVIOUS, CURRENT, NEXT],
        current: CURRENT,
      })
      renderApp('/ciclos')

      expect(await screen.findByText('Ciclos da receita âncora')).toBeInTheDocument()
      expect(screen.getByText('ligados desde 05/10/2026')).toBeInTheDocument()
      expect(await screen.findByRole('link', { name: 'Salário' })).toHaveAttribute(
        'href',
        '/receita/agenda/anchor-1',
      )
      expect(screen.getByText('O calendário de 2027 não está revisado.')).toBeInTheDocument()

      const current = screen.getByRole('region', { name: 'Ciclo atual' })
      expect(within(current).getByText('Nov/Dez')).toBeInTheDocument()
      expect(within(current).getByText(/faltam 24 dias/)).toBeInTheDocument()
      const totals = await within(current).findByRole('table', { name: 'Totais do ciclo' })
      expect(within(totals).getByRole('row', { name: /Receitas/ })).toHaveTextContent(
        /R\$\s5\.000,00.*R\$\s5\.000,00/,
      )
      expect(within(totals).getByRole('row', { name: /Despesas/ })).toHaveTextContent(
        /R\$\s1\.800,00.*R\$\s3\.200,00/,
      )
      expect(within(totals).getByRole('row', { name: /Resultado/ })).toHaveTextContent(
        /\+R\$\s3\.200,00.*\+R\$\s1\.800,00/,
      )

      const list = screen.getByRole('region', { name: 'Todos os ciclos' })
      const rows = within(list).getAllByRole('link')
      expect(rows.map((row) => row.textContent)).toEqual([
        expect.stringContaining('Dez/Jan'),
        expect.stringContaining('Nov/Dez'),
        expect.stringContaining('Out/Nov'),
      ])
      expect(within(rows[0]!).getByText('Planejado')).toBeInTheDocument()
      expect(within(rows[1]!).getByText('Aberto')).toBeInTheDocument()
      expect(within(rows[2]!).getByText('A fechar')).toBeInTheDocument()
      expect(rows[1]).toHaveAttribute('href', '/ciclos/cycle-now')
    })

    it('should send a diverging boundary to the cycle that starts on it', async () => {
      mockCycles({
        config: {
          ...CYCLES_ON,
          pending: [
            payCyclePending({
              type: 'BOUNDARY_DIVERGES_FROM_ANCHOR',
              year: null,
              cycle_code: 'cycle-next',
              boundary_date: '2026-12-04',
              anchor_date: '2026-12-03',
            }),
          ],
        },
        cycles: [CURRENT, NEXT],
        current: CURRENT,
      })
      renderApp('/ciclos')

      expect(
        await screen.findByText(
          'A virada de 04/12/2026 fica diferente da receita âncora, que cai em 03/12/2026.',
        ),
      ).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Abrir o ciclo' })).toHaveAttribute(
        'href',
        '/ciclos/cycle-next',
      )
    })

    it('should say when today is in no cycle', async () => {
      mockCycles({ config: CYCLES_ON, cycles: [NEXT], current: null })
      renderApp('/ciclos')

      expect(await screen.findByText(/Hoje não cai em nenhum ciclo/)).toBeInTheDocument()
    })

    it('should ask for the cancelled cycles only when asked', async () => {
      const calls = mockCycles({
        cycles: [CURRENT, payCycle({ code: 'cycle-old', label: 'Antigo', status: 'CANCELLED' })],
      })
      renderApp('/ciclos')

      await screen.findByText('Nov/Dez')
      expect(screen.queryByText('Antigo')).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole('switch', { name: 'Mostrar cancelados' }))

      expect(
        await screen.findByText('Cancelado', { selector: 'span.font-medium' }),
      ).toBeInTheDocument()
      expect(calls.cycleQueries).toContain('include_cancelled=true')
    })
  })

  describe('um ciclo', () => {
    it('should show the report by category, the pendencies of the cycle and its history', async () => {
      mockCycles({
        config: CYCLES_ON,
        cycles: [PREVIOUS, CURRENT, NEXT],
        adjustments: [payCycleAdjustment({ justification: 'Salário caiu um dia antes' })],
      })
      renderApp('/ciclos/cycle-now')

      expect(
        await screen.findByRole('heading', { name: 'Ciclo Nov/Dez', level: 1 }),
      ).toBeInTheDocument()
      expect(screen.getByText('05/11 a 03/12 · 29 dias')).toBeInTheDocument()
      const revenues = await screen.findByRole('region', { name: 'Receitas por categoria' })
      expect(within(revenues).getByText('Salário')).toBeInTheDocument()
      const expenses = screen.getByRole('region', { name: 'Despesas por categoria' })
      expect(within(expenses).getByText('Mercado')).toBeInTheDocument()
      expect(
        within(expenses).getByText('Pago R$ 800,00 · projetado R$ 1.500,00'),
      ).toBeInTheDocument()

      const history = screen.getByRole('region', { name: 'Histórico de ajustes' })
      expect(await within(history).findByText('Virada ajustada')).toBeInTheDocument()
      expect(within(history).getByText('04/12/2026 → 03/12/2026')).toBeInTheDocument()
      expect(within(history).getByText('“Salário caiu um dia antes”')).toBeInTheDocument()
    })

    it('should warn that the projection is incomplete and say what is missing', async () => {
      mockCycles({
        config: CYCLES_ON,
        cycles: [CURRENT, NEXT],
        summary: payCycleSummary({
          projection_incomplete: true,
          pending: [
            {
              source: 'INCOME_SCHEDULE',
              type: 'CALENDAR_NOT_REVIEWED',
              source_code: 'anchor-1',
              nominal_month: '2026-12',
              year: 2027,
              boundary_date: null,
              anchor_date: null,
            },
          ],
        }),
      })
      renderApp('/ciclos/cycle-now')

      expect(await screen.findByText('A projeção está incompleta')).toBeInTheDocument()
      expect(screen.getByText('O calendário de 2027 não está revisado.')).toBeInTheDocument()
    })

    it('should say the cycle no longer exists on a stale link', async () => {
      mockCycles({ config: CYCLES_ON, cycles: [CURRENT] })
      renderApp('/ciclos/nao-existe')

      expect(await screen.findByText('Este registro não existe mais')).toBeInTheDocument()
    })

    it('should not offer to adjust the last cycle, and say why', async () => {
      mockCycles({ config: CYCLES_ON, cycles: [PREVIOUS, CURRENT] })
      renderApp('/ciclos/cycle-now')

      expect(await screen.findByText(/Este é o último ciclo/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Ajustar a virada' })).not.toBeInTheDocument()
    })

    it('should not offer to adjust a closed cycle', async () => {
      mockCycles({
        config: CYCLES_ON,
        cycles: [payCycle({ code: 'cycle-now', status: 'CLOSED', version: 4 }), NEXT],
      })
      renderApp('/ciclos/cycle-now')

      expect(await screen.findByText('Este ciclo está fechado.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Ajustar a virada' })).not.toBeInTheDocument()
    })

    it('should not show the adjustment while the cycles are off', async () => {
      mockCycles({ cycles: [CURRENT, NEXT] })
      renderApp('/ciclos/cycle-now')

      await screen.findByRole('heading', { name: 'Ciclo Nov/Dez', level: 1 })
      expect(screen.queryByRole('heading', { name: 'Virada do ciclo' })).not.toBeInTheDocument()
    })
  })

  describe('ajustar a virada', () => {
    const END_PREVIEW: PayCycleEndAdjustmentPreviewResponse = {
      old_end_date: '2026-12-04',
      new_end_date: '2026-12-02',
      expected_version: 4,
      expected_next_version: 7,
      cycles_before: [CURRENT, NEXT],
      cycles_after: [
        {
          ...CURRENT,
          end_date_exclusive: '2026-12-02',
          last_day: '2026-12-01',
          total_days: 27,
          end_adjusted: true,
        },
        { ...NEXT, start_date: '2026-12-02', total_days: 34, start_adjusted: true },
      ],
      leaving_cycle_code: 'cycle-now',
      receiving_cycle_code: 'cycle-next',
      movements: [
        {
          code: 'm-1',
          description: 'Conta de luz',
          operation_type: 'DEBIT',
          amount: 210.5,
          status: 'PENDING',
          competence_date: '2026-12-03',
          category_code: null,
        },
      ],
      income_occurrences: [
        {
          schedule_code: 'anchor-1',
          schedule_description: 'Freela mensal',
          nominal_month: '2026-12',
          state: 'PROJECTED',
          planned_date: '2026-12-02',
          amount: 800,
          movement_code: null,
        },
      ],
    }

    async function openAdjustment() {
      await userEvent.click(await screen.findByRole('button', { name: 'Ajustar a virada' }))
      return screen.findByRole('dialog', { name: 'Ajustar a virada' })
    }

    it('should see what moves, then ask why, and send both versions', async () => {
      const calls = mockCycles({
        config: CYCLES_ON,
        cycles: [PREVIOUS, CURRENT, NEXT],
        endPreview: END_PREVIEW,
      })
      renderApp('/ciclos/cycle-now')

      const sheet = await openAdjustment()
      const date = within(sheet).getByLabelText('Novo primeiro dia de Dez/Jan')
      expect(date).toHaveAttribute('min', '2026-11-06')
      expect(date).toHaveAttribute('max', '2027-01-04')
      fireEvent.change(date, { target: { value: '2026-12-02' } })
      await userEvent.click(within(sheet).getByRole('button', { name: 'Ver o que muda' }))

      expect(await within(sheet).findByText(/A virada passa de/)).toHaveTextContent(
        'A virada passa de 04/12/2026 para 02/12/2026. Os dias 02/12/2026 a 03/12/2026 saem de Nov/Dez e entram em Dez/Jan.',
      )
      expect(calls.endPreviews).toEqual([{ new_end_date: '2026-12-02' }])
      expect(within(sheet).getByText('Conta de luz')).toBeInTheDocument()
      expect(within(sheet).getByText('-R$ 210,50')).toBeInTheDocument()
      expect(within(sheet).getByText('02/12/2026 · Prevista')).toBeInTheDocument()
      expect(calls.adjusted).toEqual([])

      await userEvent.click(within(sheet).getByRole('button', { name: 'Ajustar a virada' }))
      expect(
        await within(sheet).findByText('Explique o motivo: ele fica no histórico.'),
      ).toBeInTheDocument()
      expect(calls.adjusted).toEqual([])

      await userEvent.type(within(sheet).getByLabelText('Motivo'), 'Salário caiu mais cedo')
      await userEvent.click(within(sheet).getByRole('button', { name: 'Ajustar a virada' }))

      await waitFor(() =>
        expect(calls.adjusted).toEqual([
          {
            code: 'cycle-now',
            body: {
              new_end_date: '2026-12-02',
              justification: 'Salário caiu mais cedo',
              expected_version: 4,
              expected_next_version: 7,
            },
          },
        ]),
      )
      expect(await screen.findByText('Virada ajustada.')).toBeInTheDocument()
    })

    it('should tell it and close the sheet even when the refreshed cycles take it off the screen first', async () => {
      mockCycles({
        config: CYCLES_ON,
        cycles: [PREVIOUS, CURRENT, NEXT],
        endPreview: END_PREVIEW,
      })
      const movedCurrent = {
        ...CURRENT,
        end_date_exclusive: '2026-12-02',
        last_day: '2026-12-01',
        total_days: 27,
        end_adjusted: true,
        version: 5,
      }
      const movedNext = { ...NEXT, start_date: '2026-12-02', total_days: 34, start_adjusted: true }
      let adjusted = false
      server.use(
        http.post('/api/pay_cycle/:code/end_adjustment', () => {
          adjusted = true
          return HttpResponse.json({
            adjustment: payCycleAdjustment(),
            cycle: movedCurrent,
            next_cycle: movedNext,
          })
        }),
        http.get('/api/pay_cycle/cycle-now', () =>
          HttpResponse.json(adjusted ? movedCurrent : CURRENT),
        ),
        // The list comes after the cycle: for a moment the page has the new end and the old next
        // cycle, finds no cycle that starts there, and drops the sheet.
        http.get('/api/pay_cycle', async () => {
          if (adjusted) await delay(400)
          return HttpResponse.json(
            adjusted ? [PREVIOUS, movedCurrent, movedNext] : [PREVIOUS, CURRENT, NEXT],
          )
        }),
      )
      renderApp('/ciclos/cycle-now')

      const sheet = await openAdjustment()
      fireEvent.change(within(sheet).getByLabelText('Novo primeiro dia de Dez/Jan'), {
        target: { value: '2026-12-02' },
      })
      await userEvent.click(within(sheet).getByRole('button', { name: 'Ver o que muda' }))
      await within(sheet).findByText(/A virada passa de/)
      await userEvent.type(within(sheet).getByLabelText('Motivo'), 'Salário caiu mais cedo')
      await userEvent.click(within(sheet).getByRole('button', { name: 'Ajustar a virada' }))

      // (sonner keeps its toasts between tests, so the one of the test before may be here too)
      expect(await screen.findAllByText('Virada ajustada.')).not.toHaveLength(0)
      expect(await screen.findByText(/Esta virada foi ajustada à mão/)).toBeInTheDocument()
      // Once the list is fresh the button is back, which only happens with the sheet closed (an open
      // sheet hides the page from the accessibility tree) and not put back by the refreshed cycles.
      expect(await screen.findByRole('button', { name: 'Ajustar a virada' })).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('should refuse the same boundary and a date outside the two cycles, without asking the back', async () => {
      const calls = mockCycles({
        config: CYCLES_ON,
        cycles: [PREVIOUS, CURRENT, NEXT],
        endPreview: END_PREVIEW,
      })
      renderApp('/ciclos/cycle-now')

      const sheet = await openAdjustment()
      const date = within(sheet).getByLabelText('Novo primeiro dia de Dez/Jan')
      fireEvent.change(date, { target: { value: '2026-12-04' } })
      await userEvent.click(within(sheet).getByRole('button', { name: 'Ver o que muda' }))
      expect(
        await within(sheet).findByText('Escolha uma data diferente de hoje (04/12/2026).'),
      ).toBeInTheDocument()

      fireEvent.change(date, { target: { value: '2027-02-01' } })
      await userEvent.click(within(sheet).getByRole('button', { name: 'Ver o que muda' }))
      expect(
        await within(sheet).findByText(/Use uma data entre 06\/11\/2026 e 04\/01\/2027/),
      ).toBeInTheDocument()
      expect(calls.endPreviews).toEqual([])
    })

    it('should come back to the date from the review', async () => {
      mockCycles({ config: CYCLES_ON, cycles: [PREVIOUS, CURRENT, NEXT], endPreview: END_PREVIEW })
      renderApp('/ciclos/cycle-now')

      const sheet = await openAdjustment()
      fireEvent.change(within(sheet).getByLabelText('Novo primeiro dia de Dez/Jan'), {
        target: { value: '2026-12-02' },
      })
      await userEvent.click(within(sheet).getByRole('button', { name: 'Ver o que muda' }))
      await within(sheet).findByText(/A virada passa de/)
      await userEvent.click(within(sheet).getByRole('button', { name: 'Voltar e editar' }))

      expect(
        await within(sheet).findByLabelText('Novo primeiro dia de Dez/Jan'),
      ).toBeInTheDocument()
    })

    it('should show the 409 of a cycle changed elsewhere', async () => {
      mockCycles({ config: CYCLES_ON, cycles: [PREVIOUS, CURRENT, NEXT], endPreview: END_PREVIEW })
      server.use(
        http.post('/api/pay_cycle/:code/end_adjustment', () =>
          HttpResponse.json(
            { message: 'O ciclo foi alterado por outra operação; recarregue e tente novamente' },
            { status: 409 },
          ),
        ),
      )
      renderApp('/ciclos/cycle-now')

      const sheet = await openAdjustment()
      fireEvent.change(within(sheet).getByLabelText('Novo primeiro dia de Dez/Jan'), {
        target: { value: '2026-12-02' },
      })
      await userEvent.click(within(sheet).getByRole('button', { name: 'Ver o que muda' }))
      await within(sheet).findByText(/A virada passa de/)
      await userEvent.type(within(sheet).getByLabelText('Motivo'), 'Teste')
      await userEvent.click(within(sheet).getByRole('button', { name: 'Ajustar a virada' }))

      expect(
        await within(sheet).findByText(
          'O ciclo foi alterado por outra operação; recarregue e tente novamente',
        ),
      ).toBeInTheDocument()
    })

    it('should show the 400 of the justification under its field', async () => {
      mockCycles({ config: CYCLES_ON, cycles: [PREVIOUS, CURRENT, NEXT], endPreview: END_PREVIEW })
      server.use(
        http.post('/api/pay_cycle/:code/end_adjustment', () =>
          HttpResponse.json(
            { message: 'Dados inválidos', validations: { justification: 'deve ser informada' } },
            { status: 400 },
          ),
        ),
      )
      renderApp('/ciclos/cycle-now')

      const sheet = await openAdjustment()
      fireEvent.change(within(sheet).getByLabelText('Novo primeiro dia de Dez/Jan'), {
        target: { value: '2026-12-02' },
      })
      await userEvent.click(within(sheet).getByRole('button', { name: 'Ver o que muda' }))
      await within(sheet).findByText(/A virada passa de/)
      await userEvent.type(within(sheet).getByLabelText('Motivo'), 'x')
      await userEvent.click(within(sheet).getByRole('button', { name: 'Ajustar a virada' }))

      expect(await within(sheet).findByText('deve ser informada')).toBeInTheDocument()
    })
  })

  describe('mudar a receita âncora', () => {
    const PREVIEW: PayCycleAnchorTransitionPreviewResponse = {
      expected_version: 5,
      previous_anchor_schedule_code: 'anchor-1',
      anchor_schedule_code: 'anchor-1',
      frozen_boundary: '2026-12-04',
      old_boundary: '2027-01-05',
      new_boundary: '2027-01-28',
      transition_shape: null,
      preserved_cycles: [PREVIOUS, CURRENT],
      cancelled_cycles: [NEXT],
      new_cycles: [
        payCycle({
          code: 'new-1',
          label: 'Dez/Jan',
          start_date: '2026-12-04',
          end_date_exclusive: '2027-01-28',
          last_day: '2027-01-27',
          total_days: 55,
        }),
      ],
      pending: [],
    }

    it('should change only the rule fields that changed, see the new chain, then send the version', async () => {
      const calls = mockCycles({
        config: CYCLES_ON,
        cycles: [PREVIOUS, CURRENT, NEXT],
        current: CURRENT,
        anchorPreview: PREVIEW,
      })
      renderApp('/ciclos')

      await userEvent.click(await screen.findByRole('button', { name: 'Mudar a receita âncora' }))
      const sheet = await screen.findByRole('dialog', { name: 'Mudar a receita âncora' })
      // No other active schedule: switching is not possible, the rule is what can change.
      expect(await within(sheet).findByRole('radio', { name: 'Trocar de receita' })).toBeDisabled()
      expect(within(sheet).getByLabelText('Dia do mês')).toHaveValue(5)

      // Nothing changed yet.
      await userEvent.click(within(sheet).getByRole('button', { name: 'Ver o que muda' }))
      expect(
        await within(sheet).findByText(
          'Mude ao menos um campo da regra, ou escolha outra receita.',
        ),
      ).toBeInTheDocument()
      expect(calls.anchorPreviews).toEqual([])

      const day = within(sheet).getByLabelText('Dia do mês')
      await userEvent.clear(day)
      await userEvent.type(day, '28')
      await userEvent.click(within(sheet).getByRole('button', { name: 'Ver o que muda' }))

      expect(await within(sheet).findByText('muda.', { exact: false })).toBeInTheDocument()
      expect(calls.anchorPreviews).toEqual([{ rule_value: 28 }])
      expect(within(sheet).getByText(/A regra de/)).toHaveTextContent('A regra de Salário muda.')
      expect(within(sheet).getByText(/A próxima virada passa de/)).toHaveTextContent(
        'A próxima virada passa de 05/01/2027 para 28/01/2027.',
      )
      expect(within(sheet).getByText(/2 ciclos continuam como estão/)).toBeInTheDocument()
      expect(
        within(sheet).getByRole('heading', { name: 'Ciclos que serão cancelados (1)' }),
      ).toBeInTheDocument()
      expect(within(sheet).getByRole('heading', { name: 'Ciclos novos (1)' })).toBeInTheDocument()
      expect(within(sheet).getByText('04/12/2026 a 27/01/2027 · 55 dias')).toBeInTheDocument()
      expect(calls.transitions).toEqual([])

      await userEvent.type(
        within(sheet).getByLabelText('Motivo'),
        'O salário passou a cair no dia 28',
      )
      await userEvent.click(within(sheet).getByRole('button', { name: 'Mudar a âncora' }))

      await waitFor(() =>
        expect(calls.transitions).toEqual([
          {
            rule_value: 28,
            justification: 'O salário passou a cair no dia 28',
            expected_version: 5,
          },
        ]),
      )
      expect(await screen.findByText('Receita âncora atualizada.')).toBeInTheDocument()
    })

    it('should switch to another schedule and ask for the shape when the back asks for it', async () => {
      const calls = mockCycles({
        config: CYCLES_ON,
        cycles: [PREVIOUS, CURRENT, NEXT],
        current: CURRENT,
        schedules: [ANCHOR, FREELA],
        anchorPreview: {
          ...PREVIEW,
          anchor_schedule_code: 'freela-1',
          transition_shape: 'SHORT',
        },
      })
      let asked = 0
      server.use(
        http.post('/api/pay_cycle_config/anchor_transition/preview', async ({ request }) => {
          const body = (await request.json()) as PayCycleAnchorTransitionPreviewRequest
          calls.anchorPreviews.push(body)
          asked += 1
          if (!body.transition_shape) {
            return HttpResponse.json(
              {
                message: 'Dados inválidos',
                validations: { transition_shape: 'deve ser informado como SHORT ou LONG' },
              },
              { status: 400 },
            )
          }
          return HttpResponse.json({
            ...PREVIEW,
            anchor_schedule_code: 'freela-1',
            transition_shape: body.transition_shape,
          })
        }),
      )
      renderApp('/ciclos')

      await userEvent.click(await screen.findByRole('button', { name: 'Mudar a receita âncora' }))
      const sheet = await screen.findByRole('dialog', { name: 'Mudar a receita âncora' })
      // With another active schedule, switching is the first choice.
      expect(await within(sheet).findByRole('radio', { name: 'Trocar de receita' })).toBeChecked()
      expect(
        within(sheet).queryByRole('radiogroup', { name: 'Formato do ciclo de transição' }),
      ).not.toBeInTheDocument()

      await userEvent.click(within(sheet).getByRole('combobox', { name: 'Nova receita âncora' }))
      await userEvent.click(await screen.findByRole('option', { name: /Freela mensal/ }))
      await userEvent.click(within(sheet).getByRole('button', { name: 'Ver o que muda' }))

      // The back wants the shape: the choice shows up and the form stays.
      expect(
        await within(sheet).findByRole('radiogroup', { name: 'Formato do ciclo de transição' }),
      ).toBeInTheDocument()
      expect(within(sheet).getByText('deve ser informado como SHORT ou LONG')).toBeInTheDocument()
      await userEvent.click(within(sheet).getByRole('radio', { name: 'Curto' }))
      await userEvent.click(within(sheet).getByRole('button', { name: 'Ver o que muda' }))

      expect(await within(sheet).findByText(/Ciclo de transição/)).toHaveTextContent(
        'Ciclo de transição curto: Um ciclo de transição mais curto',
      )
      expect(within(sheet).getByText(/A receita âncora passa de/)).toHaveTextContent(
        'A receita âncora passa de Salário para Freela mensal.',
      )
      expect(asked).toBe(2)
      expect(calls.anchorPreviews).toEqual([
        { anchor_schedule_code: 'freela-1' },
        { anchor_schedule_code: 'freela-1', transition_shape: 'SHORT' },
      ])

      await userEvent.type(within(sheet).getByLabelText('Motivo'), 'Mudei de emprego')
      await userEvent.click(within(sheet).getByRole('button', { name: 'Mudar a âncora' }))

      await waitFor(() =>
        expect(calls.transitions).toEqual([
          {
            anchor_schedule_code: 'freela-1',
            transition_shape: 'SHORT',
            justification: 'Mudei de emprego',
            expected_version: 5,
          },
        ]),
      )
    })

    it('should open the transition from the link on the anchor schedule', async () => {
      mockCycles({ config: CYCLES_ON, cycles: [CURRENT, NEXT], current: CURRENT })
      renderApp('/receita/agenda/anchor-1')

      const note = await screen.findByRole('note')
      expect(note).toHaveTextContent(/só mudam pela transição de âncora/)
      await userEvent.click(within(note).getByRole('link', { name: 'Mudar a receita âncora' }))

      expect(
        await screen.findByRole('dialog', { name: 'Mudar a receita âncora' }),
      ).toBeInTheDocument()
    })

    it('should not show the note on another schedule, nor while the cycles are off', async () => {
      mockCycles({ config: CYCLES_ON, schedules: [ANCHOR, FREELA] })
      const first = renderApp('/receita/agenda/freela-1')
      await screen.findByRole('heading', { name: 'Freela mensal', level: 1 })
      expect(screen.queryByRole('note')).not.toBeInTheDocument()
      first.unmount()

      mockCycles({ schedules: [ANCHOR] })
      renderApp('/receita/agenda/anchor-1')
      await screen.findByRole('heading', { name: 'Salário', level: 1 })
      expect(screen.queryByRole('note')).not.toBeInTheDocument()
    })
  })
})
