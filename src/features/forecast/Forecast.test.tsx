import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CashForecastResponse, DashboardResponse } from '@/api/contracts'
import { formatMoney } from '@/lib/format'
import { mockCommonApi } from '@/test/api'
import { cashForecast } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

/** The reader normalizes the no-break space of "R$ 1,00"; the expected text has to be too. */
function money(value: number): string {
  return formatMoney(value).replace(/\u00a0/g, ' ')
}

const DASHBOARD: DashboardResponse = {
  current_balance: 1200,
  current_projected_balance: 950,
  month_closing_balance: 1200,
  month_projected_closing_balance: 900,
  month_total_revenue: 6850,
  month_projected_total_revenue: 8050,
  month_total_expense: -5650,
  month_projected_total_expense: -7000,
  has_negative_balance_alert: false,
  first_negative_balance_date: null,
  lowest_projected_balance: 500,
  lowest_balance_date: '2026-11-28',
  reference_month: '2026-11-01',
  current_date: '2026-11-10',
  total_days_in_month: 30,
  days_elapsed: 10,
  days_remaining: 20,
  month_net_change: 1200,
  projected_net_change: 900,
}

/** Answers /forecast with the fixture, but with the `until` and the late income that were asked for. */
function mockForecast(overrides: Partial<CashForecastResponse> = {}) {
  const queries: URLSearchParams[] = []
  server.use(
    http.get('/api/forecast', ({ request }) => {
      const query = new URL(request.url).searchParams
      queries.push(query)
      return HttpResponse.json(
        cashForecast({
          until: query.get('until') ?? '2026-12-03',
          include_late_income: query.get('include_late_income') === 'true',
          ...overrides,
        }),
      )
    }),
  )
  return queries
}

function row(name: string | RegExp): HTMLElement {
  return screen.getByRole('row', { name })
}

describe('Previsão de caixa', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T15:00:00Z'))
    mockCommonApi()
  })
  afterEach(() => vi.useRealTimers())

  describe('a página', () => {
    it('should show what is free, the lowest cash and the account top to bottom', async () => {
      mockForecast()
      renderApp('/previsao')

      const free = await screen.findByRole('region', { name: 'Livre depois das reservas' })
      expect(within(free).getByText(money(4348.4))).toBeInTheDocument()
      expect(free).toHaveTextContent(
        `até 03/12/2026 · menor caixa no período: ${money(1200)} em 20/11/2026`,
      )

      expect(within(row(/Saldo nas contas hoje/)).getByText(money(2318.4))).toBeVisible()
      expect(
        within(row(/Receitas a receber até 03\/12\/2026/)).getByText(money(6850)),
      ).toBeVisible()
      expect(within(row(/Despesas a pagar até 03\/12\/2026/)).getByText(money(3200))).toBeVisible()
      expect(within(row(/Parcelas de cartão até 03\/12\/2026/)).getByText(money(420))).toBeVisible()
      expect(within(row(/Caixa projetado em 03\/12\/2026/)).getByText(money(5548.4))).toBeVisible()
      expect(within(row(/Reserva dos envelopes/)).getByText(money(900))).toBeVisible()
      expect(
        within(row(/Cartão que vence depois de 03\/12\/2026/)).getByText(money(300)),
      ).toBeVisible()
      expect(within(row(/Livre depois das reservas/)).getByText(money(4348.4))).toBeVisible()
    })

    it('should send no horizon, so the back picks the end of the cycle or month', async () => {
      const queries = mockForecast()
      renderApp('/previsao')

      await screen.findByRole('region', { name: 'Livre depois das reservas' })
      expect(queries).toHaveLength(1)
      expect(queries[0]!.has('until')).toBe(false)
      expect(queries[0]!.has('include_late_income')).toBe(false)
      // the field shows the horizon the back chose
      expect(screen.getByLabelText('Previsão até')).toHaveValue('2026-12-03')
      expect(screen.queryByRole('button', { name: 'Voltar ao padrão' })).not.toBeInTheDocument()
    })

    it('should ask for another horizon and go back to the default', async () => {
      const queries = mockForecast()
      renderApp('/previsao')
      await screen.findByRole('region', { name: 'Livre depois das reservas' })

      fireEvent.change(screen.getByLabelText('Previsão até'), { target: { value: '2026-12-20' } })

      const free = () => screen.getByRole('region', { name: 'Livre depois das reservas' })
      await waitFor(() => expect(free()).toHaveTextContent(/até 20\/12\/2026/))
      expect(queries.at(-1)!.get('until')).toBe('2026-12-20')
      expect(screen.getByLabelText('Previsão até')).toHaveValue('2026-12-20')

      await userEvent.click(screen.getByRole('button', { name: 'Voltar ao padrão' }))
      await waitFor(() => expect(free()).toHaveTextContent(/até 03\/12\/2026/))
      expect(queries.at(-1)!.has('until')).toBe(false)
    })

    it('should not ask for a date before today or too far ahead', async () => {
      const queries = mockForecast()
      renderApp('/previsao')
      await screen.findByRole('region', { name: 'Livre depois das reservas' })
      const field = screen.getByLabelText('Previsão até')

      fireEvent.change(field, { target: { value: '2026-11-09' } })
      expect(await screen.findByText('A data não pode ser anterior a hoje.')).toBeInTheDocument()

      fireEvent.change(field, { target: { value: '2027-11-12' } })
      expect(
        await screen.findByText('A data pode ir no máximo 366 dias à frente.'),
      ).toBeInTheDocument()

      // today and the 366th day are accepted
      fireEvent.change(field, { target: { value: '2027-11-11' } })
      await waitFor(() => expect(queries.at(-1)!.get('until')).toBe('2027-11-11'))
      expect(queries).toHaveLength(2)
      await waitFor(() =>
        expect(
          screen.queryByText('A data pode ir no máximo 366 dias à frente.'),
        ).not.toBeInTheDocument(),
      )
    })

    it('should ignore a date in the link that is already in the past', async () => {
      const queries = mockForecast()
      renderApp('/previsao?ate=2026-11-01')

      await screen.findByRole('region', { name: 'Livre depois das reservas' })
      expect(queries[0]!.has('until')).toBe(false)
    })

    it('should keep the horizon of the link', async () => {
      const queries = mockForecast()
      renderApp('/previsao?ate=2026-12-15')

      const free = await screen.findByRole('region', { name: 'Livre depois das reservas' })
      expect(free).toHaveTextContent(/até 15\/12\/2026/)
      expect(queries[0]!.get('until')).toBe('2026-12-15')
      expect(screen.getByRole('button', { name: 'Voltar ao padrão' })).toBeVisible()
    })

    it('should leave out the late income and say how much it is', async () => {
      mockForecast({ late_income: 500 })
      renderApp('/previsao')

      expect(
        await screen.findByText(/Há .* de receitas atrasadas que não estão na conta/),
      ).toBeVisible()
      expect(screen.queryByRole('row', { name: /Receitas atrasadas/ })).not.toBeInTheDocument()
      expect(screen.getByRole('switch', { name: 'Contar receitas atrasadas' })).not.toBeChecked()
    })

    it('should count the late income when asked, and add its line', async () => {
      const queries = mockForecast({ late_income: 500 })
      renderApp('/previsao')
      await screen.findByRole('region', { name: 'Livre depois das reservas' })

      await userEvent.click(screen.getByRole('switch', { name: 'Contar receitas atrasadas' }))

      await waitFor(() => expect(queries.at(-1)!.get('include_late_income')).toBe('true'))
      expect(
        await screen.findByRole('row', { name: /Receitas atrasadas \(contadas como recebidas\)/ }),
      ).toBeVisible()
      expect(
        screen.queryByText(/de receitas atrasadas que não estão na conta/),
      ).not.toBeInTheDocument()
    })

    it('should open with the late income counted when the link says so', async () => {
      const queries = mockForecast({ late_income: 500 })
      renderApp('/previsao?atrasadas=1')

      expect(await screen.findByRole('switch', { name: 'Contar receitas atrasadas' })).toBeChecked()
      expect(queries[0]!.get('include_late_income')).toBe('true')
    })
  })

  describe('alertas', () => {
    it('should warn that the cash goes negative, with the first day', async () => {
      mockForecast({
        negative_cash_alert: true,
        first_negative_date: '2026-11-25',
        lowest_projected_cash: -320,
        lowest_projected_cash_date: '2026-11-28',
      })
      renderApp('/previsao')

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Caixa negativo')
      expect(alert).toHaveTextContent('O caixa fica negativo em 25/11/2026')
      expect(alert).toHaveTextContent('em 28/11/2026')
      // the budget alert is independent: the cash can be negative with the budget fine
      expect(screen.queryByText('Orçamento insuficiente')).not.toBeInTheDocument()
    })

    it('should warn that the budget is not enough even with the cash always positive', async () => {
      mockForecast({
        insufficient_budget_alert: true,
        free_after_reserves: -150,
        projected_cash: 1050,
      })
      renderApp('/previsao')

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Orçamento insuficiente')
      expect(alert).toHaveTextContent(`faltam ${money(150)}`)
      expect(screen.queryByText('Caixa negativo')).not.toBeInTheDocument()
    })

    it('should show both warnings when both happen', async () => {
      mockForecast({
        negative_cash_alert: true,
        first_negative_date: '2026-11-25',
        insufficient_budget_alert: true,
        free_after_reserves: -150,
      })
      renderApp('/previsao')

      expect(await screen.findAllByRole('alert')).toHaveLength(2)
    })

    it('should show no alert when all is well', async () => {
      mockForecast()
      renderApp('/previsao')

      await screen.findByRole('region', { name: 'Livre depois das reservas' })
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('should warn that the projection is incomplete', async () => {
      mockForecast({ projection_incomplete: true })
      renderApp('/previsao')

      expect(await screen.findByText('A projeção está incompleta')).toBeVisible()
    })
  })

  describe('reserva dos envelopes', () => {
    it('should link the reserve to the envelopes of the current cycle', async () => {
      mockForecast({ envelope_cycle_code: 'cycle-now' })
      renderApp('/previsao')

      const link = await screen.findByRole('link', { name: 'Reserva dos envelopes' })
      expect(link).toHaveAttribute('href', '/ciclos/cycle-now/envelopes')
    })

    it('should say there is nothing to reserve without a current cycle', async () => {
      mockForecast({ envelope_cycle_code: null, envelope_reserve: 0 })
      renderApp('/previsao')

      expect(await screen.findByText(/Sem ciclo atual, não há envelopes a reservar/)).toBeVisible()
      expect(screen.queryByRole('link', { name: 'Reserva dos envelopes' })).not.toBeInTheDocument()
    })
  })

  describe('erro', () => {
    it('should show the error and try again', async () => {
      let failing = true
      server.use(
        http.get('/api/forecast', () =>
          failing
            ? HttpResponse.json({ message: 'Erro interno' }, { status: 500 })
            : HttpResponse.json(cashForecast()),
        ),
      )
      renderApp('/previsao')

      expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar')
      failing = false
      await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
      expect(await screen.findByRole('region', { name: 'Livre depois das reservas' })).toBeVisible()
    })

    it('should show the message of the back when it refuses the horizon', async () => {
      server.use(
        http.get('/api/forecast', ({ request }) =>
          new URL(request.url).searchParams.has('until')
            ? HttpResponse.json(
                {
                  message: 'Erro de validação',
                  validations: { until: 'não pode ser anterior a hoje' },
                },
                { status: 400 },
              )
            : HttpResponse.json(cashForecast()),
        ),
      )
      // the link is valid for the app, but the back (another clock) refuses it
      renderApp('/previsao?ate=2026-12-15')

      expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar')
    })
  })

  describe('card no Início', () => {
    beforeEach(() => {
      server.use(
        http.get('/api/dashboard', () => HttpResponse.json(DASHBOARD)),
        http.get('/api/account/balance', () =>
          HttpResponse.json({ date: '2026-11-10', accounts: [], total: 2318.4 }),
        ),
      )
    })

    it('should show what is free until the end of the cycle and link to the forecast', async () => {
      mockForecast()
      renderApp('/')

      const link = await screen.findByRole('link', { name: /Livre depois das reservas/ })
      expect(link).toHaveAttribute('href', '/previsao')
      // the link is there while the numbers still load
      await waitFor(() => expect(link).toHaveTextContent(money(4348.4)))
      expect(link).toHaveTextContent('até 03/12/2026')
    })

    it('should repeat the warnings on Início without announcing them', async () => {
      mockForecast({
        negative_cash_alert: true,
        first_negative_date: '2026-11-25',
        insufficient_budget_alert: true,
        free_after_reserves: -150,
      })
      renderApp('/')

      expect(await screen.findByText('Caixa negativo')).toBeVisible()
      expect(screen.getByText('Orçamento insuficiente')).toBeVisible()
      expect(screen.getByRole('link', { name: /Livre depois das reservas/ })).toHaveTextContent(
        money(-150),
      )
    })

    it('should not break Início when the forecast is unavailable', async () => {
      server.use(
        http.get('/api/forecast', () =>
          HttpResponse.json({ message: 'Erro interno' }, { status: 500 }),
        ),
      )
      renderApp('/')

      expect(await screen.findByText('Previsão indisponível agora.')).toBeVisible()
      expect(screen.getByText('Saldo nas contas')).toBeVisible()
    })
  })
})
