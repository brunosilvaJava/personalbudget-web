import { http, HttpResponse } from 'msw'

import type {
  AccountResponse,
  CategoryGroupResponse,
  CategoryResponse,
  CreditCardResponse,
  PayCycleConfigResponse,
  PayCycleResponse,
} from '@/api/contracts'
import { accounts, allCategories, groups, payCycleConfig } from './fixtures'
import { server } from './server'

/**
 * Handlers most screens need: health, categories, accounts (only the default one), cards (none) and
 * the current cycle (none) and the cycle configuration (off). Tests that need more override them with server.use.
 */
export function mockCommonApi(
  options: {
    categories?: CategoryResponse[]
    groups?: CategoryGroupResponse[]
    currentCycle?: PayCycleResponse | null
    payCycleConfig?: PayCycleConfigResponse
    accounts?: AccountResponse[]
    cards?: CreditCardResponse[]
  } = {},
) {
  server.use(
    http.get('/api/actuator/health', () => HttpResponse.json({ status: 'UP' })),
    http.get('/api/category', () => HttpResponse.json(options.categories ?? allCategories)),
    http.get('/api/category_group', () => HttpResponse.json(options.groups ?? groups)),
    http.get('/api/account', ({ request }) => {
      const statuses = new URL(request.url).searchParams.getAll('status')
      const list = options.accounts ?? [accounts.main]
      return HttpResponse.json(
        list.filter((account) =>
          (statuses.length ? statuses : ['ACTIVE']).includes(account.status),
        ),
      )
    }),
    http.get('/api/credit_card', ({ request }) => {
      const statuses = new URL(request.url).searchParams.getAll('status')
      const list = options.cards ?? []
      return HttpResponse.json(
        list.filter((card) => (statuses.length ? statuses : ['ACTIVE']).includes(card.status)),
      )
    }),
    http.get('/api/pay_cycle_config', () =>
      HttpResponse.json(options.payCycleConfig ?? payCycleConfig()),
    ),
    http.get('/api/pay_cycle/current', () =>
      options.currentCycle
        ? HttpResponse.json(options.currentCycle)
        : HttpResponse.json(
            { message: 'Nenhum ciclo contém a data de hoje', pending: [] },
            { status: 404 },
          ),
    ),
  )
}
