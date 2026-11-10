import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '@/test/server'
import { importPurchases } from './creditCards'
import {
  createHolder,
  createPlastic,
  listHolders,
  setHolderActive,
  updatePlastic,
} from './creditCardHolders'
import {
  listThirdParties,
  receive,
  setThirdPartyActive,
  updateReceivableDueDate,
  writeOffReceivable,
} from './thirdParties'

const CARD = 'card-1'

describe('credit card holders and plastics', () => {
  it('should list, create and toggle holders under the card', async () => {
    const calls: string[] = []
    server.use(
      http.get(`/api/credit_card/${CARD}/holder`, () => {
        calls.push('GET holder')
        return HttpResponse.json([])
      }),
      http.post(`/api/credit_card/${CARD}/holder`, async ({ request }) => {
        calls.push(`POST holder ${JSON.stringify(await request.json())}`)
        return HttpResponse.json({}, { status: 201 })
      }),
      http.patch(`/api/credit_card/${CARD}/holder/h1/inactivate`, () => {
        calls.push('PATCH inactivate')
        return HttpResponse.json({})
      }),
      http.patch(`/api/credit_card/${CARD}/holder/h1/activate`, () => {
        calls.push('PATCH activate')
        return HttpResponse.json({})
      }),
    )

    await listHolders(CARD)
    await createHolder(CARD, { name: 'Márcia' })
    await setHolderActive(CARD, 'h1', false)
    await setHolderActive(CARD, 'h1', true)

    expect(calls).toEqual([
      'GET holder',
      'POST holder {"name":"Márcia"}',
      'PATCH inactivate',
      'PATCH activate',
    ])
  })

  it('should send the plastic bodies in snake_case', async () => {
    const bodies: unknown[] = []
    server.use(
      http.post(`/api/credit_card/${CARD}/plastic`, async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({}, { status: 201 })
      }),
      http.patch(`/api/credit_card/${CARD}/plastic/p1`, async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({})
      }),
    )

    await createPlastic(CARD, { holder_code: 'h1', last_digits: '3202' })
    await updatePlastic(CARD, 'p1', { clear_default_third_party: true })

    expect(bodies).toEqual([
      { holder_code: 'h1', last_digits: '3202' },
      { clear_default_third_party: true },
    ])
  })
})

describe('third parties and receivables', () => {
  it('should repeat the status param when listing', async () => {
    let search = ''
    server.use(
      http.get('/api/third_party', ({ request }) => {
        search = new URL(request.url).search
        return HttpResponse.json([])
      }),
    )

    await listThirdParties({ status: ['ACTIVE', 'INACTIVE'] })

    expect(search).toBe('?status=ACTIVE&status=INACTIVE')
  })

  it('should call activate and inactivate', async () => {
    const calls: string[] = []
    server.use(
      http.patch('/api/third_party/t1/:action', ({ params }) => {
        calls.push(String(params.action))
        return HttpResponse.json({})
      }),
    )

    await setThirdPartyActive('t1', false)
    await setThirdPartyActive('t1', true)

    expect(calls).toEqual(['inactivate', 'activate'])
  })

  it('should post a receipt, change a due date and write off under the third party', async () => {
    const calls: string[] = []
    server.use(
      http.post('/api/third_party/t1/receipts', async ({ request }) => {
        calls.push(`receipts ${JSON.stringify(await request.json())}`)
        return HttpResponse.json([])
      }),
      http.patch('/api/third_party/t1/receivables/r1', async ({ request }) => {
        calls.push(`due ${JSON.stringify(await request.json())}`)
        return HttpResponse.json({})
      }),
      http.post('/api/third_party/t1/receivables/r1/write_off', async ({ request }) => {
        calls.push(`write_off ${JSON.stringify(await request.json())}`)
        return HttpResponse.json({})
      }),
    )

    await receive('t1', { amount: 150, effective_date: '2026-11-10' })
    await updateReceivableDueDate('t1', 'r1', { due_date: '2026-12-10' })
    await writeOffReceivable('t1', 'r1', { effective_date: '2026-11-10' })

    expect(calls).toEqual([
      'receipts {"amount":150,"effective_date":"2026-11-10"}',
      'due {"due_date":"2026-12-10"}',
      'write_off {"effective_date":"2026-11-10"}',
    ])
  })
})

describe('importPurchases', () => {
  it('should post the batch to /card_purchase/batch', async () => {
    let body: unknown
    server.use(
      http.post('/api/card_purchase/batch', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json([])
      }),
    )

    await importPurchases({
      credit_card_code: CARD,
      dry_run: true,
      items: [
        {
          description: 'Geladeira',
          purchase_date: '2026-10-05',
          installments: 10,
          first_installment: 3,
          installment_amount: 100,
        },
      ],
    })

    expect(body).toMatchObject({ credit_card_code: CARD, dry_run: true })
  })
})
