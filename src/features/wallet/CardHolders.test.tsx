import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  CardPurchaseRequest,
  CardPurchaseResponse,
  CreditCardHolderRequest,
  CreditCardPlasticRequest,
  CreditCardPlasticUpdateRequest,
} from '@/api/contracts'
import { mockCommonApi } from '@/test/api'
import { accounts, cards, holders, plastics } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

const CARD = cards.nubank.code

const purchase: CardPurchaseResponse = {
  code: 'p1',
  card_code: CARD,
  description: 'Mercado',
  purchase_date: '2026-11-10',
  installments: 1,
  installment_amount: 80,
  total_amount: 80,
  category_code: null,
  card_holder_code: holders.marcia.code,
  card_holder_name: 'Márcia',
  card_last_digits: '3202',
  third_party_code: null,
  third_party_name: null,
  first_installment: 1,
  installment_list: [],
}

function mockHolders(options: { withPlastics?: boolean; inactivateAnswer?: Response } = {}) {
  const calls = {
    holders: [] as CreditCardHolderRequest[],
    renamed: [] as unknown[],
    toggled: [] as string[],
    plastics: [] as CreditCardPlasticRequest[],
    plasticUpdates: [] as CreditCardPlasticUpdateRequest[],
    purchases: [] as CardPurchaseRequest[],
  }
  mockCommonApi({
    accounts: [accounts.main],
    cards: [cards.nubank],
    holders: [holders.titular, holders.marcia],
    plastics: options.withPlastics === false ? [] : [plastics.main, plastics.marcia],
  })
  server.use(
    http.get('/api/credit_card/:code', () => HttpResponse.json(cards.nubank)),
    http.get('/api/credit_card/:code/limit', () =>
      HttpResponse.json({ card_code: CARD, credit_limit: 5000, used: 0, available: 5000 }),
    ),
    http.get('/api/credit_card/:code/invoice', () => HttpResponse.json([])),
    http.post('/api/credit_card/:code/holder', async ({ request }) => {
      const body = (await request.json()) as CreditCardHolderRequest
      calls.holders.push(body)
      return HttpResponse.json(
        { ...holders.marcia, code: 'h-new', name: body.name },
        { status: 201 },
      )
    }),
    http.patch('/api/credit_card/:code/holder/:holder/inactivate', ({ params }) => {
      calls.toggled.push(`inactivate ${String(params.holder)}`)
      return (
        options.inactivateAnswer ?? HttpResponse.json({ ...holders.marcia, status: 'INACTIVE' })
      )
    }),
    http.patch('/api/credit_card/:code/holder/:holder', async ({ request }) => {
      calls.renamed.push(await request.json())
      return HttpResponse.json(holders.marcia)
    }),
    http.post('/api/credit_card/:code/plastic', async ({ request }) => {
      const body = (await request.json()) as CreditCardPlasticRequest
      calls.plastics.push(body)
      return HttpResponse.json({ ...plastics.marcia, ...body, code: 'p-new' }, { status: 201 })
    }),
    http.patch('/api/credit_card/:code/plastic/:plastic', async ({ request }) => {
      calls.plasticUpdates.push((await request.json()) as CreditCardPlasticUpdateRequest)
      return HttpResponse.json(plastics.marcia)
    }),
    http.post('/api/card_purchase', async ({ request }) => {
      calls.purchases.push((await request.json()) as CardPurchaseRequest)
      return HttpResponse.json(purchase, { status: 201 })
    }),
    http.get('/api/card_purchase/:code', () => HttpResponse.json(purchase)),
  )
  return calls
}

describe('Titulares e plásticos', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T15:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('should list each holder with the plastics it carries', async () => {
    mockHolders()
    renderApp(`/carteira/cartoes/${CARD}`)

    const section = await screen.findByRole('region', { name: 'Titulares e plásticos' })
    expect(await within(section).findByText('Márcia')).toBeInTheDocument()
    expect(within(section).getByText('titular')).toBeInTheDocument()
    expect(within(section).getByText('adicional')).toBeInTheDocument()
    expect(
      within(section).getByRole('button', { name: 'Editar plástico final 3202' }),
    ).toHaveTextContent('final 3202 · Não informado')
    expect(
      within(section).getByRole('button', { name: 'Editar plástico final 3578' }),
    ).toHaveTextContent('final 3578 · Físico')
  })

  it('should not offer to inactivate the TITULAR', async () => {
    mockHolders()
    renderApp(`/carteira/cartoes/${CARD}`)

    const section = await screen.findByRole('region', { name: 'Titulares e plásticos' })
    await within(section).findByText('Márcia')
    expect(
      within(section).queryByRole('button', { name: 'Inativar Bruno' }),
    ).not.toBeInTheDocument()
    expect(within(section).getByRole('button', { name: 'Inativar Márcia' })).toBeInTheDocument()
  })

  it('should add an additional holder', async () => {
    const calls = mockHolders()
    renderApp(`/carteira/cartoes/${CARD}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Novo titular' }))
    const sheet = await screen.findByRole('dialog', { name: 'Novo titular' })
    await userEvent.type(within(sheet).getByLabelText('Nome'), 'Ana')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Adicionar titular' }))

    await waitFor(() => expect(calls.holders).toEqual([{ name: 'Ana' }]))
  })

  it('should send only the new name when renaming', async () => {
    const calls = mockHolders()
    renderApp(`/carteira/cartoes/${CARD}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Renomear Márcia' }))
    const sheet = await screen.findByRole('dialog', { name: 'Renomear titular' })
    const name = within(sheet).getByLabelText('Nome')
    await userEvent.clear(name)
    await userEvent.type(name, 'Márcia S.')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(calls.renamed).toEqual([{ name: 'Márcia S.' }]))
  })

  it('should inactivate an additional holder and show the 409 message of the back', async () => {
    const calls = mockHolders({
      inactivateAnswer: HttpResponse.json(
        { message: 'O titular tem plásticos ativos.' },
        { status: 409 },
      ),
    })
    renderApp(`/carteira/cartoes/${CARD}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Inativar Márcia' }))

    expect(await screen.findByText('O titular tem plásticos ativos.')).toBeInTheDocument()
    expect(calls.toggled).toEqual(['inactivate h-marcia'])
  })

  it('should register a plastic with the 4 digits and refuse fewer', async () => {
    const calls = mockHolders({ withPlastics: false })
    renderApp(`/carteira/cartoes/${CARD}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Novo plástico' }))
    const sheet = await screen.findByRole('dialog', { name: 'Novo plástico' })
    await userEvent.click(within(sheet).getByRole('combobox', { name: 'Titular' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Márcia' }))
    await userEvent.type(within(sheet).getByLabelText('Últimos 4 dígitos'), '32')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Cadastrar plástico' }))
    expect(await within(sheet).findByText('Informe os 4 últimos dígitos.')).toBeInTheDocument()
    expect(calls.plastics).toEqual([])

    await userEvent.type(within(sheet).getByLabelText('Últimos 4 dígitos'), '02')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Cadastrar plástico' }))

    await waitFor(() =>
      expect(calls.plastics).toEqual([
        { holder_code: 'h-marcia', last_digits: '3202', kind: 'UNKNOWN' },
      ]),
    )
  })

  it('should change only the kind of a plastic', async () => {
    const calls = mockHolders()
    renderApp(`/carteira/cartoes/${CARD}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Editar plástico final 3202' }))
    const sheet = await screen.findByRole('dialog', { name: 'Plástico final 3202' })
    await userEvent.click(within(sheet).getByRole('combobox', { name: 'Tipo' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Virtual' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(calls.plasticUpdates).toEqual([{ kind: 'VIRTUAL' }]))
  })
})

describe('Compra com plástico', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T15:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('should send the last digits of the chosen plastic and show who used the card', async () => {
    const calls = mockHolders()
    renderApp(`/carteira/cartoes/${CARD}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Nova compra' }))
    const sheet = await screen.findByRole('dialog', { name: 'Compra no cartão' })
    await userEvent.type(within(sheet).getByLabelText('Descrição'), 'Mercado')
    await userEvent.type(within(sheet).getByLabelText('Valor da parcela'), '80')
    await userEvent.click(await within(sheet).findByRole('combobox', { name: /Quem usou/ }))
    await userEvent.click(await screen.findByRole('option', { name: 'final 3202 · Márcia' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Lançar compra' }))

    await waitFor(() =>
      expect(calls.purchases).toEqual([
        {
          card_code: CARD,
          description: 'Mercado',
          purchase_date: '2026-11-10',
          installments: 1,
          installment_amount: 80,
          card_last_digits: '3202',
        },
      ]),
    )
    const result = await screen.findByRole('dialog', { name: 'Mercado' })
    expect(within(result).getByText(/Márcia \(final 3202\)/)).toBeInTheDocument()
  })

  it('should send no holder when the plastic is left as the default', async () => {
    const calls = mockHolders()
    renderApp(`/carteira/cartoes/${CARD}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Nova compra' }))
    const sheet = await screen.findByRole('dialog', { name: 'Compra no cartão' })
    await userEvent.type(within(sheet).getByLabelText('Descrição'), 'Mercado')
    await userEvent.type(within(sheet).getByLabelText('Valor da parcela'), '80')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Lançar compra' }))

    await waitFor(() => expect(calls.purchases).toHaveLength(1))
    expect(calls.purchases[0]).not.toHaveProperty('card_last_digits')
    expect(calls.purchases[0]).not.toHaveProperty('card_holder_code')
  })

  it('should not show the plastic field when the card has no plastic', async () => {
    mockHolders({ withPlastics: false })
    renderApp(`/carteira/cartoes/${CARD}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Nova compra' }))
    const sheet = await screen.findByRole('dialog', { name: 'Compra no cartão' })
    await within(sheet).findByLabelText('Descrição')
    expect(within(sheet).queryByText(/Quem usou o cartão/)).not.toBeInTheDocument()
  })
})
