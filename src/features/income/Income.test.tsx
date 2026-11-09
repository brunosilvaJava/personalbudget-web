import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  HolidayCalendarPreviewResponse,
  HolidayYearRequest,
  HolidayYearResponse,
  IncomeOccurrenceResponse,
  IncomeScheduleRequest,
  IncomeScheduleResponse,
  IncomeScheduleUpdateRequest,
} from '@/api/contracts'
import { mockCommonApi } from '@/test/api'
import { holidayYear, incomeSchedule, occurrence, page } from '@/test/fixtures'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

interface IncomeMocks {
  schedules?: IncomeScheduleResponse[]
  occurrences?: IncomeOccurrenceResponse[]
  years?: HolidayYearResponse[]
  preview?: HolidayCalendarPreviewResponse
}

const EMPTY_PREVIEW: HolidayCalendarPreviewResponse = {
  income_occurrences: [],
  cycle_boundaries: [],
  cycle_divergences: [],
}

function mockIncome(options: IncomeMocks = {}) {
  const schedules = options.schedules ?? []
  const years = options.years ?? []
  const calls = {
    scheduleLists: [] as string[][],
    occurrenceQueries: [] as string[],
    created: [] as IncomeScheduleRequest[],
    patched: [] as IncomeScheduleUpdateRequest[],
    activated: [] as string[],
    inactivated: [] as string[],
    materialized: [] as string[],
    previewed: [] as { year: string; body: HolidayYearRequest }[],
    saved: [] as { year: string; body: HolidayYearRequest }[],
  }
  server.use(
    // The form offers the active CREDIT fixed bills to replace.
    http.get('/api/fixed_bill', () => HttpResponse.json(page([]))),
    http.get('/api/income_schedule', ({ request }) => {
      const statuses = new URL(request.url).searchParams.getAll('status')
      calls.scheduleLists.push(statuses)
      return HttpResponse.json(
        schedules.filter((item) => (statuses.length ? statuses : ['ACTIVE']).includes(item.status)),
      )
    }),
    http.post('/api/income_schedule', async ({ request }) => {
      const body = (await request.json()) as IncomeScheduleRequest
      calls.created.push(body)
      const created = incomeSchedule({
        code: 'new-schedule',
        description: body.description,
        amount: body.amount,
      })
      schedules.push(created)
      return HttpResponse.json(created, { status: 201 })
    }),
    http.get('/api/income_schedule/:code', ({ params }) => {
      const found = schedules.find((item) => item.code === params.code)
      return found
        ? HttpResponse.json(found)
        : HttpResponse.json({ message: 'Registro não encontrado' }, { status: 404 })
    }),
    http.patch('/api/income_schedule/:code/inactivate', ({ params }) => {
      calls.inactivated.push(String(params.code))
      return HttpResponse.json({ ...schedules[0], status: 'INACTIVE' })
    }),
    http.patch('/api/income_schedule/:code/activate', ({ params }) => {
      calls.activated.push(String(params.code))
      return HttpResponse.json({ ...schedules[0], status: 'ACTIVE' })
    }),
    http.patch('/api/income_schedule/:code', async ({ request }) => {
      calls.patched.push((await request.json()) as IncomeScheduleUpdateRequest)
      return HttpResponse.json(schedules[0])
    }),
    http.get('/api/income_schedule/:code/occurrence', ({ request }) => {
      calls.occurrenceQueries.push(new URL(request.url).searchParams.toString())
      return HttpResponse.json(options.occurrences ?? [])
    }),
    http.post('/api/income_schedule/:code/occurrence/:month/materialize', ({ params }) => {
      calls.materialized.push(String(params.month))
      return HttpResponse.json(
        occurrence({ nominal_month: String(params.month), state: 'MATERIALIZED' }),
        { status: 201 },
      )
    }),
    http.get('/api/holiday_calendar', () =>
      HttpResponse.json(years.filter((item) => item.reviewed)),
    ),
    http.get('/api/holiday_calendar/:year', ({ params }) => {
      const year = Number(params.year)
      return HttpResponse.json(
        years.find((item) => item.year === year) ?? holidayYear(year, { reviewed: false }),
      )
    }),
    http.post('/api/holiday_calendar/:year/preview', async ({ request, params }) => {
      calls.previewed.push({
        year: String(params.year),
        body: (await request.json()) as HolidayYearRequest,
      })
      return HttpResponse.json(options.preview ?? EMPTY_PREVIEW)
    }),
    http.put('/api/holiday_calendar/:year', async ({ request, params }) => {
      const body = (await request.json()) as HolidayYearRequest
      calls.saved.push({ year: String(params.year), body })
      return HttpResponse.json(holidayYear(Number(params.year), body))
    }),
  )
  return calls
}

describe('Receita', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T15:00:00Z'))
    mockCommonApi()
  })
  afterEach(() => vi.useRealTimers())

  describe('Agenda', () => {
    it('should list the active schedules with the rule, the validity and the anchor badge', async () => {
      mockIncome({
        schedules: [
          incomeSchedule({ description: 'Salário', anchor: true }),
          incomeSchedule({
            description: 'Freela mensal',
            amount: 800,
            rule_type: 'NTH_BUSINESS_DAY',
            rule_value: 3,
            non_business_day_policy: null,
            end_month: '2027-03',
          }),
          incomeSchedule({ description: 'Aluguel recebido', status: 'INACTIVE' }),
        ],
      })
      renderApp('/receita')

      const salary = await screen.findByRole('link', { name: /Salário/ })
      expect(within(salary).getByText('âncora')).toBeInTheDocument()
      expect(
        within(salary).getByText('Dia 5 de cada mês, antecipada se não for dia útil'),
      ).toBeInTheDocument()
      expect(within(salary).getByText('desde jan/2026, sem fim')).toBeInTheDocument()
      expect(within(salary).getByText(/R\$\s6\.850,00/)).toBeInTheDocument()

      const freela = screen.getByRole('link', { name: /Freela mensal/ })
      expect(within(freela).getByText('3º dia útil do mês')).toBeInTheDocument()
      expect(within(freela).getByText('de jan/2026 a mar/2027')).toBeInTheDocument()
      expect(screen.queryByText('Aluguel recebido')).not.toBeInTheDocument()
    })

    it('should ask for the inactive ones on the other filter, and show an empty state', async () => {
      const calls = mockIncome({ schedules: [incomeSchedule()] })
      renderApp('/receita/agenda')

      await screen.findByText('Salário')
      await userEvent.click(screen.getByRole('radio', { name: 'Inativas' }))

      expect(await screen.findByText('Nenhuma receita inativa')).toBeInTheDocument()
      expect(calls.scheduleLists).toContainEqual(['INACTIVE'])
    })

    it('should create a fixed-day schedule with the policy, and open it', async () => {
      const calls = mockIncome()
      renderApp('/receita/agenda')

      await userEvent.click(await screen.findByRole('button', { name: 'Nova receita' }))
      const sheet = await screen.findByRole('dialog', { name: 'Nova receita' })
      await userEvent.type(within(sheet).getByLabelText('Descrição'), 'Salário')
      await userEvent.type(within(sheet).getByLabelText('Valor'), '6.850,00')
      await userEvent.type(within(sheet).getByLabelText('Dia do mês'), '5')
      await userEvent.click(within(sheet).getByRole('radio', { name: 'Adiar' }))
      expect(
        within(sheet).getByText('Se o dia não for útil, a receita cai no próximo dia útil.'),
      ).toBeInTheDocument()
      await userEvent.click(within(sheet).getByRole('button', { name: 'Criar receita' }))

      await waitFor(() =>
        expect(calls.created).toEqual([
          {
            description: 'Salário',
            amount: 6850,
            rule_type: 'FIXED_DAY',
            rule_value: 5,
            business_week: 'MONDAY_TO_FRIDAY',
            non_business_day_policy: 'POSTPONE',
            start_month: '2026-11',
          },
        ]),
      )
      expect(await screen.findByText('Receita “Salário” criada.')).toBeInTheDocument()
      expect(await screen.findByRole('heading', { name: 'Salário', level: 1 })).toBeInTheDocument()
    })

    it('should send the N-th business day without a policy, with the anchor and the Saturday week', async () => {
      const calls = mockIncome()
      renderApp('/receita/agenda')

      await userEvent.click(await screen.findByRole('button', { name: 'Nova receita' }))
      const sheet = await screen.findByRole('dialog', { name: 'Nova receita' })
      await userEvent.type(within(sheet).getByLabelText('Descrição'), 'Salário')
      await userEvent.type(within(sheet).getByLabelText('Valor'), '5000')
      await userEvent.click(within(sheet).getByRole('radio', { name: 'Dia útil' }))
      expect(within(sheet).queryByRole('radio', { name: 'Adiar' })).not.toBeInTheDocument()
      await userEvent.type(within(sheet).getByLabelText('Qual dia útil'), '5')
      await userEvent.click(within(sheet).getByRole('radio', { name: 'Segunda a sábado' }))
      await userEvent.click(
        within(sheet).getByRole('switch', { name: /Abre os ciclos financeiros/ }),
      )
      fireEvent.change(within(sheet).getByLabelText('Termina em'), {
        target: { value: '2027-03' },
      })
      await userEvent.click(within(sheet).getByRole('button', { name: 'Criar receita' }))

      await waitFor(() =>
        expect(calls.created).toEqual([
          {
            description: 'Salário',
            amount: 5000,
            rule_type: 'NTH_BUSINESS_DAY',
            rule_value: 5,
            business_week: 'MONDAY_TO_SATURDAY',
            start_month: '2026-11',
            end_month: '2027-03',
            anchor: true,
          },
        ]),
      )
    })

    it('should refuse a start before the current month without calling the API', async () => {
      const calls = mockIncome()
      renderApp('/receita/agenda')

      await userEvent.click(await screen.findByRole('button', { name: 'Nova receita' }))
      const sheet = await screen.findByRole('dialog', { name: 'Nova receita' })
      await userEvent.type(within(sheet).getByLabelText('Descrição'), 'Salário')
      await userEvent.type(within(sheet).getByLabelText('Valor'), '5000')
      await userEvent.type(within(sheet).getByLabelText('Dia do mês'), '5')
      fireEvent.change(within(sheet).getByLabelText('Começa em'), { target: { value: '2026-10' } })
      await userEvent.click(within(sheet).getByRole('button', { name: 'Criar receita' }))

      expect(await within(sheet).findByText(/O início não pode ser antes deste mês/)).toBeVisible()
      expect(calls.created).toEqual([])
    })

    it('should put the 400 of the back on the field it names', async () => {
      mockIncome()
      server.use(
        http.post('/api/income_schedule', () =>
          HttpResponse.json(
            {
              message: 'Dados inválidos',
              validations: { rule_value: 'O mês de fevereiro não tem esse dia útil.' },
            },
            { status: 400 },
          ),
        ),
      )
      renderApp('/receita/agenda')

      await userEvent.click(await screen.findByRole('button', { name: 'Nova receita' }))
      const sheet = await screen.findByRole('dialog', { name: 'Nova receita' })
      await userEvent.type(within(sheet).getByLabelText('Descrição'), 'Salário')
      await userEvent.type(within(sheet).getByLabelText('Valor'), '5000')
      await userEvent.type(within(sheet).getByLabelText('Dia do mês'), '5')
      await userEvent.click(within(sheet).getByRole('button', { name: 'Criar receita' }))

      expect(
        await within(sheet).findByText('O mês de fevereiro não tem esse dia útil.'),
      ).toBeVisible()
    })
  })

  describe('Uma receita', () => {
    const schedule = incomeSchedule({
      code: 's-1',
      end_month: '2027-03',
      category_code: null,
      anchor: true,
    })

    it('should edit sending only what changed, and remove the end', async () => {
      const calls = mockIncome({ schedules: [schedule] })
      renderApp('/receita/agenda/s-1')

      await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
      const sheet = await screen.findByRole('dialog', { name: 'Editar receita' })
      expect(within(sheet).getByText('jan/2026')).toBeInTheDocument()
      await userEvent.clear(within(sheet).getByLabelText('Valor'))
      await userEvent.type(within(sheet).getByLabelText('Valor'), '7000')
      fireEvent.change(within(sheet).getByLabelText('Termina em'), { target: { value: '' } })
      await userEvent.click(within(sheet).getByRole('button', { name: 'Salvar' }))

      await waitFor(() => expect(calls.patched).toEqual([{ amount: 7000, remove_end_month: true }]))
      expect(await screen.findByText(/Receita atualizada/)).toBeInTheDocument()
    })

    it('should show the message of the 409 that protects the anchor schedule', async () => {
      mockIncome({ schedules: [schedule] })
      server.use(
        http.patch('/api/income_schedule/:code', () =>
          HttpResponse.json(
            { message: 'A receita âncora só muda pela transição de âncora.' },
            { status: 409 },
          ),
        ),
      )
      renderApp('/receita/agenda/s-1')

      await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
      const sheet = await screen.findByRole('dialog', { name: 'Editar receita' })
      await userEvent.clear(within(sheet).getByLabelText('Dia do mês'))
      await userEvent.type(within(sheet).getByLabelText('Dia do mês'), '10')
      await userEvent.click(within(sheet).getByRole('button', { name: 'Salvar' }))

      expect(
        await within(sheet).findByText('A receita âncora só muda pela transição de âncora.'),
      ).toBeVisible()
    })

    it('should inactivate only after confirming', async () => {
      const calls = mockIncome({ schedules: [schedule] })
      renderApp('/receita/agenda/s-1')

      await userEvent.click(await screen.findByRole('button', { name: 'Inativar' }))
      const dialog = await screen.findByRole('alertdialog', { name: 'Inativar receita?' })
      expect(calls.inactivated).toEqual([])
      await userEvent.click(within(dialog).getByRole('button', { name: 'Inativar' }))

      await waitFor(() => expect(calls.inactivated).toEqual(['s-1']))
      expect(await screen.findByText('Receita inativada.')).toBeInTheDocument()
    })

    it('should show the 409 when the anchor cannot be inactivated', async () => {
      mockIncome({ schedules: [schedule] })
      server.use(
        http.patch('/api/income_schedule/:code/inactivate', () =>
          HttpResponse.json(
            { message: 'A receita âncora não pode ser inativada com os ciclos ligados.' },
            { status: 409 },
          ),
        ),
      )
      renderApp('/receita/agenda/s-1')

      await userEvent.click(await screen.findByRole('button', { name: 'Inativar' }))
      const dialog = await screen.findByRole('alertdialog', { name: 'Inativar receita?' })
      await userEvent.click(within(dialog).getByRole('button', { name: 'Inativar' }))

      expect(
        await screen.findByText('A receita âncora não pode ser inativada com os ciclos ligados.'),
      ).toBeVisible()
    })

    it('should activate an inactive schedule without asking', async () => {
      const calls = mockIncome({ schedules: [{ ...schedule, status: 'INACTIVE' }] })
      renderApp('/receita/agenda/s-1')

      await userEvent.click(await screen.findByRole('button', { name: 'Ativar' }))
      await waitFor(() => expect(calls.activated).toEqual(['s-1']))
    })

    it('should say the schedule was not found for a stale link', async () => {
      mockIncome({ schedules: [] })
      renderApp('/receita/agenda/inexistente')

      expect(await screen.findByText('Este registro não existe mais')).toBeInTheDocument()
    })
  })

  describe('Ocorrências', () => {
    const occurrences = [
      occurrence({ nominal_month: '2026-11', state: 'MATERIALIZED', movement_code: 'm1' }),
      occurrence({ nominal_month: '2026-12', planned_date: '2026-12-04', amount: 6850 }),
      occurrence({ nominal_month: '2027-01', planned_date: '2027-01-05' }),
      occurrence({
        nominal_month: '2027-02',
        state: 'CALENDAR_NOT_REVIEWED',
        planned_date: null,
        amount: null,
        pending_year: 2027,
      }),
      occurrence({
        nominal_month: '2027-03',
        state: 'BUSINESS_DAY_NOT_FOUND',
        planned_date: null,
        amount: null,
      }),
    ]

    it('should show each month with its state and date, and ask for 12 months first', async () => {
      const calls = mockIncome({ schedules: [incomeSchedule({ code: 's-1' })], occurrences })
      renderApp('/receita/agenda/s-1')

      const november = (await screen.findByText('novembro de 2026')).closest('li')!
      expect(within(november).getByText('Lançada')).toBeInTheDocument()
      const december = screen.getByText('dezembro de 2026').closest('li')!
      expect(within(december).getByText('Prevista')).toBeInTheDocument()
      expect(within(december).getByText('04/12/2026')).toBeInTheDocument()
      expect(within(december).getByText(/R\$\s6\.850,00/)).toBeInTheDocument()
      const february = screen.getByText('fevereiro de 2027').closest('li')!
      expect(within(february).getByText('Calendário não revisado')).toBeInTheDocument()
      expect(
        within(february).getByRole('link', { name: 'Revisar o calendário de 2027' }),
      ).toHaveAttribute('href', '/receita/calendario?ano=2027')
      const march = screen.getByText('março de 2027').closest('li')!
      expect(within(march).getByText('o mês não tem esse dia útil')).toBeInTheDocument()
      expect(calls.occurrenceQueries[0]).toBe('from=2026-11&to=2027-10')

      await userEvent.click(screen.getByRole('button', { name: 'Ver mais 12 meses' }))
      await waitFor(() => expect(calls.occurrenceQueries).toContain('from=2026-11&to=2028-10'))
    })

    it('should offer "Lançar agora" only up to next month, and post it after confirming', async () => {
      const calls = mockIncome({ schedules: [incomeSchedule({ code: 's-1' })], occurrences })
      renderApp('/receita/agenda/s-1')

      await screen.findByText('dezembro de 2026')
      // Only December: November is already posted and January is beyond next month.
      expect(screen.getAllByRole('button', { name: 'Lançar agora' })).toHaveLength(1)

      await userEvent.click(screen.getByRole('button', { name: 'Lançar agora' }))
      const dialog = await screen.findByRole('alertdialog', {
        name: 'Lançar esta receita agora?',
      })
      expect(within(dialog).getByText(/dezembro de 2026 entra em Movimentações/)).toBeVisible()
      expect(calls.materialized).toEqual([])
      await userEvent.click(within(dialog).getByRole('button', { name: 'Lançar agora' }))

      await waitFor(() => expect(calls.materialized).toEqual(['2026-12']))
      expect(await screen.findByText('Receita de dezembro de 2026 lançada.')).toBeInTheDocument()
    })

    it('should not offer to post the months of an inactive schedule', async () => {
      mockIncome({ schedules: [incomeSchedule({ code: 's-1', status: 'INACTIVE' })], occurrences })
      renderApp('/receita/agenda/s-1')

      await screen.findByText('dezembro de 2026')
      expect(screen.queryByRole('button', { name: 'Lançar agora' })).not.toBeInTheDocument()
    })

    it('should show the message of the back when it refuses to post', async () => {
      mockIncome({ schedules: [incomeSchedule({ code: 's-1' })], occurrences })
      server.use(
        http.post('/api/income_schedule/:code/occurrence/:month/materialize', () =>
          HttpResponse.json({ message: 'Esta receita já foi lançada.' }, { status: 409 }),
        ),
      )
      renderApp('/receita/agenda/s-1')

      await userEvent.click(await screen.findByRole('button', { name: 'Lançar agora' }))
      const dialog = await screen.findByRole('alertdialog')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Lançar agora' }))

      expect(await screen.findByText('Esta receita já foi lançada.')).toBeVisible()
    })
  })

  describe('Calendário', () => {
    it('should warn that a year was not reviewed, and say nothing is assumed', async () => {
      mockIncome({
        years: [holidayYear(2026, { holidays: [{ date: '2026-12-25', name: 'Natal' }] })],
      })
      renderApp('/receita/calendario?ano=2027')

      expect(await screen.findByText('O calendário de 2027 não foi revisado')).toBeInTheDocument()
      expect(screen.getByText('não revisado')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Revisar 2027' })).toBeInTheDocument()
      expect(screen.getByText('Anos revisados: 2026.')).toBeInTheDocument()
    })

    it('should list the holidays of a reviewed year and move between years', async () => {
      mockIncome({
        years: [
          holidayYear(2026, {
            holidays: [
              { date: '2026-11-15', name: 'Proclamação da República' },
              { date: '2026-12-25', name: 'Natal' },
            ],
          }),
        ],
      })
      renderApp('/receita/calendario')

      expect(await screen.findByText('Proclamação da República')).toBeInTheDocument()
      expect(screen.getByText('Natal')).toBeInTheDocument()
      expect(screen.getByText('revisado')).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Próximo ano' }))
      expect(await screen.findByText('O calendário de 2027 não foi revisado')).toBeInTheDocument()
    })

    it('should review a year: edit the list, see what changes, then save it ordered by date', async () => {
      const calls = mockIncome({
        years: [],
        preview: {
          income_occurrences: [
            {
              schedule_code: 's-1',
              schedule_description: 'Salário',
              nominal_month: '2027-01',
              before: occurrence({
                nominal_month: '2027-01',
                state: 'CALENDAR_NOT_REVIEWED',
                planned_date: null,
                amount: null,
                pending_year: 2027,
              }),
              after: occurrence({ nominal_month: '2027-01', planned_date: '2027-01-05' }),
            },
          ],
          cycle_boundaries: [
            {
              previous_cycle_code: 'c-1',
              next_cycle_code: 'c-2',
              old_boundary: '2027-01-05',
              new_boundary: '2027-01-04',
            },
          ],
          cycle_divergences: [],
        },
      })
      renderApp('/receita/calendario?ano=2027')

      await userEvent.click(await screen.findByRole('button', { name: 'Revisar 2027' }))
      const sheet = await screen.findByRole('dialog', { name: 'Revisar 2027' })
      await userEvent.click(within(sheet).getByRole('button', { name: 'Adicionar feriado' }))
      await userEvent.click(within(sheet).getByRole('button', { name: 'Adicionar feriado' }))
      fireEvent.change(within(sheet).getByLabelText('Data do feriado 1'), {
        target: { value: '2027-12-25' },
      })
      await userEvent.type(within(sheet).getByLabelText('Nome do feriado 1'), 'Natal')
      fireEvent.change(within(sheet).getByLabelText('Data do feriado 2'), {
        target: { value: '2027-01-01' },
      })
      await userEvent.type(within(sheet).getByLabelText('Nome do feriado 2'), 'Ano Novo')
      await userEvent.click(within(sheet).getByRole('button', { name: 'Ver o que muda' }))

      expect(await within(sheet).findByText('Gravar 2027 com 2 feriados.')).toBeVisible()
      expect(calls.previewed).toEqual([
        {
          year: '2027',
          body: {
            holidays: [
              { date: '2027-01-01', name: 'Ano Novo' },
              { date: '2027-12-25', name: 'Natal' },
            ],
          },
        },
      ])
      expect(within(sheet).getByText(/Salário ·/)).toBeInTheDocument()
      expect(within(sheet).getByText('05/01/2027 → 04/01/2027')).toBeInTheDocument()
      expect(calls.saved).toEqual([])

      await userEvent.click(within(sheet).getByRole('button', { name: 'Gravar revisão' }))

      await waitFor(() =>
        expect(calls.saved).toEqual([
          {
            year: '2027',
            body: {
              holidays: [
                { date: '2027-01-01', name: 'Ano Novo' },
                { date: '2027-12-25', name: 'Natal' },
              ],
            },
          },
        ]),
      )
      expect(await screen.findByText('Calendário de 2027 revisado.')).toBeInTheDocument()
    })

    it('should save an empty list to mark the year as reviewed, and say when nothing changes', async () => {
      const calls = mockIncome({ years: [] })
      renderApp('/receita/calendario?ano=2027')

      await userEvent.click(await screen.findByRole('button', { name: 'Revisar 2027' }))
      const sheet = await screen.findByRole('dialog', { name: 'Revisar 2027' })
      expect(within(sheet).getByText(/Gravar assim marca 2027 como revisado/)).toBeVisible()
      await userEvent.click(within(sheet).getByRole('button', { name: 'Ver o que muda' }))

      expect(await within(sheet).findByText('Gravar 2027 sem feriados.')).toBeVisible()
      expect(
        within(sheet).getByText('Nenhuma data de receita nem virada de ciclo muda.'),
      ).toBeVisible()
      await userEvent.click(within(sheet).getByRole('button', { name: 'Gravar revisão' }))

      await waitFor(() => expect(calls.saved).toEqual([{ year: '2027', body: { holidays: [] } }]))
    })

    it('should refuse a date of another year and a duplicated date, without calling the API', async () => {
      const calls = mockIncome({
        years: [holidayYear(2027, { holidays: [{ date: '2027-12-25', name: 'Natal' }] })],
      })
      renderApp('/receita/calendario?ano=2027')

      await userEvent.click(await screen.findByRole('button', { name: 'Editar feriados' }))
      const sheet = await screen.findByRole('dialog', { name: 'Editar feriados de 2027' })
      await userEvent.click(within(sheet).getByRole('button', { name: 'Adicionar feriado' }))
      fireEvent.change(within(sheet).getByLabelText('Data do feriado 2'), {
        target: { value: '2027-12-25' },
      })
      await userEvent.type(within(sheet).getByLabelText('Nome do feriado 2'), 'Natal de novo')
      await userEvent.click(within(sheet).getByRole('button', { name: 'Ver o que muda' }))

      expect(await within(sheet).findByText('Já há um feriado nesta data.')).toBeVisible()
      expect(calls.previewed).toEqual([])
    })

    it('should go back from the impact to edit and preview again', async () => {
      const calls = mockIncome({
        years: [holidayYear(2027, { holidays: [{ date: '2027-12-25', name: 'Natal' }] })],
      })
      renderApp('/receita/calendario?ano=2027')

      await userEvent.click(await screen.findByRole('button', { name: 'Editar feriados' }))
      const sheet = await screen.findByRole('dialog', { name: 'Editar feriados de 2027' })
      await userEvent.click(within(sheet).getByRole('button', { name: 'Ver o que muda' }))
      await within(sheet).findByText('Gravar 2027 com 1 feriado.')
      await userEvent.click(within(sheet).getByRole('button', { name: 'Voltar e editar' }))

      await userEvent.click(within(sheet).getByRole('button', { name: 'Remover feriado 1' }))
      await userEvent.click(within(sheet).getByRole('button', { name: 'Ver o que muda' }))

      expect(await within(sheet).findByText('Gravar 2027 sem feriados.')).toBeVisible()
      expect(calls.previewed.map((item) => item.body.holidays.length)).toEqual([1, 0])
      expect(calls.saved).toEqual([])
    })
  })

  it('should list Receita in Mais', async () => {
    mockIncome()
    renderApp('/mais')

    const others = await screen.findByRole('navigation', { name: 'Outras telas' })
    expect(within(others).getByRole('link', { name: 'Receita' })).toHaveAttribute(
      'href',
      '/receita',
    )
  })
})
