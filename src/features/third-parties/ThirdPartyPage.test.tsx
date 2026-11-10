import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ReceiptRequest, ReceivableResponse, ReceivableUpdateRequest } from '@/api/contracts'
import { mockCommonApi } from '@/test/api'
import { accounts, thirdParties } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

function receivable(overrides: Partial<ReceivableResponse> = {}): ReceivableResponse {
  return {
    code: 'r1',
    third_party_code: 't-mae',
    status: 'PENDING',
    amount: 200,
    received_amount: 0,
    written_off_amount: 0,
    remaining_amount: 200,
    due_date: '2026-12-10',
    purchase_code: 'p1',
    installment_number: 1,
    invoice_code: 'inv1',
    description: 'A receber: Farmácia (1/2)',
    ...overrides,
  }
}

const PARTLY = receivable({
  code: 'r0',
  description: 'A receber: Mercado (1/1)',
  status: 'LATE',
  amount: 150,
  received_amount: 50,
  remaining_amount: 100,
  due_date: '2026-11-01',
})
const NEXT = receivable()
const DONE = receivable({
  code: 'r-done',
  description: 'A receber: Livro (1/1)',
  status: 'PAID_OUT',
  amount: 60,
  received_amount: 60,
  remaining_amount: 0,
})

function mockApi(
  options: {
    receivables?: ReceivableResponse[]
    receiptAnswer?: Response
    dueAnswer?: Response
  } = {},
) {
  const calls = {
    receipts: [] as ReceiptRequest[],
    dueDates: [] as { code: string; body: ReceivableUpdateRequest }[],
  }
  mockCommonApi({
    accounts: [accounts.main, accounts.wallet],
    thirdParties: [thirdParties.mae],
  })
  server.use(
    http.get('/api/third_party/:code', () => HttpResponse.json(thirdParties.mae)),
    http.get('/api/third_party/:code/receivables', () =>
      HttpResponse.json(options.receivables ?? [PARTLY, NEXT, DONE]),
    ),
    http.post('/api/third_party/:code/receipts', async ({ request }) => {
      calls.receipts.push((await request.json()) as ReceiptRequest)
      return options.receiptAnswer ?? HttpResponse.json([PARTLY], { status: 201 })
    }),
    http.patch('/api/third_party/:code/receivables/:receivable', async ({ request, params }) => {
      calls.dueDates.push({
        code: String(params.receivable),
        body: (await request.json()) as ReceivableUpdateRequest,
      })
      return options.dueAnswer ?? HttpResponse.json(NEXT)
    }),
  )
  return calls
}

describe('Terceiro: a receber', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T15:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('should open from the list and show what each receivable still lacks', async () => {
    mockApi()
    renderApp('/carteira/terceiros')

    await userEvent.click(await screen.findByRole('link', { name: /Mãe/ }))
    expect(await screen.findByRole('heading', { name: 'Mãe' })).toBeInTheDocument()

    const partly = (await screen.findByText('A receber: Mercado (1/1)')).closest('li')!
    expect(within(partly).getByText('Atrasado')).toBeInTheDocument()
    expect(within(partly).getByText(/recebido R\$\s50,00 de R\$\s150,00/)).toBeInTheDocument()
    expect(within(partly).getByText(/vence 01\/11/)).toBeInTheDocument()
    const done = screen.getByText('A receber: Livro (1/1)').closest('li')!
    expect(within(done).getByText('Recebido')).toBeInTheDocument()
    expect(within(done).queryByText(/vence/)).not.toBeInTheDocument()
    expect(
      within(done).queryByRole('button', { name: /Alterar vencimento/ }),
    ).not.toBeInTheDocument()
  })

  it('should suggest what is left to receive and send the receipt', async () => {
    const calls = mockApi()
    renderApp('/carteira/terceiros/t-mae')

    await userEvent.click(await screen.findByRole('button', { name: 'Registrar recebimento' }))
    const sheet = await screen.findByRole('dialog', { name: 'Registrar recebimento' })
    // 100 (what is left of the first) + 200 (the second)
    expect(within(sheet).getByLabelText('Valor recebido')).toHaveValue('300,00')
    const amount = within(sheet).getByLabelText('Valor recebido')
    await userEvent.clear(amount)
    await userEvent.type(amount, '120')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Registrar recebimento' }))

    await waitFor(() =>
      expect(calls.receipts).toEqual([{ amount: 120, effective_date: '2026-11-10' }]),
    )
  })

  it('should send the account chosen for the receipt', async () => {
    const calls = mockApi()
    renderApp('/carteira/terceiros/t-mae')

    await userEvent.click(await screen.findByRole('button', { name: 'Registrar recebimento' }))
    const sheet = await screen.findByRole('dialog', { name: 'Registrar recebimento' })
    await userEvent.click(within(sheet).getByRole('combobox', { name: /Conta que recebeu/ }))
    await userEvent.click(await screen.findByRole('option', { name: accounts.wallet.name }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Registrar recebimento' }))

    await waitFor(() => expect(calls.receipts).toHaveLength(1))
    expect(calls.receipts[0]).toMatchObject({ amount: 300, account_code: accounts.wallet.code })
  })

  it('should not send a receipt above what is left to receive', async () => {
    const calls = mockApi()
    renderApp('/carteira/terceiros/t-mae')

    await userEvent.click(await screen.findByRole('button', { name: 'Registrar recebimento' }))
    const sheet = await screen.findByRole('dialog', { name: 'Registrar recebimento' })
    const amount = within(sheet).getByLabelText('Valor recebido')
    await userEvent.clear(amount)
    await userEvent.type(amount, '301')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Registrar recebimento' }))

    expect(await within(sheet).findByText(/Acima do que falta receber/)).toBeInTheDocument()
    expect(calls.receipts).toEqual([])
  })

  it('should show the message of the back when the receipt is refused', async () => {
    mockApi({
      receiptAnswer: HttpResponse.json(
        { message: 'O valor ultrapassa o que falta receber.' },
        { status: 409 },
      ),
    })
    renderApp('/carteira/terceiros/t-mae')

    await userEvent.click(await screen.findByRole('button', { name: 'Registrar recebimento' }))
    const sheet = await screen.findByRole('dialog', { name: 'Registrar recebimento' })
    await userEvent.click(within(sheet).getByRole('button', { name: 'Registrar recebimento' }))

    expect(
      await within(sheet).findByText('O valor ultrapassa o que falta receber.'),
    ).toBeInTheDocument()
  })

  it('should disable the receipt when there is nothing open', async () => {
    mockApi({ receivables: [DONE] })
    renderApp('/carteira/terceiros/t-mae')

    await screen.findByText('A receber: Livro (1/1)')
    expect(screen.getByRole('button', { name: 'Registrar recebimento' })).toBeDisabled()
  })

  it('should change the due date of one receivable', async () => {
    const calls = mockApi()
    renderApp('/carteira/terceiros/t-mae')

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Alterar vencimento de A receber: Farmácia (1/2)',
      }),
    )
    const sheet = await screen.findByRole('dialog', { name: 'Alterar vencimento' })
    const due = within(sheet).getByLabelText('Novo vencimento')
    await userEvent.clear(due)
    await userEvent.type(due, '2026-12-20')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(calls.dueDates).toEqual([{ code: 'r1', body: { due_date: '2026-12-20' } }]),
    )
  })

  it('should show why the back refused the new due date', async () => {
    mockApi({
      dueAnswer: HttpResponse.json({ message: 'O ciclo está fechado.' }, { status: 409 }),
    })
    renderApp('/carteira/terceiros/t-mae')

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Alterar vencimento de A receber: Farmácia (1/2)',
      }),
    )
    const sheet = await screen.findByRole('dialog', { name: 'Alterar vencimento' })
    const due = within(sheet).getByLabelText('Novo vencimento')
    await userEvent.clear(due)
    await userEvent.type(due, '2026-12-20')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Salvar' }))

    expect(await within(sheet).findByText('O ciclo está fechado.')).toBeInTheDocument()
  })
})
