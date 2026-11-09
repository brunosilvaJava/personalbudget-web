import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  FixedBillRequest,
  FixedBillResponse,
  FixedBillUpdateRequest,
  InstallmentBillRequest,
  InstallmentBillResponse,
  InstallmentBillUpdateRequest,
} from '@/api/contracts'
import { mockCommonApi } from '@/test/api'
import { categories, fixedBill, installmentBill, page } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

function mockFixedBills(list: FixedBillResponse[] = []) {
  const calls = {
    queries: [] as URLSearchParams[],
    created: [] as FixedBillRequest[],
    patched: [] as FixedBillUpdateRequest[],
    toggled: [] as string[],
    deleted: [] as string[],
  }
  server.use(
    http.get('/api/fixed_bill', ({ request }) => {
      const query = new URL(request.url).searchParams
      calls.queries.push(query)
      const statuses = query.getAll('status')
      return HttpResponse.json(
        page(list.filter((bill) => !statuses.length || statuses.includes(bill.status))),
      )
    }),
    http.patch('/api/fixed_bill/:code/inactivate', ({ params }) => {
      calls.toggled.push(`inactivate:${String(params.code)}`)
      return HttpResponse.json({ ...list[0], status: 'INACTIVE' })
    }),
    http.patch('/api/fixed_bill/:code/activate', ({ params }) => {
      calls.toggled.push(`activate:${String(params.code)}`)
      return HttpResponse.json({ ...list[0], status: 'ACTIVE' })
    }),
    http.patch('/api/fixed_bill/:code', async ({ params, request }) => {
      const body = (await request.json()) as FixedBillUpdateRequest
      calls.patched.push(body)
      return HttpResponse.json({ ...list.find((bill) => bill.code === params.code), ...body })
    }),
    http.delete('/api/fixed_bill/:code', ({ params }) => {
      calls.deleted.push(String(params.code))
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return calls
}

function mockInstallmentBills(list: InstallmentBillResponse[] = []) {
  const calls = {
    created: [] as InstallmentBillRequest[],
    patched: [] as InstallmentBillUpdateRequest[],
    deleted: [] as string[],
  }
  server.use(
    http.get('/api/installment_bill', () => HttpResponse.json(page(list))),
    http.patch('/api/installment_bill/:code', async ({ params, request }) => {
      const body = (await request.json()) as InstallmentBillUpdateRequest
      calls.patched.push(body)
      return HttpResponse.json({ ...list.find((bill) => bill.code === params.code), ...body })
    }),
    http.delete('/api/installment_bill/:code', ({ params }) => {
      calls.deleted.push(String(params.code))
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return calls
}

describe('Recorrentes › Contas fixas', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T15:30:00Z')) // Tuesday, 12:30 in Brasília
    mockCommonApi()
  })
  afterEach(() => vi.useRealTimers())

  it('should list the active ones with the rule and the next posting', async () => {
    const calls = mockFixedBills([
      fixedBill({ description: 'Aluguel', days: [20, 5], next_due_date: '2026-11-20' }),
      fixedBill({
        description: 'Academia',
        recurrence_type: 'WEEKLY',
        days: [2, 4],
        amount: 99.9,
        next_due_date: '2026-11-11',
      }),
    ])
    renderApp('/recorrentes/fixas')

    expect(await screen.findByText('Aluguel')).toBeInTheDocument()
    expect(screen.getByText('Todo mês, dias 5 e 20')).toBeInTheDocument()
    expect(screen.getByText('Próximo lançamento: 20/11/2026')).toBeInTheDocument()
    expect(screen.getByText('Toda semana: segunda e quarta')).toBeInTheDocument()
    expect(calls.queries[0]?.getAll('status')).toEqual(['ACTIVE'])
  })

  it('should show the inactive ones on the other tab', async () => {
    const calls = mockFixedBills([fixedBill({ description: 'Streaming', status: 'INACTIVE' })])
    renderApp('/recorrentes/fixas')

    await userEvent.click(await screen.findByRole('radio', { name: 'Inativas' }))

    expect(await screen.findByText('Streaming')).toBeInTheDocument()
    expect(calls.queries.at(-1)?.getAll('status')).toEqual(['INACTIVE'])
  })

  it('should create a monthly bill with sorted days and an explicit start date', async () => {
    const calls = mockFixedBills()
    server.use(
      http.post('/api/fixed_bill', async ({ request }) => {
        calls.created.push((await request.json()) as FixedBillRequest)
        return HttpResponse.json(fixedBill({ days: [5, 20], next_due_date: '2026-11-20' }), {
          status: 201,
        })
      }),
    )
    renderApp('/recorrentes/fixas')

    await userEvent.click(await screen.findByRole('button', { name: 'Nova conta fixa' }))
    const sheet = await screen.findByRole('dialog', { name: 'Nova conta fixa' })
    await userEvent.type(within(sheet).getByLabelText('Descrição'), 'Aluguel')
    await userEvent.type(within(sheet).getByLabelText('Valor'), '1500')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Dia 20' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Dia 5' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Criar conta fixa' }))

    await waitFor(() => expect(calls.created).toHaveLength(1))
    expect(calls.created[0]).toEqual({
      operation_type: 'DEBIT',
      description: 'Aluguel',
      amount: 1500,
      recurrence_type: 'MONTHLY',
      days: [5, 20],
      start_date: '2026-11-10',
    })
    expect(
      await screen.findByText(/Conta fixa criada\. Próximo lançamento: 20\/11\/2026/),
    ).toBeInTheDocument()
  })

  it('should warn that today was already posted when saving on an occurrence day', async () => {
    const calls = mockFixedBills()
    server.use(
      http.post('/api/fixed_bill', async ({ request }) => {
        calls.created.push((await request.json()) as FixedBillRequest)
        // Today is the 10th: the back posted it and the next one is already next month.
        return HttpResponse.json(
          fixedBill({ days: [10], start_date: '2026-11-10', next_due_date: '2026-12-10' }),
          { status: 201 },
        )
      }),
    )
    renderApp('/recorrentes/fixas')

    await userEvent.click(await screen.findByRole('button', { name: 'Nova conta fixa' }))
    const sheet = await screen.findByRole('dialog', { name: 'Nova conta fixa' })
    await userEvent.type(within(sheet).getByLabelText('Descrição'), 'Internet')
    await userEvent.type(within(sheet).getByLabelText('Valor'), '120')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Dia 10' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Criar conta fixa' }))

    expect(
      await screen.findByText(/o lançamento de hoje já foi gerado\. Não lance de novo\./),
    ).toBeInTheDocument()
  })

  it('should not send anything and ask for the days when none was chosen', async () => {
    const calls = mockFixedBills()
    renderApp('/recorrentes/fixas')

    await userEvent.click(await screen.findByRole('button', { name: 'Nova conta fixa' }))
    const sheet = await screen.findByRole('dialog', { name: 'Nova conta fixa' })
    await userEvent.type(within(sheet).getByLabelText('Descrição'), 'Aluguel')
    await userEvent.type(within(sheet).getByLabelText('Valor'), '1500')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Criar conta fixa' }))

    expect(await within(sheet).findByText('Escolha quando ela vence.')).toBeInTheDocument()
    expect(calls.created).toHaveLength(0)
  })

  it('should switch the day picker with the recurrence', async () => {
    mockFixedBills()
    renderApp('/recorrentes/fixas')

    await userEvent.click(await screen.findByRole('button', { name: 'Nova conta fixa' }))
    const sheet = await screen.findByRole('dialog', { name: 'Nova conta fixa' })
    expect(within(sheet).getByRole('toolbar', { name: 'Dias do mês' })).toBeInTheDocument()

    await userEvent.click(within(sheet).getByRole('radio', { name: 'Semanal' }))
    expect(within(sheet).getByRole('toolbar', { name: 'Dias da semana' })).toBeInTheDocument()
    expect(within(sheet).queryByRole('toolbar', { name: 'Dias do mês' })).not.toBeInTheDocument()

    await userEvent.click(within(sheet).getByRole('radio', { name: 'Anual' }))
    expect(within(sheet).getByLabelText('Data no ano')).toBeInTheDocument()
  })

  it('should put a 400 on the field it names and on the days picker', async () => {
    mockFixedBills()
    server.use(
      http.post('/api/fixed_bill', () =>
        HttpResponse.json(
          {
            message: 'Dados inválidos',
            validations: {
              description: 'Já existe uma conta fixa com esta descrição',
              days: 'Dia inválido para a recorrência',
            },
          },
          { status: 400 },
        ),
      ),
    )
    renderApp('/recorrentes/fixas')

    await userEvent.click(await screen.findByRole('button', { name: 'Nova conta fixa' }))
    const sheet = await screen.findByRole('dialog', { name: 'Nova conta fixa' })
    await userEvent.type(within(sheet).getByLabelText('Descrição'), 'Aluguel')
    await userEvent.type(within(sheet).getByLabelText('Valor'), '1500')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Dia 5' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Criar conta fixa' }))

    expect(
      await within(sheet).findByText('Já existe uma conta fixa com esta descrição'),
    ).toBeInTheDocument()
    expect(within(sheet).getByText('Dia inválido para a recorrência')).toBeInTheDocument()
  })

  it('should edit sending the description and only what changed', async () => {
    const bill = fixedBill({
      description: 'Aluguel',
      amount: 1500,
      days: [5],
      start_date: '2026-01-05',
    })
    const calls = mockFixedBills([bill])
    renderApp('/recorrentes/fixas')

    await userEvent.click(await screen.findByText('Aluguel'))
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    const sheet = await screen.findByRole('dialog', { name: 'Editar conta fixa' })
    await userEvent.clear(within(sheet).getByLabelText('Valor'))
    await userEvent.type(within(sheet).getByLabelText('Valor'), '1600')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(calls.patched).toHaveLength(1))
    expect(calls.patched[0]).toEqual({ description: 'Aluguel', amount: 1600 })
  })

  it('should inactivate a bill', async () => {
    const bill = fixedBill({ description: 'Aluguel' })
    const calls = mockFixedBills([bill])
    renderApp('/recorrentes/fixas')

    await userEvent.click(await screen.findByText('Aluguel'))
    await userEvent.click(await screen.findByRole('button', { name: 'Inativar (parar de lançar)' }))

    await waitFor(() => expect(calls.toggled).toEqual([`inactivate:${bill.code}`]))
    expect(await screen.findByText('Conta fixa inativada.')).toBeInTheDocument()
  })

  it('should delete only after confirming', async () => {
    const bill = fixedBill({ description: 'Aluguel' })
    const calls = mockFixedBills([bill])
    renderApp('/recorrentes/fixas')

    await userEvent.click(await screen.findByText('Aluguel'))
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Excluir conta fixa?' })
    expect(calls.deleted).toHaveLength(0)

    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }))

    await waitFor(() => expect(calls.deleted).toEqual([bill.code]))
    expect(await screen.findByText('Conta fixa excluída.')).toBeInTheDocument()
  })

  it('should show the empty state with a hint', async () => {
    mockFixedBills([])
    renderApp('/recorrentes/fixas')
    expect(await screen.findByText('Nenhuma conta fixa ativa')).toBeInTheDocument()
  })

  it('should show an error with retry when the API fails', async () => {
    server.use(
      http.get('/api/fixed_bill', () =>
        HttpResponse.json({ message: 'Erro interno no servidor' }, { status: 500 }),
      ),
    )
    renderApp('/recorrentes/fixas')
    expect(await screen.findByRole('button', { name: /Tentar de novo/ })).toBeInTheDocument()
  })

  it('should only offer categories of the same type', async () => {
    mockFixedBills()
    renderApp('/recorrentes/fixas')

    await userEvent.click(await screen.findByRole('button', { name: 'Nova conta fixa' }))
    const sheet = await screen.findByRole('dialog', { name: 'Nova conta fixa' })
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Receita' }))
    await userEvent.click(within(sheet).getByRole('combobox', { name: /Categoria/ }))

    expect(await screen.findByRole('option', { name: categories.salario.name })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: categories.mercado.name })).not.toBeInTheDocument()
  })
})

describe('Recorrentes › Parceladas', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T15:30:00Z'))
    mockCommonApi()
  })
  afterEach(() => vi.useRealTimers())

  it('should list the value per installment, how many were posted and the total', async () => {
    mockInstallmentBills([installmentBill()])
    renderApp('/recorrentes/parceladas')

    expect(await screen.findByText('Carnê da loja')).toBeInTheDocument()
    expect(screen.getByText(/2 de 10 lançadas · total/)).toHaveTextContent('R$ 1.500,00')
    expect(screen.getByText('Próxima parcela: 15/12/2026')).toBeInTheDocument()
    expect(screen.getByText('por parcela')).toBeInTheDocument()
  })

  it('should mark a concluded bill and send the person to Cartões for card purchases', async () => {
    mockInstallmentBills([
      installmentBill({
        status: 'DONE',
        installment_count: 10,
        next_installment_date: null,
      }),
    ])
    renderApp('/recorrentes/parceladas')

    expect(await screen.findByText('concluída')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Carteira › Cartões/ })).toHaveAttribute(
      'href',
      '/carteira/cartoes',
    )
  })

  it('should compute the purchase total while typing', async () => {
    mockInstallmentBills()
    renderApp('/recorrentes/parceladas')

    await userEvent.click(await screen.findByRole('button', { name: 'Nova parcelada' }))
    const sheet = await screen.findByRole('dialog', { name: 'Nova compra parcelada' })
    expect(within(sheet).getByText('—')).toBeInTheDocument()
    await userEvent.type(within(sheet).getByLabelText('Valor da parcela'), '150')
    await userEvent.type(within(sheet).getByLabelText('Parcelas'), '10')

    expect(within(sheet).getByText('R$ 1.500,00')).toBeInTheDocument()
  })

  it('should warn that overdue installments are posted when the purchase is over 30 days old', async () => {
    mockInstallmentBills()
    renderApp('/recorrentes/parceladas')

    await userEvent.click(await screen.findByRole('button', { name: 'Nova parcelada' }))
    const sheet = await screen.findByRole('dialog', { name: 'Nova compra parcelada' })
    const warning =
      'A compra tem mais de 30 dias: as parcelas já vencidas serão lançadas ao salvar.'
    expect(within(sheet).queryByText(warning)).not.toBeInTheDocument()

    fireEvent.change(within(sheet).getByLabelText('Data da compra'), {
      target: { value: '2026-09-01' },
    })

    expect(await within(sheet).findByText(warning)).toBeInTheDocument()
  })

  it('should create sending the value of each installment, and say how many were posted', async () => {
    const calls = mockInstallmentBills()
    server.use(
      http.post('/api/installment_bill', async ({ request }) => {
        calls.created.push((await request.json()) as InstallmentBillRequest)
        return HttpResponse.json(installmentBill({ installment_count: 2 }), { status: 201 })
      }),
    )
    renderApp('/recorrentes/parceladas')

    await userEvent.click(await screen.findByRole('button', { name: 'Nova parcelada' }))
    const sheet = await screen.findByRole('dialog', { name: 'Nova compra parcelada' })
    await userEvent.type(within(sheet).getByLabelText('Descrição'), 'Carnê da loja')
    await userEvent.type(within(sheet).getByLabelText('Valor da parcela'), '150')
    await userEvent.type(within(sheet).getByLabelText('Parcelas'), '10')
    fireEvent.change(within(sheet).getByLabelText('Data da compra'), {
      target: { value: '2026-09-15' },
    })
    await userEvent.click(within(sheet).getByRole('button', { name: 'Criar parcelada' }))

    await waitFor(() => expect(calls.created).toHaveLength(1))
    expect(calls.created[0]).toEqual({
      operation_type: 'DEBIT',
      description: 'Carnê da loja',
      amount: 150,
      purchase_date: '2026-09-15',
      installment_total: 10,
    })
    expect(await screen.findByText(/2 parcelas foram lançadas ao salvar\./)).toBeInTheDocument()
  })

  it('should edit sending the description and only what changed', async () => {
    const bill = installmentBill({ purchase_date: '2026-10-15' })
    const calls = mockInstallmentBills([bill])
    renderApp('/recorrentes/parceladas')

    await userEvent.click(await screen.findByText('Carnê da loja'))
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    const sheet = await screen.findByRole('dialog', { name: 'Editar parcelada' })
    expect(within(sheet).getByText('2 já lançadas')).toBeInTheDocument()
    const total = within(sheet).getByLabelText('Parcelas')
    await userEvent.clear(total)
    await userEvent.type(total, '12')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(calls.patched).toHaveLength(1))
    expect(calls.patched[0]).toEqual({ description: 'Carnê da loja', installment_total: 12 })
  })

  it('should show the back message when it refuses fewer installments than the posted ones', async () => {
    const bill = installmentBill({ purchase_date: '2026-10-15' })
    mockInstallmentBills([bill])
    server.use(
      http.patch('/api/installment_bill/:code', () =>
        HttpResponse.json(
          {
            message: 'Dados inválidos',
            validations: { installment_total: 'não pode ser menor que as parcelas já lançadas' },
          },
          { status: 400 },
        ),
      ),
    )
    renderApp('/recorrentes/parceladas')

    await userEvent.click(await screen.findByText('Carnê da loja'))
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    const sheet = await screen.findByRole('dialog', { name: 'Editar parcelada' })
    const total = within(sheet).getByLabelText('Parcelas')
    await userEvent.clear(total)
    await userEvent.type(total, '1')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Salvar' }))

    expect(
      await within(sheet).findByText('não pode ser menor que as parcelas já lançadas'),
    ).toBeInTheDocument()
  })

  it('should delete only after confirming', async () => {
    const bill = installmentBill()
    const calls = mockInstallmentBills([bill])
    renderApp('/recorrentes/parceladas')

    await userEvent.click(await screen.findByText('Carnê da loja'))
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Excluir parcelada?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }))

    await waitFor(() => expect(calls.deleted).toEqual([bill.code]))
  })
})
