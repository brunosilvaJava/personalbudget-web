import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CardInvoiceResponse } from '@/api/contracts'
import { mockCommonApi } from '@/test/api'
import { accounts, cards } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

function invoice(overrides: Partial<CardInvoiceResponse> = {}): CardInvoiceResponse {
  return {
    code: 'inv-nov',
    card_code: cards.nubank.code,
    reference_month: '2026-11',
    closing_date: '2026-11-03',
    due_date: '2026-11-10',
    state: 'CLOSED',
    total_amount: 500,
    paid_amount: 0,
    holder_total_list: [],
    own_total_amount: 500,
    third_party_total_amount: 0,
    installments: [],
    ...overrides,
  }
}

function mockInvoice(answer: CardInvoiceResponse) {
  mockCommonApi({ accounts: [accounts.main], cards: [cards.nubank] })
  server.use(http.get('/api/card_invoice/:code', () => HttpResponse.json(answer)))
}

describe('Fatura: meu e de terceiros', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T15:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('should split the total between mine and third parties, and by holder', async () => {
    mockInvoice(
      invoice({
        own_total_amount: 350,
        third_party_total_amount: 150,
        holder_total_list: [
          { holder_code: 'h1', holder_name: 'Bruno', kind: 'TITULAR', total_amount: 300 },
          { holder_code: 'h2', holder_name: 'Márcia', kind: 'ADICIONAL', total_amount: 200 },
        ],
      }),
    )
    renderApp('/carteira/faturas/inv-nov')

    const split = (await screen.findByText('É de terceiros')).closest('dl')!
    expect(within(split).getByText(/R\$\s350,00/)).toBeInTheDocument()
    expect(within(split).getByText(/R\$\s150,00/)).toBeInTheDocument()
    const holders = screen.getByRole('region', { name: 'Por titular' })
    expect(within(holders).getByText(/Bruno/)).toHaveTextContent('titular')
    expect(within(holders).getByText(/R\$\s200,00/)).toBeInTheDocument()
  })

  it('should show neither block for an invoice that is all mine with a single holder', async () => {
    mockInvoice(
      invoice({
        holder_total_list: [
          { holder_code: 'h1', holder_name: 'Bruno', kind: 'TITULAR', total_amount: 500 },
        ],
      }),
    )
    renderApp('/carteira/faturas/inv-nov')

    await screen.findByRole('heading', { name: 'Fatura de nov/2026' })
    expect(screen.queryByText('É de terceiros')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Por titular' })).not.toBeInTheDocument()
  })
})
