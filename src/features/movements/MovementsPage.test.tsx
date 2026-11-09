import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FinancialMovementResponse } from '@/api/contracts'
import { mockCommonApi } from '@/test/api'
import { categories, movement, page, payCycle } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

/** Every GET /financial_movement the screen made, as URLSearchParams. */
function mockMovements(answer: (params: URLSearchParams) => Response | Promise<Response>) {
  const calls: URLSearchParams[] = []
  server.use(
    http.get('/api/financial_movement', ({ request }) => {
      const params = new URL(request.url).searchParams
      calls.push(params)
      return answer(params)
    }),
  )
  return calls
}

function json(movements: FinancialMovementResponse[], options?: Parameters<typeof page>[1]) {
  return HttpResponse.json(page(movements, options))
}

describe('MovementsPage', () => {
  beforeEach(() => {
    // Only Date: MSW and the debounce keep real timers. 12h in Brasília on Nov 10th.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T15:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('should list the current month by day when there is no cycle', async () => {
    mockCommonApi()
    const calls = mockMovements(() =>
      json([
        movement({
          description: 'Pão francês',
          movement_date: '2026-11-10T08:10:00',
          status: 'PAID_OUT',
          amount_paid: 12.5,
          amount: 12.5,
          category_code: categories.padaria.code,
        }),
        movement({
          description: 'Geladeira (2/3)',
          movement_date: '2026-11-10T00:00:00',
          card_purchase_code: 'p1',
          card_invoice_code: 'i1',
          installment_number: 2,
        }),
        movement({
          description: 'Energia',
          movement_date: '2026-11-05T00:00:00',
          due_date: '2026-11-05T00:00:00',
          status: 'LATE',
          recurrence_bill_code: 'f1',
          category_code: categories.energia.code,
        }),
        movement({
          description: 'Ginástica',
          movement_date: '2026-11-03T07:00:00',
          category_code: categories.academia.code,
          amount: 90,
          amount_paid: 40,
        }),
      ]),
    )

    renderApp('/movimentacoes')

    expect(await screen.findByText('Pão francês')).toBeInTheDocument()
    expect(calls[0]?.toString()).toBe('start_date=2026-11-01&end_date=2026-11-30&page=0&size=20')
    expect(screen.getByText('Novembro de 2026')).toBeInTheDocument()

    const days = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(days).toEqual(['terça, 10 de nov', 'quinta, 5 de nov', 'terça, 3 de nov'])

    const card = screen.getByText('Geladeira (2/3)').closest('div')!.parentElement!
    expect(within(card).getByText('cartão 2/3')).toBeInTheDocument()
    expect(within(card).queryByText('recorrente')).not.toBeInTheDocument()

    expect(screen.getByText('Atrasada')).toBeInTheDocument()
    expect(screen.getByText('recorrente')).toBeInTheDocument()
    expect(await screen.findByText(/Academia \(inativa\)/)).toBeInTheDocument()
    expect(screen.getByText(/pago R\$\s40,00/)).toBeInTheDocument()
    expect(screen.getByText('4 movimentações')).toBeInTheDocument()
  })

  it('should start on the current cycle when there is one', async () => {
    mockCommonApi({ currentCycle: payCycle() })
    server.use(http.get('/api/pay_cycle/:code', () => HttpResponse.json(payCycle())))
    const calls = mockMovements(() => json([movement()]))

    renderApp('/movimentacoes')

    await screen.findByText('Mercado do mês')
    expect(calls[0]?.get('start_date')).toBe('2026-11-05')
    expect(calls[0]?.get('end_date')).toBe('2026-12-03')
    expect(await screen.findByText('Ciclo Nov/Dez')).toBeInTheDocument()
    expect(screen.getByText('05/11 a 03/12')).toBeInTheDocument()
  })

  it('should filter the overdue ones through the filters sheet', async () => {
    mockCommonApi()
    const calls = mockMovements((params) =>
      json(params.get('status') === 'LATE' ? [movement({ status: 'LATE' })] : [movement()]),
    )
    const { router } = renderApp('/movimentacoes')
    await screen.findByText('Mercado do mês')

    await userEvent.click(screen.getByRole('button', { name: 'Filtros' }))
    const sheet = await screen.findByRole('dialog', { name: 'Filtros' })
    await userEvent.click(within(sheet).getByRole('button', { name: 'Atrasadas' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Aplicar' }))

    await waitFor(() => expect(calls.at(-1)?.getAll('status')).toEqual(['LATE']))
    expect(router.state.location.search).toContain('status=atrasada')
    expect(await screen.findByText('Atrasadas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filtros (1 ativos)' })).toBeInTheDocument()
  })

  it('should search by description after the person stops typing', async () => {
    mockCommonApi()
    const calls = mockMovements(() => json([movement()]))
    renderApp('/movimentacoes')
    await screen.findByText('Mercado do mês')

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar pela descrição' }), 'pão')

    await waitFor(() => expect(calls.at(-1)?.get('description')).toBe('pão'))
    expect(calls.filter((call) => call.has('description'))).toHaveLength(1)
  })

  it('should load the next page and move to the previous month', async () => {
    mockCommonApi()
    const calls = mockMovements((params) => {
      const pageNumber = Number(params.get('page'))
      const items = Array.from({ length: pageNumber === 0 ? 20 : 5 }, (_, i) =>
        movement({ description: `Compra ${pageNumber * 20 + i + 1}` }),
      )
      return json(items, { page: pageNumber, total: 25 })
    })
    renderApp('/movimentacoes')
    await screen.findByText('Compra 1')

    await userEvent.click(screen.getByRole('button', { name: 'Carregar mais' }))
    expect(await screen.findByText('Compra 25')).toBeInTheDocument()
    expect(calls.at(-1)?.get('page')).toBe('1')
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Período anterior' }))
    await waitFor(() => expect(calls.at(-1)?.get('start_date')).toBe('2026-10-01'))
    expect(calls.at(-1)?.get('end_date')).toBe('2026-10-31')
    expect(await screen.findByText('Outubro de 2026')).toBeInTheDocument()
  })

  it('should suggest launching when the period is empty', async () => {
    mockCommonApi()
    mockMovements(() => json([]))
    renderApp('/movimentacoes')

    expect(await screen.findByText('Nenhuma movimentação no período')).toBeInTheDocument()
    const empty = screen.getByText('Nenhuma movimentação no período').closest('div')!.parentElement!
    expect(within(empty).getByRole('link', { name: 'Lançar' })).toHaveAttribute(
      'href',
      '/movimentacoes?lancar=1',
    )
  })

  it('should offer to clear the filters when nothing matches them', async () => {
    mockCommonApi()
    mockMovements((params) => json(params.has('operation_type') ? [] : [movement()]))
    renderApp('/movimentacoes?tipo=receita')

    expect(await screen.findByText('Nada encontrado com esses filtros')).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Limpar filtros' })[0]!)
    expect(await screen.findByText('Mercado do mês')).toBeInTheDocument()
  })

  it('should show the error and try again', async () => {
    mockCommonApi()
    let fail = true
    mockMovements(() =>
      fail
        ? HttpResponse.json({ message: 'Erro interno no servidor' }, { status: 500 })
        : json([movement()]),
    )
    renderApp('/movimentacoes')

    expect(await screen.findByText('Erro interno no servidor')).toBeInTheDocument()
    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('Mercado do mês')).toBeInTheDocument()
  })
})
