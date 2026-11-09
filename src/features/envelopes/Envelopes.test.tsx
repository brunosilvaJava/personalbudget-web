import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  BudgetEnvelopeRequest,
  BudgetEnvelopeResponse,
  BudgetEnvelopeUpdateRequest,
  CycleEnvelopesResponse,
  PayCycleResponse,
} from '@/api/contracts'
import { mockCommonApi } from '@/test/api'
import { categories, cycleEnvelopes, envelope, payCycle } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

const CYCLE = payCycle({ code: 'cycle-now' })
const MERCADO = envelope({ code: 'env-mercado', cycle_code: CYCLE.code })
const ENERGIA = envelope({
  code: 'env-energia',
  cycle_code: CYCLE.code,
  category_code: categories.energia.code,
  category_name: 'Energia',
  planned_amount: 300,
  recognized_amount: 335,
  committed_amount: 0,
  consumed_amount: 335,
  remaining_amount: -35,
  reserved_amount: 0,
  overrun_amount: 35,
})

interface EnvelopeMocks {
  cycle?: PayCycleResponse
  envelopes?: BudgetEnvelopeResponse[]
  report?: Partial<CycleEnvelopesResponse>
  /** answers the write with this error instead of applying it */
  failWrite?: { status: number; body: Record<string, unknown> }
}

function mockEnvelopes(options: EnvelopeMocks = {}) {
  const cycle = options.cycle ?? CYCLE
  let list = options.envelopes ?? [MERCADO]
  const calls = {
    created: [] as { cycle: string; body: BudgetEnvelopeRequest }[],
    updated: [] as { code: string; body: BudgetEnvelopeUpdateRequest }[],
    deleted: [] as string[],
  }
  const fail = () =>
    options.failWrite ? HttpResponse.json(options.failWrite.body, options.failWrite) : null
  server.use(
    http.get('/api/pay_cycle/:code/envelope', () =>
      HttpResponse.json(cycleEnvelopes(list, { cycle_code: cycle.code, ...options.report })),
    ),
    http.post('/api/pay_cycle/:code/envelope', async ({ request, params }) => {
      const body = (await request.json()) as BudgetEnvelopeRequest
      const failure = fail()
      if (failure) return failure
      calls.created.push({ cycle: String(params.code), body })
      const created = envelope({
        code: `env-${body.category_code}`,
        cycle_code: cycle.code,
        category_code: body.category_code,
        category_name: body.category_code === categories.padaria.code ? 'Padaria' : 'Gás',
        planned_amount: body.planned_amount,
        recognized_amount: 0,
        committed_amount: 0,
        consumed_amount: 0,
        remaining_amount: body.planned_amount,
        reserved_amount: body.planned_amount,
      })
      list = [...list, created]
      return HttpResponse.json(created, { status: 201 })
    }),
    http.patch('/api/envelope/:code', async ({ request, params }) => {
      const body = (await request.json()) as BudgetEnvelopeUpdateRequest
      const failure = fail()
      if (failure) return failure
      calls.updated.push({ code: String(params.code), body })
      const current = list.find((item) => item.code === params.code)!
      const updated = {
        ...current,
        planned_amount: body.planned_amount,
        remaining_amount: body.planned_amount - current.consumed_amount,
        reserved_amount: Math.max(body.planned_amount - current.consumed_amount, 0),
      }
      list = list.map((item) => (item.code === updated.code ? updated : item))
      return HttpResponse.json(updated)
    }),
    http.delete('/api/envelope/:code', ({ params }) => {
      const failure = fail()
      if (failure) return failure
      calls.deleted.push(String(params.code))
      list = list.filter((item) => item.code !== params.code)
      return new HttpResponse(null, { status: 204 })
    }),
    // before ':code', which would otherwise take "current" for a code
    http.get('/api/pay_cycle/current', () => HttpResponse.json(cycle)),
    http.get('/api/pay_cycle/:code', ({ params }) =>
      params.code === cycle.code
        ? HttpResponse.json(cycle)
        : HttpResponse.json({ message: 'Registro não encontrado' }, { status: 404 }),
    ),
  )
  return calls
}

describe('Envelopes do ciclo', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T15:00:00Z'))
    mockCommonApi({ currentCycle: CYCLE })
  })
  afterEach(() => vi.useRealTimers())

  describe('consulta', () => {
    it('should show what is planned, spent and left in each envelope', async () => {
      mockEnvelopes({ envelopes: [MERCADO, ENERGIA] })
      renderApp('/ciclos/cycle-now/envelopes')

      expect(await screen.findByRole('heading', { name: /Envelopes · Nov\/Dez/ })).toBeVisible()
      const list = await screen.findByRole('list', { name: 'Envelopes do ciclo' })
      const mercado = within(list).getByRole('heading', { name: 'Mercado' }).closest('li')!
      expect(within(mercado).getByText('Planejado R$ 800,00')).toBeInTheDocument()
      expect(within(mercado).getByText('Restam R$ 400,00')).toBeInTheDocument()
      expect(within(mercado).getByText('Pago R$ 300,00 · A pagar R$ 100,00')).toBeInTheDocument()
      expect(within(mercado).getByText('Reservado na previsão: R$ 400,00')).toBeInTheDocument()
      expect(
        within(mercado).getByRole('progressbar', { name: 'Gasto de Mercado' }),
      ).toHaveAttribute('aria-valuenow', '50')

      const totals = screen.getByRole('region', { name: 'Totais dos envelopes' })
      expect(within(totals).getByText('Planejado').nextElementSibling).toHaveTextContent(
        'R$ 1.100,00',
      )
      expect(within(totals).getByText('Gasto').nextElementSibling).toHaveTextContent('R$ 735,00')
      expect(within(totals).getByText('Ainda livre').nextElementSibling).toHaveTextContent(
        'R$ 400,00',
      )
      expect(within(totals).getByText('Estourou').nextElementSibling).toHaveTextContent('R$ 35,00')
    })

    it('should say when an envelope ran over, and by how much', async () => {
      mockEnvelopes({ envelopes: [ENERGIA] })
      renderApp('/ciclos/cycle-now/envelopes')

      const card = (await screen.findByRole('heading', { name: 'Energia' })).closest('li')!
      expect(within(card).getByText('Estourou R$ 35,00')).toBeInTheDocument()
      expect(within(card).getByText('estourou')).toBeInTheDocument()
      // the bar never goes past the end
      expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    })

    it('should warn about an envelope that is about to run out', async () => {
      mockEnvelopes({
        envelopes: [
          envelope({
            code: 'env-quase',
            cycle_code: CYCLE.code,
            planned_amount: 500,
            consumed_amount: 450,
            recognized_amount: 450,
            committed_amount: 0,
            remaining_amount: 50,
            reserved_amount: 50,
          }),
        ],
      })
      renderApp('/ciclos/cycle-now/envelopes')

      expect(await screen.findByText('quase no limite')).toBeInTheDocument()
    })

    it('should warn when the projection is incomplete', async () => {
      mockEnvelopes({ report: { projection_incomplete: true } })
      renderApp('/ciclos/cycle-now/envelopes')

      expect(await screen.findByText('A projeção está incompleta')).toBeInTheDocument()
    })

    it('should suggest the first envelope when the cycle has none', async () => {
      mockEnvelopes({ envelopes: [] })
      renderApp('/ciclos/cycle-now/envelopes')

      expect(await screen.findByText('Nenhum envelope neste ciclo')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Novo envelope' })).toBeEnabled()
    })

    it('should only read the envelopes of a closed cycle', async () => {
      mockEnvelopes({ cycle: { ...CYCLE, status: 'CLOSED' } })
      renderApp('/ciclos/cycle-now/envelopes')

      expect(await screen.findByText(/Este ciclo está fechado/)).toBeInTheDocument()
      expect(await screen.findByRole('heading', { name: 'Mercado' })).toBeVisible()
      expect(screen.queryByRole('button', { name: 'Novo envelope' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Alterar valor/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Excluir/ })).not.toBeInTheDocument()
    })

    it('should say a cycle that does not exist anymore', async () => {
      mockEnvelopes()
      renderApp('/ciclos/outro-ciclo/envelopes')

      expect(await screen.findByText('Este registro não existe mais')).toBeInTheDocument()
    })

    it('should show the error and try again when the list does not load', async () => {
      mockEnvelopes()
      let failing = true
      server.use(
        http.get('/api/pay_cycle/:code/envelope', () =>
          failing
            ? HttpResponse.json({ message: 'Erro interno' }, { status: 500 })
            : HttpResponse.json(cycleEnvelopes([MERCADO])),
        ),
      )
      renderApp('/ciclos/cycle-now/envelopes')

      expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar')
      failing = false
      await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
      expect(await screen.findByRole('heading', { name: 'Mercado' })).toBeVisible()
    })
  })

  describe('escrita', () => {
    it('should create an envelope for a category that has none yet', async () => {
      const calls = mockEnvelopes()
      renderApp('/ciclos/cycle-now/envelopes')

      await userEvent.click(await screen.findByRole('button', { name: 'Novo envelope' }))
      const sheet = await screen.findByRole('dialog', { name: 'Novo envelope' })
      await userEvent.click(within(sheet).getByRole('combobox', { name: 'Categoria' }))
      // Mercado already has one, an inactive category and a revenue are not offered
      expect(screen.queryByRole('option', { name: 'Mercado' })).not.toBeInTheDocument()
      expect(screen.queryByRole('option', { name: 'Academia' })).not.toBeInTheDocument()
      expect(screen.queryByRole('option', { name: 'Salário' })).not.toBeInTheDocument()
      await userEvent.click(await screen.findByRole('option', { name: 'Padaria' }))
      await userEvent.type(within(sheet).getByLabelText('Valor planejado'), '450')
      await userEvent.click(within(sheet).getByRole('button', { name: 'Criar envelope' }))

      await waitFor(() =>
        expect(calls.created).toEqual([
          {
            cycle: 'cycle-now',
            body: { category_code: categories.padaria.code, planned_amount: 450 },
          },
        ]),
      )
      expect((await screen.findAllByText('Envelope de Padaria criado.')).length).toBeGreaterThan(0)
      expect(await screen.findByRole('heading', { name: 'Padaria' })).toBeVisible()
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('should ask for the category and for an amount before sending', async () => {
      const calls = mockEnvelopes()
      renderApp('/ciclos/cycle-now/envelopes')

      await userEvent.click(await screen.findByRole('button', { name: 'Novo envelope' }))
      const sheet = await screen.findByRole('dialog', { name: 'Novo envelope' })
      await userEvent.click(within(sheet).getByRole('button', { name: 'Criar envelope' }))

      expect(await within(sheet).findByText('Escolha a categoria.')).toBeInTheDocument()
      expect(calls.created).toEqual([])
    })

    it('should show the error of the field the back points at', async () => {
      mockEnvelopes({
        failWrite: {
          status: 400,
          body: {
            message: 'Erro de validação',
            validations: { planned_amount: 'deve ter no máximo 2 casas decimais' },
          },
        },
      })
      renderApp('/ciclos/cycle-now/envelopes')

      await userEvent.click(await screen.findByRole('button', { name: 'Novo envelope' }))
      const sheet = await screen.findByRole('dialog', { name: 'Novo envelope' })
      await userEvent.click(within(sheet).getByRole('combobox', { name: 'Categoria' }))
      await userEvent.click(await screen.findByRole('option', { name: 'Gás' }))
      await userEvent.type(within(sheet).getByLabelText('Valor planejado'), '10')
      await userEvent.click(within(sheet).getByRole('button', { name: 'Criar envelope' }))

      expect(
        await within(sheet).findByText('deve ter no máximo 2 casas decimais'),
      ).toBeInTheDocument()
      expect(screen.getByRole('dialog', { name: 'Novo envelope' })).toBeVisible()
    })

    it('should show the conflict of the back, as it wrote it, and keep the sheet open', async () => {
      mockEnvelopes({
        failWrite: { status: 409, body: { message: 'A categoria já tem um envelope neste ciclo' } },
      })
      renderApp('/ciclos/cycle-now/envelopes')

      await userEvent.click(await screen.findByRole('button', { name: 'Novo envelope' }))
      const sheet = await screen.findByRole('dialog', { name: 'Novo envelope' })
      await userEvent.click(within(sheet).getByRole('combobox', { name: 'Categoria' }))
      await userEvent.click(await screen.findByRole('option', { name: 'Gás' }))
      await userEvent.type(within(sheet).getByLabelText('Valor planejado'), '10')
      await userEvent.click(within(sheet).getByRole('button', { name: 'Criar envelope' }))

      expect(
        await within(sheet).findByText('A categoria já tem um envelope neste ciclo'),
      ).toBeInTheDocument()
    })

    it('should change only the amount of an envelope', async () => {
      const calls = mockEnvelopes()
      renderApp('/ciclos/cycle-now/envelopes')

      await userEvent.click(await screen.findByRole('button', { name: 'Alterar valor de Mercado' }))
      const sheet = await screen.findByRole('dialog', { name: 'Envelope de Mercado' })
      // the category cannot change: there is no select, only its name
      expect(within(sheet).queryByRole('combobox')).not.toBeInTheDocument()
      const amount = within(sheet).getByLabelText('Valor planejado')
      expect(amount).toHaveValue('800,00')
      await userEvent.clear(amount)
      await userEvent.type(amount, '950')
      await userEvent.click(within(sheet).getByRole('button', { name: 'Salvar' }))

      await waitFor(() =>
        expect(calls.updated).toEqual([{ code: 'env-mercado', body: { planned_amount: 950 } }]),
      )
      expect(
        (await screen.findAllByText('Envelope de Mercado atualizado.')).length,
      ).toBeGreaterThan(0)
      expect(await screen.findByText('Planejado R$ 950,00')).toBeInTheDocument()
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('should delete an envelope only after confirming', async () => {
      const calls = mockEnvelopes({ envelopes: [MERCADO, ENERGIA] })
      renderApp('/ciclos/cycle-now/envelopes')

      await userEvent.click(
        await screen.findByRole('button', { name: 'Excluir envelope de Mercado' }),
      )
      const dialog = await screen.findByRole('alertdialog', { name: 'Excluir este envelope?' })
      expect(calls.deleted).toEqual([])
      await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }))

      await waitFor(() => expect(calls.deleted).toEqual(['env-mercado']))
      // the card goes away with the refreshed list, and the toast still comes from the hook
      expect((await screen.findAllByText('Envelope excluído.')).length).toBeGreaterThan(0)
      await waitFor(() =>
        expect(screen.queryByRole('heading', { name: 'Mercado' })).not.toBeInTheDocument(),
      )
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
      expect(screen.getByRole('heading', { name: 'Energia' })).toBeVisible()
    })

    it('should explain why a deletion was refused when the cycle closed meanwhile', async () => {
      const calls = mockEnvelopes({
        failWrite: {
          status: 409,
          body: { message: 'O ciclo está fechado; seus envelopes não podem ser alterados' },
        },
      })
      renderApp('/ciclos/cycle-now/envelopes')

      await userEvent.click(
        await screen.findByRole('button', { name: 'Excluir envelope de Mercado' }),
      )
      const dialog = await screen.findByRole('alertdialog')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }))

      expect(
        (await screen.findAllByText('O ciclo está fechado; seus envelopes não podem ser alterados'))
          .length,
      ).toBeGreaterThan(0)
      expect(calls.deleted).toEqual([])
      expect(screen.getByRole('heading', { name: 'Mercado' })).toBeVisible()
    })
  })

  describe('caminhos até os envelopes', () => {
    it('should open the envelopes of the current cycle from /envelopes', async () => {
      mockEnvelopes()
      const { router } = renderApp('/envelopes')

      expect(await screen.findByRole('heading', { name: /Envelopes · Nov\/Dez/ })).toBeVisible()
      expect(router.state.location.pathname).toBe('/ciclos/cycle-now/envelopes')
    })

    it('should explain that envelopes need a cycle when today is in none', async () => {
      mockCommonApi({ currentCycle: null })
      renderApp('/envelopes')

      expect(await screen.findByText('Hoje não cai em nenhum ciclo')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Ver os ciclos' })).toHaveAttribute('href', '/ciclos')
    })

    it('should link to the envelopes from the cycle screen', async () => {
      mockEnvelopes()
      server.use(
        http.get('/api/pay_cycle/:code/summary', () =>
          HttpResponse.json({ message: 'x' }, { status: 500 }),
        ),
        http.get('/api/pay_cycle/:code/adjustment', () => HttpResponse.json([])),
        http.get('/api/pay_cycle', () => HttpResponse.json([CYCLE])),
      )
      renderApp('/ciclos/cycle-now')

      expect(await screen.findByRole('link', { name: 'Ver os envelopes' })).toHaveAttribute(
        'href',
        '/ciclos/cycle-now/envelopes',
      )
    })

    it('should list Envelopes and Previsão in Mais', async () => {
      renderApp('/mais')

      const nav = await screen.findByRole('navigation', { name: 'Outras telas' })
      expect(within(nav).getByRole('link', { name: 'Envelopes' })).toHaveAttribute(
        'href',
        '/envelopes',
      )
      expect(within(nav).getByRole('link', { name: 'Previsão' })).toHaveAttribute(
        'href',
        '/previsao',
      )
    })
  })
})
