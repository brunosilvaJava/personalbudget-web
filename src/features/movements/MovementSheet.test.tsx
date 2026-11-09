import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  FinancialMovementResponse,
  FinancialMovementUpdateRequest,
  MovementSettlementResponse,
} from '@/api/contracts'
import { mockCommonApi } from '@/test/api'
import { categories, movement, page } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

function settlement(
  overrides: Partial<MovementSettlementResponse> = {},
): MovementSettlementResponse {
  return {
    code: 's1',
    movement_code: 'm1',
    amount: 900,
    effective_date: '2026-11-05',
    reversed_at: null,
    version: 0,
    account_code: 'a1',
    ...overrides,
  }
}

/** One movement in the list and on GET /financial_movement/{code}; records the writes. */
function mockMovement(
  item: FinancialMovementResponse,
  settlements: MovementSettlementResponse[] = [],
  options: { payAnswer?: Response } = {},
) {
  const calls = {
    paid: [] as unknown[],
    reversed: [] as string[],
    patched: [] as FinancialMovementUpdateRequest[],
    deleted: [] as string[],
  }
  server.use(
    http.get('/api/financial_movement', () => HttpResponse.json(page([item]))),
    http.get('/api/financial_movement/:code', () => HttpResponse.json(item)),
    http.get('/api/financial_movement/:code/settlements', () => HttpResponse.json(settlements)),
    http.post('/api/financial_movement/:code/settlements', async ({ request }) => {
      calls.paid.push(await request.json())
      return options.payAnswer ?? HttpResponse.json(settlement(), { status: 201 })
    }),
    http.post('/api/financial_movement/:code/settlements/:s/reversal', ({ params }) => {
      calls.reversed.push(String(params.s))
      return HttpResponse.json(settlement({ reversed_at: '2026-11-10T12:00:00' }))
    }),
    http.patch('/api/financial_movement/:code', async ({ request }) => {
      const body = (await request.json()) as FinancialMovementUpdateRequest
      calls.patched.push(body)
      return HttpResponse.json({ ...item, ...body })
    }),
    http.delete('/api/financial_movement/:code', ({ params }) => {
      calls.deleted.push(String(params.code))
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return calls
}

async function openMovement(description: string) {
  renderApp('/movimentacoes')
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(description) }))
  return screen.findByRole('dialog', { name: new RegExp(description) })
}

describe('MovementSheet', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T15:00:00Z'))
    mockCommonApi()
  })
  afterEach(() => vi.useRealTimers())

  it('should pay what is still owed, on today by default', async () => {
    const calls = mockMovement(
      movement({ code: 'm1', description: 'Aluguel', amount: 1800, amount_paid: 900 }),
      [settlement()],
    )
    const sheet = await openMovement('Aluguel')

    expect(within(sheet).getByText(/R\$\s900,00 de R\$\s1\.800,00/)).toBeInTheDocument()
    await userEvent.click(within(sheet).getByRole('button', { name: /Pagar R\$\s900,00/ }))
    expect(within(sheet).getByLabelText('Pago em')).toHaveValue('2026-11-10')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Confirmar pagamento' }))

    await waitFor(() => expect(calls.paid).toEqual([{ amount: 900, effective_date: '2026-11-10' }]))
    expect(await screen.findByText('Pagamento registrado.')).toBeInTheDocument()
  })

  it('should show the message of a 409 when paying', async () => {
    mockMovement(movement({ code: 'm1', description: 'Internet' }), [], {
      payAnswer: HttpResponse.json(
        { message: 'O valor ultrapassa o que falta pagar.' },
        { status: 409 },
      ),
    })
    const sheet = await openMovement('Internet')

    await userEvent.click(within(sheet).getByRole('button', { name: /Pagar/ }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Confirmar pagamento' }))
    expect(
      await within(sheet).findByText('O valor ultrapassa o que falta pagar.'),
    ).toBeInTheDocument()
  })

  it('should reverse a settlement after confirming', async () => {
    const calls = mockMovement(
      movement({
        code: 'm1',
        description: 'Farmácia',
        status: 'PAID_OUT',
        amount: 74.5,
        amount_paid: 74.5,
      }),
      [
        settlement({ code: 's-old', amount: 74.5, reversed_at: '2026-11-06T10:00:00' }),
        settlement({ code: 's-new', amount: 74.5, effective_date: '2026-11-07' }),
      ],
    )
    const sheet = await openMovement('Farmácia')

    expect(within(sheet).queryByRole('button', { name: /Pagar/ })).not.toBeInTheDocument()
    expect(await within(sheet).findByText('estornado em 06/11/2026')).toBeInTheDocument()
    const buttons = within(sheet).getAllByRole('button', { name: 'Estornar' })
    expect(buttons).toHaveLength(1)
    await userEvent.click(buttons[0]!)
    const dialog = await screen.findByRole('alertdialog', { name: 'Estornar pagamento?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Estornar' }))

    await waitFor(() => expect(calls.reversed).toEqual(['s-new']))
    expect(await screen.findByText('Estorno registrado.')).toBeInTheDocument()
  })

  it('should delete only after confirming, and close', async () => {
    const calls = mockMovement(movement({ code: 'm1', description: 'Almoço' }))
    const sheet = await openMovement('Almoço')

    await userEvent.click(within(sheet).getByRole('button', { name: 'Excluir' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Excluir movimentação?' })
    expect(calls.deleted).toEqual([])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }))

    await waitFor(() => expect(calls.deleted).toEqual(['m1']))
    expect(await screen.findByText('Movimentação excluída.')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Almoço' })).not.toBeInTheDocument(),
    )
  })

  it('should send only what changed when editing', async () => {
    const calls = mockMovement(
      movement({
        code: 'm1',
        description: 'Mercado',
        amount: 100,
        movement_date: '2026-11-08T18:20:00',
        due_date: '2026-11-08T18:20:00',
        category_code: categories.mercado.code,
        competence_date: '2026-10-31',
        competence_overridden: true,
      }),
    )
    const sheet = await openMovement('Mercado')

    await userEvent.click(within(sheet).getByRole('button', { name: 'Editar' }))
    const description = await within(sheet).findByLabelText('Descrição')
    await userEvent.clear(description)
    await userEvent.type(description, 'Mercado da semana')
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Automática' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(calls.patched).toEqual([
        { description: 'Mercado da semana', restore_automatic_competence: true },
      ]),
    )
    expect(await screen.findByText('Movimentação atualizada.')).toBeInTheDocument()
  })

  it('should not offer pay, edit or delete on a card installment', async () => {
    mockMovement(
      movement({
        code: 'm1',
        description: 'Geladeira (2/10)',
        card_purchase_code: 'p1',
        card_invoice_code: 'i1',
        installment_number: 2,
      }),
    )
    const sheet = await openMovement('Geladeira')

    expect(within(sheet).getByText(/é paga junto com a fatura/)).toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: /Pagar/ })).not.toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument()
  })
})
