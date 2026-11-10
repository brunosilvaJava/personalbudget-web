import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  CardPurchaseRequest,
  CardPurchaseResponse,
  CardPurchaseUpdateRequest,
  CreditCardResponse,
  CreditCardUpdateRequest,
  CreditCardPlasticUpdateRequest,
  ThirdPartyRequest,
} from '@/api/contracts'
import { mockCommonApi } from '@/test/api'
import { accounts, cards, holders, plastics, thirdParties } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

const CARD = cards.nubank.code

const purchase: CardPurchaseResponse = {
  code: 'p1',
  card_code: CARD,
  description: 'Farmácia',
  purchase_date: '2026-11-10',
  installments: 1,
  installment_amount: 50,
  total_amount: 50,
  category_code: null,
  card_holder_code: null,
  card_holder_name: null,
  card_last_digits: null,
  third_party_code: 't-mae',
  third_party_name: 'Mãe',
  first_installment: 1,
  installment_list: [],
}

function mockApi(
  options: {
    card?: Partial<CreditCardResponse>
    thirdParties?: (typeof thirdParties)[keyof typeof thirdParties][]
    inactivateAnswer?: Response
  } = {},
) {
  const calls = {
    thirdParties: [] as ThirdPartyRequest[],
    toggled: [] as string[],
    cardUpdates: [] as CreditCardUpdateRequest[],
    plasticUpdates: [] as CreditCardPlasticUpdateRequest[],
    purchases: [] as CardPurchaseRequest[],
    purchaseUpdates: [] as CardPurchaseUpdateRequest[],
  }
  const card = { ...cards.nubank, ...options.card }
  mockCommonApi({
    accounts: [accounts.main],
    cards: [card],
    holders: [holders.titular, holders.marcia],
    plastics: [{ ...plastics.marcia, default_third_party_code: 't-mae' }],
    thirdParties: options.thirdParties ?? [thirdParties.mae, thirdParties.amigo],
  })
  server.use(
    http.get('/api/credit_card/:code', () => HttpResponse.json(card)),
    http.get('/api/credit_card/:code/limit', () =>
      HttpResponse.json({ card_code: CARD, credit_limit: 5000, used: 0, available: 5000 }),
    ),
    http.get('/api/credit_card/:code/invoice', () => HttpResponse.json([])),
    http.patch('/api/credit_card/:code/plastic/:plastic', async ({ request }) => {
      calls.plasticUpdates.push((await request.json()) as CreditCardPlasticUpdateRequest)
      return HttpResponse.json(plastics.marcia)
    }),
    http.patch('/api/credit_card/:code', async ({ request }) => {
      calls.cardUpdates.push((await request.json()) as CreditCardUpdateRequest)
      return HttpResponse.json(card)
    }),
    http.post('/api/third_party', async ({ request }) => {
      const body = (await request.json()) as ThirdPartyRequest
      calls.thirdParties.push(body)
      return HttpResponse.json({ ...thirdParties.mae, name: body.name }, { status: 201 })
    }),
    http.patch('/api/third_party/:code/inactivate', ({ params }) => {
      calls.toggled.push(`inactivate ${String(params.code)}`)
      return (
        options.inactivateAnswer ?? HttpResponse.json({ ...thirdParties.mae, status: 'INACTIVE' })
      )
    }),
    http.patch('/api/third_party/:code/activate', ({ params }) => {
      calls.toggled.push(`activate ${String(params.code)}`)
      return HttpResponse.json({ ...thirdParties.amigo, status: 'ACTIVE' })
    }),
    http.post('/api/card_purchase', async ({ request }) => {
      calls.purchases.push((await request.json()) as CardPurchaseRequest)
      return HttpResponse.json(purchase, { status: 201 })
    }),
    http.patch('/api/card_purchase/:code', async ({ request }) => {
      calls.purchaseUpdates.push((await request.json()) as CardPurchaseUpdateRequest)
      return HttpResponse.json(purchase)
    }),
    http.get('/api/card_purchase/:code', () => HttpResponse.json(purchase)),
  )
  return calls
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-10T15:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('Terceiros', () => {
  it('should list the third parties with what is still to receive', async () => {
    mockApi()
    renderApp('/carteira/terceiros')

    const mae = (await screen.findByText('Mãe')).closest('li')!
    expect(
      within(mae).getByText(/A receber R\$\s300,00 · R\$\s100,00 atrasado/),
    ).toBeInTheDocument()
    const amigo = screen.getByText('Amigo').closest('li')!
    expect(within(amigo).getByText('inativo')).toBeInTheDocument()
    expect(within(amigo).getByText('Nada a receber')).toBeInTheDocument()
  })

  it('should register a third party', async () => {
    const calls = mockApi()
    renderApp('/carteira/terceiros')

    await userEvent.click(await screen.findByRole('button', { name: 'Novo terceiro' }))
    const sheet = await screen.findByRole('dialog', { name: 'Novo terceiro' })
    await userEvent.type(within(sheet).getByLabelText('Nome'), 'Tio Zé')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Cadastrar terceiro' }))

    await waitFor(() => expect(calls.thirdParties).toEqual([{ name: 'Tio Zé' }]))
  })

  it('should show the message of the back when it refuses to inactivate', async () => {
    const calls = mockApi({
      inactivateAnswer: HttpResponse.json(
        { message: 'O terceiro ainda tem valores a receber.' },
        { status: 409 },
      ),
    })
    renderApp('/carteira/terceiros')

    await userEvent.click(await screen.findByRole('button', { name: 'Inativar Mãe' }))

    expect(await screen.findByText('O terceiro ainda tem valores a receber.')).toBeInTheDocument()
    expect(calls.toggled).toEqual(['inactivate t-mae'])
  })

  it('should activate an inactive third party', async () => {
    const calls = mockApi()
    renderApp('/carteira/terceiros')

    await userEvent.click(await screen.findByRole('button', { name: 'Ativar Amigo' }))

    await waitFor(() => expect(calls.toggled).toEqual(['activate t-amigo']))
  })
})

describe('Terceiro padrão', () => {
  it('should set the default third party of the card', async () => {
    const calls = mockApi()
    renderApp(`/carteira/cartoes/${CARD}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    const sheet = await screen.findByRole('dialog', { name: 'Editar cartão' })
    await userEvent.click(within(sheet).getByRole('combobox', { name: /Terceiro padrão/ }))
    await userEvent.click(await screen.findByRole('option', { name: 'Mãe' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(calls.cardUpdates).toEqual([{ default_third_party_code: 't-mae' }]))
  })

  it('should clear the default third party of the card with the flag', async () => {
    const calls = mockApi({ card: { default_third_party_code: 't-mae' } })
    renderApp(`/carteira/cartoes/${CARD}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    const sheet = await screen.findByRole('dialog', { name: 'Editar cartão' })
    const field = within(sheet).getByRole('combobox', { name: /Terceiro padrão/ })
    await waitFor(() => expect(field).toHaveTextContent('Mãe'))
    await userEvent.click(field)
    await userEvent.click(await screen.findByRole('option', { name: 'Ninguém (minhas compras)' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(calls.cardUpdates).toEqual([{ clear_default_third_party: true }]))
  })

  it('should clear the default third party of a plastic', async () => {
    const calls = mockApi()
    renderApp(`/carteira/cartoes/${CARD}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Editar plástico final 3202' }))
    const sheet = await screen.findByRole('dialog', { name: 'Plástico final 3202' })
    const field = within(sheet).getByRole('combobox', { name: /Terceiro padrão/ })
    await waitFor(() => expect(field).toHaveTextContent('Mãe'))
    await userEvent.click(field)
    await userEvent.click(await screen.findByRole('option', { name: 'Seguir o padrão do cartão' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(calls.plasticUpdates).toEqual([{ clear_default_third_party: true }]))
  })
})

describe('Compra de terceiro', () => {
  async function openNewPurchase() {
    await userEvent.click(await screen.findByRole('button', { name: 'Nova compra' }))
    const sheet = await screen.findByRole('dialog', { name: 'Compra no cartão' })
    await userEvent.type(within(sheet).getByLabelText('Descrição'), 'Farmácia')
    await userEvent.type(within(sheet).getByLabelText('Valor da parcela'), '50')
    return sheet
  }

  it('should send the third party chosen for the purchase', async () => {
    const calls = mockApi()
    renderApp(`/carteira/cartoes/${CARD}`)

    const sheet = await openNewPurchase()
    await userEvent.click(
      await within(sheet).findByRole('combobox', { name: 'De quem é a compra' }),
    )
    await userEvent.click(await screen.findByRole('option', { name: 'Mãe' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Lançar compra' }))

    await waitFor(() => expect(calls.purchases).toHaveLength(1))
    expect(calls.purchases[0]).toMatchObject({ third_party_code: 't-mae' })
    expect(calls.purchases[0]).not.toHaveProperty('own_expense')
    expect(await screen.findByText(/de Mãe/)).toBeInTheDocument()
  })

  it('should send own_expense to ignore the defaults', async () => {
    const calls = mockApi({ card: { default_third_party_code: 't-mae' } })
    renderApp(`/carteira/cartoes/${CARD}`)

    const sheet = await openNewPurchase()
    await userEvent.click(
      await within(sheet).findByRole('combobox', { name: 'De quem é a compra' }),
    )
    await userEvent.click(await screen.findByRole('option', { name: 'Minha despesa' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Lançar compra' }))

    await waitFor(() => expect(calls.purchases).toHaveLength(1))
    expect(calls.purchases[0]).toMatchObject({ own_expense: true })
    expect(calls.purchases[0]).not.toHaveProperty('third_party_code')
  })

  it('should send neither field when the default is kept', async () => {
    const calls = mockApi()
    renderApp(`/carteira/cartoes/${CARD}`)

    const sheet = await openNewPurchase()
    await within(sheet).findByRole('combobox', { name: 'De quem é a compra' })
    await userEvent.click(within(sheet).getByRole('button', { name: 'Lançar compra' }))

    await waitFor(() => expect(calls.purchases).toHaveLength(1))
    expect(calls.purchases[0]).not.toHaveProperty('own_expense')
    expect(calls.purchases[0]).not.toHaveProperty('third_party_code')
  })

  it('should hide the field while there is no active third party', async () => {
    mockApi({ thirdParties: [thirdParties.amigo] })
    renderApp(`/carteira/cartoes/${CARD}`)

    const sheet = await openNewPurchase()
    expect(within(sheet).queryByText('De quem é a compra')).not.toBeInTheDocument()
  })

  async function openEditOfCreatedPurchase() {
    const sheet = await openNewPurchase()
    await userEvent.click(within(sheet).getByRole('button', { name: 'Lançar compra' }))
    const result = await screen.findByRole('dialog', { name: 'Farmácia' })
    await userEvent.click(within(result).getByRole('button', { name: 'Editar' }))
    return screen.findByRole('dialog', { name: 'Editar compra' })
  }

  it('should send nothing about the owner when an edit keeps it', async () => {
    const calls = mockApi()
    renderApp(`/carteira/cartoes/${CARD}`)

    const edit = await openEditOfCreatedPurchase()
    const owner = within(edit).getByRole('combobox', { name: 'De quem é a compra' })
    await waitFor(() => expect(owner).toHaveTextContent('Mãe'))
    const description = within(edit).getByLabelText('Descrição')
    await userEvent.clear(description)
    await userEvent.type(description, 'Farmácia do bairro')
    await userEvent.click(within(edit).getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(calls.purchaseUpdates).toHaveLength(1))
    expect(calls.purchaseUpdates[0]).toEqual({ description: 'Farmácia do bairro' })
  })

  it('should send own_expense when an edit turns the purchase into mine', async () => {
    const calls = mockApi()
    renderApp(`/carteira/cartoes/${CARD}`)

    const edit = await openEditOfCreatedPurchase()
    await userEvent.click(within(edit).getByRole('combobox', { name: 'De quem é a compra' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Minha despesa' }))
    await userEvent.click(within(edit).getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(calls.purchaseUpdates).toEqual([{ own_expense: true }]))
  })
})
