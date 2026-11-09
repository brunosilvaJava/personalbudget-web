import { expect, test, type APIRequestContext } from '@playwright/test'

import { apiGet, brDate, shiftDate, todayIso, unique } from './helpers'

interface Config {
  mode: 'CALENDAR_MONTH' | 'PAY_CYCLE'
  anchor_schedule_code: string | null
  activation_date: string | null
  version: number
}

interface Cycle {
  code: string
  label: string
  start_date: string
  end_date_exclusive: string
  end_adjusted: boolean
  status: string
}

interface Schedule {
  code: string
  description: string
}

const ANCHOR_PREFIX = 'Âncora E2E'

/** Turns the cycles off (the cycles that started stay as history) so the other specs see months. */
async function cyclesOff(request: APIRequestContext) {
  const config = await apiGet<Config>(request, '/pay_cycle_config')
  if (config.mode !== 'PAY_CYCLE') return
  const response = await request.post('/api/pay_cycle_config/deactivation', {
    data: { expected_version: config.version, justification: 'Limpeza do teste E2E' },
  })
  expect(response.ok(), `deactivation answered ${response.status()}`).toBe(true)
}

/**
 * The cycles off and no anchor schedule of this spec left active: the anchor cannot be inactivated
 * while the cycles are on, and there can be only one active anchor on the shared database.
 */
async function cleanUp(request: APIRequestContext) {
  await cyclesOff(request)
  const schedules = await apiGet<Schedule[]>(request, '/income_schedule', { status: 'ACTIVE' })
  for (const schedule of schedules.filter((item) => item.description.startsWith(ANCHOR_PREFIX))) {
    await request.patch(`/api/income_schedule/${schedule.code}/inactivate`)
  }
}

test('activates the cycles on an anchor schedule, adjusts a boundary and turns them off', async ({
  page,
  request,
}) => {
  const description = unique(ANCHOR_PREFIX)
  const today = todayIso()
  // The anchor falls 10 days from now, so the first cycle is short and a later activation (the other
  // viewport runs this same spec) can start where it ends, within the 31 days the back accepts.
  const anchorDay = Number(shiftDate(today, 10).slice(8))

  try {
    await cleanUp(request)
    const created = await request.post('/api/income_schedule', {
      data: {
        description,
        amount: 1000,
        rule_type: 'FIXED_DAY',
        rule_value: anchorDay,
        business_week: 'MONDAY_TO_FRIDAY',
        // "Keep" needs no holiday calendar, so the dates are the same on any database.
        non_business_day_policy: 'KEEP',
        start_month: today.slice(0, 7),
        anchor: true,
      },
    })
    expect(created.ok(), `POST /income_schedule answered ${created.status()}`).toBe(true)
    const anchor = (await created.json()) as Schedule

    // A new activation starts at or after the end of the last cycle that exists.
    const history = await apiGet<Cycle[]>(request, '/pay_cycle')
    const lastEnd = history
      .map((cycle) => cycle.end_date_exclusive)
      .sort()
      .at(-1)
    const firstDay = lastEnd && lastEnd > today ? lastEnd : today

    // The cycles are off: see the first ones, then turn them on.
    await page.goto('/ciclos')
    await expect(page.getByText('Mês do calendário', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Ativar os ciclos' }).click()
    const activation = page.getByRole('dialog', { name: 'Ativar os ciclos' })
    await expect(activation.getByText(description, { exact: true })).toBeVisible()
    if (firstDay !== today) {
      await activation.getByLabel('Primeiro dia do primeiro ciclo').fill(firstDay)
    }
    await activation.getByRole('button', { name: 'Ver os primeiros ciclos' }).click()
    await expect(activation.getByText(`Os ciclos começam em ${brDate(firstDay)}`)).toBeVisible()
    await activation.getByRole('button', { name: 'Ativar os ciclos' }).click()

    await expect(page.getByText('Ciclos da receita âncora', { exact: true })).toBeVisible()
    await expect(page.getByText(`ligados desde ${brDate(firstDay)}`, { exact: true })).toBeVisible()
    const config = await apiGet<Config>(request, '/pay_cycle_config')
    expect(config).toMatchObject({
      mode: 'PAY_CYCLE',
      anchor_schedule_code: anchor.code,
      activation_date: firstDay,
    })

    // The current cycle, when today is in one, shows its report by competence.
    const currentResponse = await request.get('/api/pay_cycle/current')
    if (currentResponse.ok()) {
      const current = (await currentResponse.json()) as Cycle
      const region = page.getByRole('region', { name: 'Ciclo atual' })
      await expect(region.getByText(current.label, { exact: true })).toBeVisible()
      await expect(region.getByRole('table', { name: 'Totais do ciclo' })).toBeVisible()
    } else {
      await expect(page.getByText(/Hoje não cai em nenhum ciclo/)).toBeVisible()
    }

    // The chain is kept up to the current cycle plus two: the second one has a next cycle to move.
    const chain = (await apiGet<Cycle[]>(request, '/pay_cycle'))
      .filter((cycle) => cycle.start_date >= firstDay)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
    expect(chain.length).toBeGreaterThanOrEqual(3)
    const [, cycle, next] = chain as [Cycle, Cycle, Cycle]
    const newEnd = shiftDate(cycle.end_date_exclusive, -1)

    await page.goto(`/ciclos/${cycle.code}`)
    await expect(
      page.getByRole('heading', { name: `Ciclo ${cycle.label}`, level: 1 }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Ajustar a virada' }).click()
    const adjustment = page.getByRole('dialog', { name: 'Ajustar a virada' })
    await adjustment.getByLabel(`Novo primeiro dia de ${next.label}`).fill(newEnd)
    await adjustment.getByRole('button', { name: 'Ver o que muda' }).click()
    await expect(
      adjustment.getByText(
        `A virada passa de ${brDate(cycle.end_date_exclusive)} para ${brDate(newEnd)}`,
      ),
    ).toBeVisible()
    await adjustment.getByLabel('Motivo').fill('Ajuste do teste E2E')
    await adjustment.getByRole('button', { name: 'Ajustar a virada' }).click()

    // The boundary moved, was marked as set by hand and went to the history.
    await expect(page.getByText('Virada ajustada.')).toBeVisible()
    const moved = await apiGet<Cycle>(request, `/pay_cycle/${cycle.code}`)
    expect(moved).toMatchObject({ end_date_exclusive: newEnd, end_adjusted: true })
    const adjustments = page.getByRole('region', { name: 'Histórico de ajustes' })
    await expect(
      adjustments.getByText(`${brDate(cycle.end_date_exclusive)} → ${brDate(newEnd)}`),
    ).toBeVisible()
    await expect(adjustments.getByText('“Ajuste do teste E2E”')).toBeVisible()

    // The anchor schedule points to the transition instead of letting its rule change.
    await page.goto(`/receita/agenda/${anchor.code}`)
    const note = page.getByRole('note')
    await expect(note).toContainText('só mudam pela transição de âncora')
    await note.getByRole('link', { name: 'Mudar a receita âncora' }).click()
    await expect(page.getByRole('dialog', { name: 'Mudar a receita âncora' })).toBeVisible()
    await page.keyboard.press('Escape')

    // Turning the cycles off asks why.
    await page.goto('/ciclos')
    await page.getByRole('button', { name: 'Desligar os ciclos' }).click()
    const deactivation = page.getByRole('dialog', { name: 'Desligar os ciclos' })
    await deactivation.getByLabel('Motivo').fill('Fim do teste E2E')
    await deactivation.getByRole('button', { name: 'Desligar os ciclos' }).click()
    await expect(page.getByText('Ciclos desligados.')).toBeVisible()
    await expect(page.getByText('Mês do calendário', { exact: true })).toBeVisible()
    expect(await apiGet<Config>(request, '/pay_cycle_config')).toMatchObject({
      mode: 'CALENDAR_MONTH',
    })
  } finally {
    await cleanUp(request)
  }
})
