import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  CardInstallmentResponse,
  CardInvoicePaymentRequest,
  CardInvoiceResponse,
  CardPurchaseRequest,
  CardPurchaseResponse,
  CreditCardRequest,
} from '@/api/contracts'
import { mockCommonApi } from '@/test/api'
import { accounts, cards } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

function installment(overrides: Partial<CardInstallmentResponse> = {}): CardInstallmentResponse {
  return {
    movement_code: 'm1',
    purchase_code: 'p1',
    installment_number: 1,
    installment_count: 3,
    invoice_code: 'inv-dec',
    invoice_reference_month: '2026-12',
    description: 'Geladeira (1/3)',
    amount: 1000,
    amount_paid: null,
    due_date: '2026-12-10',
    competence_date: '2026-12-10',
    status: 'PENDING',
    ...overrides,
  }
}

const purchase: CardPurchaseResponse = {
  code: 'p1',
  card_code: cards.nubank.code,
  description: 'Geladeira',
  purchase_date: '2026-11-10',
  installments: 3,
  installment_amount: 1000,
  total_amount: 3000,
  category_code: null,
  installment_list: [
    installment(),
    installment({
      installment_number: 2,
      invoice_code: 'inv-jan',
      invoice_reference_month: '2027-01',
      description: 'Geladeira (2/3)',
    }),
    installment({
      installment_number: 3,
      invoice_code: 'inv-feb',
      invoice_reference_month: '2027-02',
      description: 'Geladeira (3/3)',
    }),
  ],
}

const invoice: CardInvoiceResponse = {
  code: 'inv-dec',
  card_code: cards.nubank.code,
  reference_month: '2026-12',
  closing_date: '2026-12-03',
  due_date: '2026-12-10',
  state: 'CLOSED',
  total_amount: 1250,
  paid_amount: 0,
  installments: [
    installment(),
    installment({
      movement_code: 'm2',
      purchase_code: 'p2',
      description: 'Livro',
      amount: 250,
      installment_count: 1,
    }),
  ],
}

function mockCards(options: { purchaseAnswer?: Response } = {}) {
  const calls = {
    cards: [] as CreditCardRequest[],
    purchases: [] as CardPurchaseRequest[],
    payments: [] as CardInvoicePaymentRequest[],
    reversed: [] as string[],
    deleted: [] as string[],
  }
  mockCommonApi({
    accounts: [accounts.main, accounts.wallet],
    cards: [{ ...cards.nubank, default_account_code: accounts.wallet.code }],
  })
  server.use(
    http.get('/api/credit_card/:code', ({ params }) =>
      HttpResponse.json({
        ...cards.nubank,
        code: params.code,
        default_account_code: accounts.wallet.code,
      }),
    ),
    http.get('/api/credit_card/:code/limit', () =>
      HttpResponse.json({
        card_code: cards.nubank.code,
        credit_limit: 5000,
        used: 3250,
        available: 1750,
      }),
    ),
    http.get('/api/credit_card/:code/invoice', () =>
      HttpResponse.json([
        {
          ...invoice,
          installments: undefined,
          code: 'inv-jan',
          reference_month: '2027-01',
          state: 'OPEN',
          total_amount: 1000,
        },
        { ...invoice, installments: undefined },
      ]),
    ),
    http.post('/api/credit_card', async ({ request }) => {
      const body = (await request.json()) as CreditCardRequest
      calls.cards.push(body)
      return HttpResponse.json({ ...cards.nubank, ...body, code: 'new' }, { status: 201 })
    }),
    http.get('/api/card_invoice/:code', () => HttpResponse.json(invoice)),
    http.get('/api/card_invoice/:code/payment', () =>
      HttpResponse.json([
        {
          code: 'pay-old',
          invoice_code: 'inv-dec',
          account_code: accounts.main.code,
          payment_date: '2026-12-01',
          amount: 1250,
          reversed_at: '2026-12-02T09:00:00',
          version: 1,
        },
      ]),
    ),
    http.post('/api/card_invoice/:code/payment', async ({ request }) => {
      calls.payments.push((await request.json()) as CardInvoicePaymentRequest)
      return HttpResponse.json(
        {
          code: 'pay',
          invoice_code: 'inv-dec',
          account_code: accounts.wallet.code,
          payment_date: '2026-11-10',
          amount: 1250,
          reversed_at: null,
          version: 0,
        },
        { status: 201 },
      )
    }),
    http.get('/api/card_purchase/:code', () => HttpResponse.json(purchase)),
    http.post('/api/card_purchase', async ({ request }) => {
      calls.purchases.push((await request.json()) as CardPurchaseRequest)
      return options.purchaseAnswer ?? HttpResponse.json(purchase, { status: 201 })
    }),
    http.delete('/api/card_purchase/:code', ({ params }) => {
      calls.deleted.push(String(params.code))
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return calls
}

describe('Cartões', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T15:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('should list the cards with the limit used and available', async () => {
    mockCards()
    renderApp('/carteira/cartoes')

    const item = await screen.findByRole('link', { name: /Nubank/ })
    expect(within(item).getByText('Fecha dia 3 · vence dia 10')).toBeInTheDocument()
    expect(await within(item).findByText(/Disponível R\$\s1\.750,00/)).toBeInTheDocument()
    expect(within(item).getByRole('meter', { name: 'Limite usado' })).toHaveAttribute(
      'aria-valuenow',
      '65',
    )
  })

  it('should create a card', async () => {
    const calls = mockCards()
    renderApp('/carteira/cartoes')

    await userEvent.click(await screen.findByRole('button', { name: 'Novo cartão' }))
    const sheet = await screen.findByRole('dialog', { name: 'Novo cartão' })
    await userEvent.type(within(sheet).getByLabelText('Nome'), 'Inter')
    await userEvent.type(within(sheet).getByLabelText('Dia do fechamento'), '25')
    await userEvent.type(within(sheet).getByLabelText('Dia do vencimento'), '5')
    await userEvent.type(within(sheet).getByLabelText('Limite (opcional)'), '2000')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Criar cartão' }))

    await waitFor(() =>
      expect(calls.cards).toEqual([
        { name: 'Inter', closing_day: 25, due_day: 5, credit_limit: 2000 },
      ]),
    )
  })

  it('should launch an installment purchase, show the total and the invoice of each installment', async () => {
    const calls = mockCards()
    renderApp(`/carteira/cartoes/${cards.nubank.code}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Nova compra' }))
    const sheet = await screen.findByRole('dialog', { name: 'Compra no cartão' })
    await userEvent.type(within(sheet).getByLabelText('Descrição'), 'Geladeira')
    await userEvent.type(within(sheet).getByLabelText('Valor da parcela'), '1000')
    const installments = within(sheet).getByLabelText('Parcelas')
    await userEvent.clear(installments)
    await userEvent.type(installments, '3')
    expect(within(sheet).getByText(/R\$\s3\.000,00/)).toBeInTheDocument()
    await userEvent.click(within(sheet).getByRole('button', { name: 'Lançar compra' }))

    await waitFor(() =>
      expect(calls.purchases).toEqual([
        {
          card_code: cards.nubank.code,
          description: 'Geladeira',
          purchase_date: '2026-11-10',
          installments: 3,
          installment_amount: 1000,
        },
      ]),
    )
    const result = await screen.findByRole('dialog', { name: 'Geladeira' })
    expect(
      within(result).getByText('3x de R$ 1.000,00', {
        exact: false,
        normalizer: (t) => t.replace(/\s+/g, ' '),
      }),
    ).toBeInTheDocument()
    expect(within(result).getByRole('link', { name: /Fatura jan\/2027/ })).toHaveAttribute(
      'href',
      '/carteira/faturas/inv-jan',
    )
  })

  it('should show the message when the purchase is above the available limit', async () => {
    mockCards({
      purchaseAnswer: HttpResponse.json(
        { message: 'A compra ultrapassa o limite disponível do cartão (R$ 1750.00).' },
        { status: 409 },
      ),
    })
    renderApp(`/carteira/cartoes/${cards.nubank.code}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Nova compra' }))
    const sheet = await screen.findByRole('dialog', { name: 'Compra no cartão' })
    await userEvent.type(within(sheet).getByLabelText('Descrição'), 'TV')
    await userEvent.type(within(sheet).getByLabelText('Valor da parcela'), '4000')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Lançar compra' }))

    expect(await within(sheet).findByText(/ultrapassa o limite disponível/)).toBeInTheDocument()
  })

  it('should list the invoices and pay one with the card default account', async () => {
    const calls = mockCards()
    renderApp(`/carteira/cartoes/${cards.nubank.code}`)

    await userEvent.click(await screen.findByRole('link', { name: /dez\/2026/ }))
    expect(await screen.findByRole('heading', { name: 'Fatura de dez/2026' })).toBeInTheDocument()
    expect(screen.getByText('Livro')).toBeInTheDocument()
    expect(await screen.findByText(/estornado em 02\/12\/2026/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Pagar fatura/ }))
    const sheet = await screen.findByRole('dialog', { name: /Pagar fatura de dez\/2026/ })
    expect(within(sheet).getByRole('combobox', { name: 'Pagar com a conta' })).toHaveTextContent(
      'Carteira',
    )
    await userEvent.click(within(sheet).getByRole('button', { name: 'Confirmar pagamento' }))

    await waitFor(() =>
      expect(calls.payments).toEqual([
        { payment_date: '2026-11-10', account_code: accounts.wallet.code },
      ]),
    )
    expect(await screen.findByText(/Fatura paga/)).toBeInTheDocument()
  })

  it('should open the purchase from the invoice and delete it after confirming', async () => {
    const calls = mockCards()
    renderApp('/carteira/faturas/inv-dec')

    await userEvent.click(await screen.findByRole('button', { name: /Geladeira \(1\/3\)/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Geladeira' })
    await userEvent.click(within(sheet).getByRole('button', { name: 'Excluir' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Excluir compra?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }))

    await waitFor(() => expect(calls.deleted).toEqual(['p1']))
  })
})
