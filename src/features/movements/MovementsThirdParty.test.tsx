import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FinancialMovementResponse } from '@/api/contracts'
import { mockCommonApi } from '@/test/api'
import { movement, page, thirdParties } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

function mockMovements(movements: FinancialMovementResponse[]) {
  const calls: URLSearchParams[] = []
  server.use(
    http.get('/api/financial_movement', ({ request }) => {
      calls.push(new URL(request.url).searchParams)
      return HttpResponse.json(page(movements))
    }),
  )
  return calls
}

describe('Movimentações de terceiros', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T15:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('should mark the movements of a third party and the receivables made from them', async () => {
    mockCommonApi({ thirdParties: [thirdParties.mae] })
    mockMovements([
      movement({
        description: 'Farmácia (1/2)',
        movement_date: '2026-11-10T00:00:00',
        third_party_code: 't-mae',
      }),
      movement({
        description: 'A receber: Farmácia (1/2)',
        operation_type: 'CREDIT',
        movement_date: '2026-11-10T00:00:00',
        third_party_code: 't-mae',
        receivable_source_code: 'm-source',
      }),
      movement({ description: 'Pão', movement_date: '2026-11-10T00:00:00' }),
    ])
    renderApp('/movimentacoes')

    const purchase = (await screen.findByText('Farmácia (1/2)')).closest('button')!
    expect(await within(purchase).findByText('de Mãe')).toBeInTheDocument()
    const receivable = screen.getByText('A receber: Farmácia (1/2)').closest('button')!
    expect(within(receivable).getByText('a receber de Mãe')).toBeInTheDocument()
    const own = screen.getByText('Pão').closest('button')!
    expect(within(own).queryByText(/^de /)).not.toBeInTheDocument()
  })

  it('should filter by third party and by "só meus"', async () => {
    mockCommonApi({ thirdParties: [thirdParties.mae] })
    const calls = mockMovements([movement({ description: 'Pão' })])
    renderApp('/movimentacoes')
    await screen.findByText('Pão')

    await userEvent.click(screen.getByRole('button', { name: 'Filtros' }))
    let sheet = await screen.findByRole('dialog', { name: 'Filtros' })
    await userEvent.click(await within(sheet).findByRole('combobox', { name: 'De quem' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Mãe' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Aplicar' }))

    await waitFor(() => expect(calls.at(-1)?.get('third_party_code')).toBe('t-mae'))
    expect(calls.at(-1)?.has('own_only')).toBe(false)

    await userEvent.click(screen.getByRole('button', { name: /Filtros/ }))
    sheet = await screen.findByRole('dialog', { name: 'Filtros' })
    await userEvent.click(await within(sheet).findByRole('combobox', { name: 'De quem' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Só meus' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Aplicar' }))

    await waitFor(() => expect(calls.at(-1)?.get('own_only')).toBe('true'))
    expect(calls.at(-1)?.has('third_party_code')).toBe(false)
  })

  it('should not offer the filter while there is no third party', async () => {
    mockCommonApi()
    mockMovements([movement({ description: 'Pão' })])
    renderApp('/movimentacoes')
    await screen.findByText('Pão')

    await userEvent.click(screen.getByRole('button', { name: 'Filtros' }))
    const sheet = await screen.findByRole('dialog', { name: 'Filtros' })
    await within(sheet).findByText('Categoria')
    expect(within(sheet).queryByRole('combobox', { name: 'De quem' })).not.toBeInTheDocument()
  })
})
