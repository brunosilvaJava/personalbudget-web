import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import type {
  CardPurchaseBatchLineResponse,
  CardPurchaseBatchRequest,
  CardPurchaseBatchStatus,
} from '@/api/contracts'
import { mockCommonApi } from '@/test/api'
import { accounts, cards, holders, plastics } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

const CARD = cards.nubank.code

const NUBANK = [
  'date,title,amount',
  '2026-11-09,Posto Exemplo,"50,00"',
  '2026-11-06,Pagamento recebido,"- 4.664,49"',
  '2026-10-30,Loja Um - Parcela 2/3,"150,00"',
].join('\n')

const C6 = [
  'Data de Compra,Nome no Cartão,Final do Cartão,Categoria,Descrição,Parcela,Valor (em US$),Cotação (em R$),Valor (em R$),',
  '12/09/2026,TITULAR TESTE,3578,Supermercados,MERCADO ALFA,Única,0,0,160.00,',
  '18/09/2026,OUTRA PESSOA,3202,Serviços,APP GAMA,Única,0,0,5.50,',
].join('\r\n')

/** The invoice each purchase date falls in, as the back-end would answer it. */
const INVOICE_OF: Record<string, string> = {
  '2026-11-09': '2026-11',
  '2026-10-30': '2026-12',
  '2026-09-30': '2026-11',
}

function line(
  status: CardPurchaseBatchStatus,
  date: string,
  errors: Record<string, string> = {},
): CardPurchaseBatchLineResponse {
  return {
    status,
    errors,
    import_key: `key-${date}`,
    invoice_reference_month: INVOICE_OF[date] ?? '2026-11',
    due_date: '2026-12-10',
    holder_code: null,
    third_party_code: null,
    matches: [],
  }
}

function mockApi(options: { statusOf?: (description: string) => CardPurchaseBatchStatus } = {}) {
  const calls = {
    dryRuns: [] as CardPurchaseBatchRequest[],
    imports: [] as CardPurchaseBatchRequest[],
  }
  mockCommonApi({
    accounts: [accounts.main],
    cards: [cards.nubank],
    holders: [holders.titular, holders.marcia],
    plastics: [plastics.main],
  })
  server.use(
    http.get('/api/credit_card/:code', () => HttpResponse.json(cards.nubank)),
    http.post('/api/card_purchase/batch', async ({ request }) => {
      const body = (await request.json()) as CardPurchaseBatchRequest
      ;(body.dry_run ? calls.dryRuns : calls.imports).push(body)
      return HttpResponse.json(
        body.items.map((item) =>
          line(options.statusOf?.(item.description) ?? 'NEW', item.purchase_date),
        ),
        { status: body.dry_run ? 200 : 201 },
      )
    }),
  )
  return calls
}

async function open(csv: string) {
  renderApp(`/carteira/cartoes/${CARD}/importar`)
  const input = await screen.findByLabelText(/Arquivo da fatura/)
  await userEvent.upload(input, new File([csv], 'fatura.csv', { type: 'text/csv' }))
}

describe('Importar fatura', () => {
  it('should list the purchases, leave the payment out and import what was checked', async () => {
    const calls = mockApi()
    await open(NUBANK)

    const posto = (await screen.findByText('Posto Exemplo')).closest('li')!
    expect(within(posto).getByText('nova')).toBeInTheDocument()
    expect(screen.getByText('Loja Um')).toBeInTheDocument()
    const skipped = screen.getByRole('region', { name: 'Linhas que não entram' })
    expect(within(skipped).getByText('Pagamento recebido')).toBeInTheDocument()

    const button = await screen.findByRole('button', { name: 'Importar 2 compras' })
    await waitFor(() => expect(button).toBeEnabled())
    await userEvent.click(button)

    expect(await screen.findByText(/2 compras lançadas em Nubank/)).toBeInTheDocument()
    expect(calls.imports).toHaveLength(1)
    expect(calls.imports[0]).toMatchObject({ credit_card_code: CARD, dry_run: false })
    expect(calls.imports[0]!.items.map((item) => item.description)).toEqual([
      'Posto Exemplo',
      'Loja Um',
    ])
    expect(calls.imports[0]!.items[1]).toMatchObject({ installments: 3, first_installment: 2 })
  })

  it('should hold a possible duplicate until it is accepted', async () => {
    const calls = mockApi({
      statusOf: (description) => (description === 'Posto Exemplo' ? 'POSSIBLE_DUPLICATE' : 'NEW'),
    })
    await open(NUBANK)

    expect(await screen.findByText(/1 compra parecida com outra já lançada/)).toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'Importar 2 compras' })
    expect(button).toBeDisabled()

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Importar mesmo assim Posto Exemplo' }),
    )
    await waitFor(() => expect(button).toBeEnabled())
    await userEvent.click(button)

    await screen.findByText(/lançadas?/)
    expect(calls.imports[0]!.items[0]).toMatchObject({ accept_duplicate: true })
  })

  it('should warn when an installment falls in another invoice and offer to move its date', async () => {
    const calls = mockApi()
    await open(NUBANK)

    const loja = (await screen.findByText('Loja Um')).closest('li')!
    expect(await within(loja).findByText(/Cai na fatura de dez/)).toBeInTheDocument()
    await userEvent.click(
      within(loja).getByRole('button', { name: 'Tratar a data como a da parcela' }),
    )

    await waitFor(() =>
      expect(within(loja).queryByText(/Cai na fatura de/)).not.toBeInTheDocument(),
    )
    expect(within(loja).getByText(/Data movida 1 mês para trás/)).toBeInTheDocument()
    const last = calls.dryRuns.at(-1)!
    expect(last.items.find((item) => item.description === 'Loja Um')!.purchase_date).toBe(
      '2026-09-30',
    )
  })

  it('should not let a line in error through', async () => {
    mockApi({ statusOf: (description) => (description === 'Loja Um' ? 'ERROR' : 'NEW') })
    await open(NUBANK)

    expect(await screen.findByText(/1 compra com erro/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importar 2 compras' })).toBeDisabled()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Importar Loja Um' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Importar 1 compra' })).toBeEnabled(),
    )
  })

  it('should ask for the plastics the card does not have before importing', async () => {
    mockApi()
    await open(C6)

    expect(
      await screen.findByText('Cadastre os plásticos novos antes de importar.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importar 2 compras' })).toBeDisabled()
  })

  it('should say so when the file is not a statement', async () => {
    mockApi()
    await open('isto,não,é\numa,fatura,xyz')

    expect(await screen.findByText(/Não reconheci o arquivo/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Importar \d/ })).not.toBeInTheDocument()
  })
})
