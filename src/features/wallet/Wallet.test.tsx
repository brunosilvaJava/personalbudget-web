import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AccountRequest,
  AccountStatementResponse,
  AccountTransferRequest,
  AccountUpdateRequest,
} from '@/api/contracts'
import { mockCommonApi } from '@/test/api'
import { accounts, transfer } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

const all = [accounts.main, accounts.wallet, accounts.old]

function mockAccounts() {
  const calls = {
    created: [] as AccountRequest[],
    patched: [] as AccountUpdateRequest[],
    inactivated: [] as string[],
    transfers: [] as AccountTransferRequest[],
    reversed: [] as string[],
    statementQueries: [] as URLSearchParams[],
  }
  server.use(
    http.get('/api/account', ({ request }) => {
      const statuses = new URL(request.url).searchParams.getAll('status')
      return HttpResponse.json(
        all.filter((account) => (statuses.length ? statuses : ['ACTIVE']).includes(account.status)),
      )
    }),
    http.get('/api/account/balance', () =>
      HttpResponse.json({
        date: '2026-11-10',
        accounts: [
          { account_code: accounts.main.code, balance: 2318.4 },
          { account_code: accounts.wallet.code, balance: 61.6 },
          { account_code: accounts.old.code, balance: 0 },
        ],
        total: 2380,
      }),
    ),
    http.get('/api/account/:code', ({ params }) =>
      HttpResponse.json(all.find((account) => account.code === params.code)),
    ),
    http.get('/api/account/:code/balance', ({ params }) =>
      HttpResponse.json({
        account_code: params.code,
        date: '2026-11-10',
        initial_balance: 1500,
        settlements_total: 818.4,
        transfers_total: 0,
        balance: 2318.4,
      }),
    ),
    http.get('/api/account/:code/statement', ({ request }) => {
      calls.statementQueries.push(new URL(request.url).searchParams)
      return HttpResponse.json({
        account_code: accounts.main.code,
        start_date: '2026-11-01',
        end_date: '2026-11-30',
        opening_balance: 1000,
        closing_balance: 1478.15,
        entries: [
          {
            type: 'SETTLEMENT',
            date: '2026-11-05',
            amount: 6850,
            balance: 7850,
            description: 'Salário',
            movement_code: 'm1',
            settlement_code: 's1',
            category_code: null,
            invoice_payment_code: null,
            transfer_code: null,
            counterpart_account_code: null,
          },
          {
            type: 'TRANSFER_OUT',
            date: '2026-11-07',
            amount: -200,
            balance: 7650,
            description: null,
            movement_code: null,
            settlement_code: null,
            category_code: null,
            invoice_payment_code: null,
            transfer_code: 't1',
            counterpart_account_code: accounts.wallet.code,
          },
        ],
      } satisfies AccountStatementResponse)
    }),
    http.post('/api/account', async ({ request }) => {
      const body = (await request.json()) as AccountRequest
      calls.created.push(body)
      return HttpResponse.json({ ...accounts.wallet, ...body, code: 'new' }, { status: 201 })
    }),
    http.patch('/api/account/:code', async ({ request }) => {
      calls.patched.push((await request.json()) as AccountUpdateRequest)
      return HttpResponse.json({ ...accounts.wallet, default: true })
    }),
    http.patch('/api/account/:code/inactivate', ({ params }) => {
      calls.inactivated.push(String(params.code))
      return HttpResponse.json({ ...accounts.wallet, status: 'INACTIVE' })
    }),
    http.get('/api/account_transfer', () =>
      HttpResponse.json([
        transfer({ code: 't-active' }),
        transfer({ code: 't-old', amount: 50, reversed_at: '2026-11-03T10:00:00' }),
      ]),
    ),
    http.post('/api/account_transfer', async ({ request }) => {
      const body = (await request.json()) as AccountTransferRequest
      calls.transfers.push(body)
      return HttpResponse.json(transfer({ ...body }), { status: 201 })
    }),
    http.post('/api/account_transfer/:code/reversal', ({ params }) => {
      calls.reversed.push(String(params.code))
      return HttpResponse.json(transfer({ reversed_at: '2026-11-10T12:00:00' }))
    }),
  )
  return calls
}

describe('Carteira', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T15:00:00Z'))
    mockCommonApi()
  })
  afterEach(() => vi.useRealTimers())

  it('should show the total in the accounts and each active account with its balance', async () => {
    mockAccounts()
    renderApp('/carteira')

    expect(await screen.findByText(/R\$\s2\.380,00/)).toBeInTheDocument()
    const main = screen.getByRole('link', { name: /Conta principal/ })
    expect(within(main).getByText('padrão')).toBeInTheDocument()
    expect(within(main).getByText(/R\$\s2\.318,40/)).toBeInTheDocument()
    expect(screen.queryByText('Banco antigo')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Mostrar inativas \(1\)/ }))
    expect(screen.getByText('Banco antigo')).toBeInTheDocument()
  })

  it('should create an account with its initial balance', async () => {
    const calls = mockAccounts()
    renderApp('/carteira/contas')

    await userEvent.click(await screen.findByRole('button', { name: 'Nova conta' }))
    const sheet = await screen.findByRole('dialog', { name: 'Nova conta' })
    await userEvent.type(within(sheet).getByLabelText('Nome'), 'Nubank')
    await userEvent.type(within(sheet).getByLabelText('Saldo inicial'), '1.250,00')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Criar conta' }))

    await waitFor(() =>
      expect(calls.created).toEqual([
        {
          name: 'Nubank',
          type: 'CHECKING',
          initial_balance: 1250,
          initial_balance_date: '2026-11-10',
        },
      ]),
    )
    expect(await screen.findByText('Conta “Nubank” criada.')).toBeInTheDocument()
  })

  it('should show the statement with opening, lines and closing, and make the account the default', async () => {
    const calls = mockAccounts()
    renderApp(`/carteira/contas/${accounts.wallet.code}`)

    expect(await screen.findByRole('heading', { name: 'Carteira', level: 1 })).toBeInTheDocument()
    expect(await screen.findByText('Saldo em 31/10/2026')).toBeInTheDocument()
    expect(calls.statementQueries[0]?.toString()).toBe('start_date=2026-11-01&end_date=2026-11-30')
    expect(screen.getByText('Salário')).toBeInTheDocument()
    expect(screen.getByText(/Transferência para Carteira/)).toBeInTheDocument()
    expect(screen.getByText('Saldo em 30/11/2026')).toBeInTheDocument()
    expect(screen.getByText(/R\$\s1\.478,15/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Tornar padrão' }))
    await waitFor(() => expect(calls.patched).toEqual([{ default: true }]))
  })

  it('should inactivate an account only after confirming', async () => {
    const calls = mockAccounts()
    renderApp(`/carteira/contas/${accounts.wallet.code}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Inativar' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Inativar conta?' })
    expect(calls.inactivated).toEqual([])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Inativar' }))
    await waitFor(() => expect(calls.inactivated).toEqual([accounts.wallet.code]))
  })

  it('should not offer to inactivate the default account', async () => {
    mockAccounts()
    renderApp(`/carteira/contas/${accounts.main.code}`)

    expect(await screen.findByRole('button', { name: 'Editar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Inativar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tornar padrão' })).not.toBeInTheDocument()
  })

  it('should list transfers, transfer between two different accounts and reverse one', async () => {
    const calls = mockAccounts()
    renderApp('/carteira/transferencias')

    expect(await screen.findByText(/estornada em 03\/11\/2026/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Estornar transferência/ })).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: 'Nova transferência' }))
    const sheet = await screen.findByRole('dialog', { name: 'Transferir entre contas' })
    await userEvent.click(within(sheet).getByRole('combobox', { name: 'De' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Conta principal (padrão)' }))
    await userEvent.click(within(sheet).getByRole('combobox', { name: 'Para' }))
    expect(screen.queryByRole('option', { name: /Conta principal/ })).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('option', { name: 'Carteira' }))
    await userEvent.type(within(sheet).getByLabelText('Valor'), '300')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Transferir' }))

    await waitFor(() =>
      expect(calls.transfers).toEqual([
        {
          from_account_code: accounts.main.code,
          to_account_code: accounts.wallet.code,
          amount: 300,
          effective_date: '2026-11-10',
        },
      ]),
    )

    await userEvent.click(screen.getByRole('button', { name: /Estornar transferência/ }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Estornar transferência?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Estornar' }))
    await waitFor(() => expect(calls.reversed).toEqual(['t-active']))
  })
})
