import { http, HttpResponse } from 'msw'

import type { CategoryGroupResponse, CategoryResponse, PayCycleResponse } from '@/api/contracts'
import { allCategories, groups } from './fixtures'
import { server } from './server'

/** Handlers most screens need: health, categories and the current cycle (none by default). */
export function mockCommonApi(
  options: {
    categories?: CategoryResponse[]
    groups?: CategoryGroupResponse[]
    currentCycle?: PayCycleResponse | null
  } = {},
) {
  server.use(
    http.get('/api/actuator/health', () => HttpResponse.json({ status: 'UP' })),
    http.get('/api/category', () => HttpResponse.json(options.categories ?? allCategories)),
    http.get('/api/category_group', () => HttpResponse.json(options.groups ?? groups)),
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
