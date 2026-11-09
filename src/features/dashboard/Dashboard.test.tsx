import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DailyBalance, DashboardResponse } from '@/api/contracts'
import { mockCommonApi } from '@/test/api'
import { accounts, payCycle } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

const dashboard: DashboardResponse = {
  current_balance: 1200,
  current_projected_balance: 950,
  month_closing_balance: 1200,
  month_projected_closing_balance: -150.5,
  month_total_revenue: 6850,
  month_projected_total_revenue: 8050,
  month_total_expense: -5650,
  month_projected_total_expense: -8200.5,
  has_negative_balance_alert: true,
  first_negative_balance_date: '2026-11-25',
  lowest_projected_balance: -320,
  lowest_balance_date: '2026-11-28',
  reference_month: '2026-11-01',
  current_date: '2026-11-10',
  total_days_in_month: 30,
  days_elapsed: 10,
  days_remaining: 20,
  month_net_change: 1200,
  projected_net_change: -150.5,
}

function day(
  date: string,
  closing: number,
  projected: number,
  revenue = 0,
  expense = 0,
): DailyBalance {
  return {
    date,
    balance: { opening: 0, total_revenue: revenue, total_expense: expense, closing },
    projected: {
      opening: 0,
      pending_total_revenue: 0,
      pending_total_expense: 0,
      closing: projected,
    },
  }
}

function mockReports() {
  const dashboardMonths: (string | null)[] = []
  const balanceQueries: URLSearchParams[] = []
  server.use(
    http.get('/api/account/balance', () =>
      HttpResponse.json({
        date: '2026-11-10',
        accounts: [{ account_code: accounts.main.code, balance: 2318.4 }],
        total: 2318.4,
      }),
    ),
    http.get('/api/dashboard', ({ request }) => {
      dashboardMonths.push(new URL(request.url).searchParams.get('month'))
      return HttpResponse.json(dashboard)
    }),
    http.get('/api/balance/daily', ({ request }) => {
      balanceQueries.push(new URL(request.url).searchParams)
      // A Set on the back: not in order.
      return HttpResponse.json([
        day('2026-11-11', 1200, 900),
        day('2026-11-09', 1250, 1250, 0, -30),
        day('2026-11-10', 1200, 1200, 0, -50),
      ])
    }),
  )
  return { dashboardMonths, balanceQueries }
}

describe('Início', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T15:00:00Z'))
    mockCommonApi()
  })
  afterEach(() => vi.useRealTimers())

  it('should show the money in the accounts apart from the movement of the month', async () => {
    const calls = mockReports()
    renderApp('/')

    const accountsCard = await screen.findByRole('button', { name: /Saldo nas contas/ })
    expect(await within(accountsCard).findByText(/R\$\s2\.318,40/)).toBeInTheDocument()
    await userEvent.click(accountsCard)
    expect(await screen.findByRole('link', { name: /Conta principal/ })).toHaveAttribute(
      'href',
      `/carteira/contas/${accounts.main.code}`,
    )

    expect(await screen.findByText('Receitas do mês')).toBeInTheDocument()
    expect(screen.getByText('Movimento acumulado hoje')).toBeInTheDocument()
    expect(screen.getByText(/Não é o saldo do banco/)).toBeInTheDocument()
    expect(screen.getByText(/Dia 10 de 30 · faltam 20 dias/)).toBeInTheDocument()
    expect(calls.dashboardMonths[0]).toBe('2026-11')
  })

  it('should alert a negative month and open the daily balance on the lowest day', async () => {
    mockReports()
    const { router } = renderApp('/')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('O movimento do mês fica negativo em 25/11/2026')
    await userEvent.click(alert)

    expect(router.state.location.pathname).toBe('/caixa')
    expect(router.state.location.search).toBe('?inicio=2026-11-01&fim=2026-11-30&dia=2026-11-28')
  })

  it('should move to another month', async () => {
    const calls = mockReports()
    renderApp('/')

    await screen.findByText('Receitas do mês')
    await userEvent.click(screen.getByRole('button', { name: 'Período anterior' }))
    await waitFor(() => expect(calls.dashboardMonths.at(-1)).toBe('2026-10'))
    expect(screen.queryByText('Movimento acumulado hoje')).not.toBeInTheDocument()
  })
})

describe('Caixa diário', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T15:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('should use the current cycle up to last_day and list the days in order', async () => {
    mockCommonApi({ currentCycle: payCycle() })
    server.use(http.get('/api/pay_cycle/:code', () => HttpResponse.json(payCycle())))
    const calls = mockReports()
    renderApp('/caixa')

    const days = await screen.findAllByRole('link', { name: /de nov/ })
    expect(calls.balanceQueries[0]?.toString()).toBe('initial_date=2026-11-05&end_date=2026-12-03')
    expect(days.map((link) => link.getAttribute('href'))).toEqual([
      '/movimentacoes?inicio=2026-11-09&fim=2026-11-09',
      '/movimentacoes?inicio=2026-11-10&fim=2026-11-10',
      '/movimentacoes?inicio=2026-11-11&fim=2026-11-11',
    ])
    expect(within(days[1]!).getByText(/hoje/)).toBeInTheDocument()
    expect(within(days[2]!).getByText('projetado')).toBeInTheDocument()
  })

  it('should fall back to the month without a cycle', async () => {
    mockCommonApi()
    const calls = mockReports()
    renderApp('/caixa')

    await screen.findAllByRole('link', { name: /de nov/ })
    expect(calls.balanceQueries[0]?.toString()).toBe('initial_date=2026-11-01&end_date=2026-11-30')
  })
})
