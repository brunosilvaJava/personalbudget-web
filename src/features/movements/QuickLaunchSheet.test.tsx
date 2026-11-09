import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FinancialMovementRequest, MovementSettlementRequest } from '@/api/contracts'
import { mockCommonApi } from '@/test/api'
import { categories, movement, page } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

function mockWrites(options: { settlementFails?: number; createError?: Response } = {}) {
  const created: FinancialMovementRequest[] = []
  const settled: MovementSettlementRequest[] = []
  let failures = options.settlementFails ?? 0
  server.use(
    http.get('/api/financial_movement', () => HttpResponse.json(page([]))),
    http.post('/api/financial_movement', async ({ request }) => {
      if (options.createError) return options.createError
      const body = (await request.json()) as FinancialMovementRequest
      created.push(body)
      return HttpResponse.json(
        movement({ ...body, code: 'new-movement', category_code: body.category_code ?? null }),
        { status: 201 },
      )
    }),
    http.post('/api/financial_movement/:code/settlements', async ({ request }) => {
      settled.push((await request.json()) as MovementSettlementRequest)
      if (failures > 0) {
        failures -= 1
        return HttpResponse.json({ message: 'Erro interno no servidor' }, { status: 500 })
      }
      return HttpResponse.json({ code: 's1' }, { status: 201 })
    }),
  )
  return { created, settled }
}

async function openLaunch(path = '/movimentacoes?lancar=1') {
  const result = renderApp(path)
  const sheet = await screen.findByRole('dialog', { name: 'Lançar' })
  return { ...result, sheet }
}

describe('QuickLaunchSheet', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T15:30:00Z')) // 12:30 in Brasília
    mockCommonApi()
  })
  afterEach(() => vi.useRealTimers())

  it('should launch a paid expense in two calls: the movement, then the whole settlement', async () => {
    const { created, settled } = mockWrites()
    const { sheet, router } = await openLaunch()

    expect(within(sheet).getByLabelText('Valor')).toHaveFocus()
    await userEvent.type(within(sheet).getByLabelText('Valor'), '18,40')
    await userEvent.type(within(sheet).getByLabelText('Descrição'), 'Pão e leite')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Lançar despesa paga' }))

    await waitFor(() => expect(settled).toHaveLength(1))
    expect(created[0]).toEqual({
      operation_type: 'DEBIT',
      description: 'Pão e leite',
      amount: 18.4,
      movement_date: '2026-11-10T12:30:00',
      due_date: '2026-11-10T12:30:00',
    })
    expect(settled[0]).toEqual({ amount: 18.4, effective_date: '2026-11-10' })
    expect(await screen.findByText(/Despesa de R\$\s18,40 lançada e paga/)).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.search).toBe(''))
  })

  it('should create only the movement when "ainda não paguei" is on, with the due date', async () => {
    const { created, settled } = mockWrites()
    const { sheet } = await openLaunch()

    await userEvent.type(within(sheet).getByLabelText('Valor'), '231,77')
    await userEvent.type(within(sheet).getByLabelText('Descrição'), 'Energia elétrica')
    await userEvent.click(within(sheet).getByRole('switch', { name: 'Ainda não paguei' }))
    const due = within(sheet).getByLabelText('Vencimento')
    await userEvent.clear(due)
    await userEvent.type(due, '2026-11-15')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Lançar despesa pendente' }))

    await waitFor(() => expect(created).toHaveLength(1))
    expect(created[0]?.due_date).toBe('2026-11-15T00:00:00')
    expect(settled).toHaveLength(0)
  })

  it('should keep the movement and offer to pay again when the settlement fails', async () => {
    const { created, settled } = mockWrites({ settlementFails: 1 })
    const { sheet } = await openLaunch()

    await userEvent.type(within(sheet).getByLabelText('Valor'), '60')
    await userEvent.type(within(sheet).getByLabelText('Descrição'), 'Gasolina')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Lançar despesa paga' }))

    expect(await screen.findByText(/ficou pendente/)).toBeInTheDocument()
    expect(created).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Tentar pagar de novo' }))

    expect(await screen.findByText('Pagamento registrado.')).toBeInTheDocument()
    expect(settled).toEqual([
      { amount: 60, effective_date: '2026-11-10' },
      { amount: 60, effective_date: '2026-11-10' },
    ])
    expect(created).toHaveLength(1)
  })

  it('should fill an empty description with the category name and ask to complete a short one', async () => {
    const { created } = mockWrites()
    const { sheet } = await openLaunch()

    await userEvent.type(within(sheet).getByLabelText('Valor'), '120')
    await userEvent.click(within(sheet).getByRole('combobox', { name: 'Categoria (opcional)' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Gás' }))

    const description = within(sheet).getByLabelText('Descrição')
    expect(description).toHaveValue('Gás')
    expect(await within(sheet).findByText(/ao menos 4 letras/)).toBeInTheDocument()

    await userEvent.type(description, ' de cozinha')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Lançar despesa paga' }))
    await waitFor(() => expect(created).toHaveLength(1))
    expect(created[0]).toMatchObject({
      description: 'Gás de cozinha',
      category_code: categories.gas.code,
    })
  })

  it('should not send without amount and should put a 400 on its field', async () => {
    const { created } = mockWrites({
      createError: HttpResponse.json(
        { message: 'Campos inválidos', validations: { description: 'já existe algo assim' } },
        { status: 400 },
      ),
    })
    const { sheet } = await openLaunch()

    await userEvent.type(within(sheet).getByLabelText('Descrição'), 'Almoço')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Lançar despesa paga' }))
    expect(await within(sheet).findByText('Informe o valor.')).toBeInTheDocument()
    expect(created).toHaveLength(0)

    await userEvent.type(within(sheet).getByLabelText('Valor'), '42')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Lançar despesa paga' }))
    expect(await within(sheet).findByText('já existe algo assim')).toBeInTheDocument()
    expect(within(sheet).getByLabelText('Descrição')).toHaveAttribute('aria-invalid', 'true')
  })

  it('should switch to revenue and offer only revenue categories', async () => {
    mockWrites()
    const { sheet } = await openLaunch('/?lancar=1')

    await userEvent.click(within(sheet).getByRole('radio', { name: 'Receita' }))
    await userEvent.click(within(sheet).getByRole('combobox', { name: 'Categoria (opcional)' }))
    expect(await screen.findByRole('option', { name: 'Salário' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Mercado' })).not.toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(within(sheet).getByRole('switch', { name: 'Ainda não recebi' })).toBeInTheDocument()
  })
})
