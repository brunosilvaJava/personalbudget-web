import { expect, test, type APIRequestContext } from '@playwright/test'

import { apiGet, brDate, monthLabel, moneyPattern, shiftMonth, todayIso, unique } from './helpers'

interface Schedule {
  code: string
  description: string
  status: 'ACTIVE' | 'INACTIVE'
}

interface MovementPage {
  content: {
    code: string
    operation_type: string
    amount: number
    status: string
    description: string
  }[]
}

/** The schedule and the movements a test created, so the shared database is not left posting them. */
async function cleanUp(request: APIRequestContext, description: string, from: string, to: string) {
  const schedules = await apiGet<Schedule[]>(request, '/income_schedule', { status: 'ACTIVE' })
  for (const schedule of schedules.filter((item) => item.description === description)) {
    await request.patch(`/api/income_schedule/${schedule.code}/inactivate`)
  }
  const movements = await apiGet<MovementPage>(request, '/financial_movement', {
    description,
    start_date: from,
    end_date: to,
    size: '50',
  })
  for (const movement of movements.content) {
    await request.delete(`/api/financial_movement/${movement.code}`)
  }
}

test('creates an income schedule, sees each month with its date, posts next month early and inactivates it', async ({
  page,
  request,
}) => {
  const description = unique('Receita E2E')
  const thisMonth = todayIso().slice(0, 7)
  const nextMonth = shiftMonth(thisMonth, 1)
  const from = `${thisMonth}-01`
  const to = `${shiftMonth(thisMonth, 2)}-28`

  try {
    // A fixed day that keeps the date even on a day that is not a business day: it does not depend
    // on the holiday calendar, so the dates below are the same on any database.
    await page.goto('/receita/agenda')
    await page.getByRole('button', { name: 'Nova receita' }).click()
    const form = page.getByRole('dialog', { name: 'Nova receita' })
    await form.getByLabel('Descrição', { exact: true }).fill(description)
    await form.getByLabel('Valor', { exact: true }).fill('1000')
    await form.getByLabel('Dia do mês').fill('28')
    await form.getByRole('radio', { name: 'Manter' }).click()
    await form.getByRole('button', { name: 'Criar receita' }).click()

    // It opens the new schedule, with the rule written out.
    await expect(page.getByRole('heading', { name: description, level: 1 })).toBeVisible()
    await expect(page.getByText('Dia 28 de cada mês, mesmo em dia não útil')).toBeVisible()

    // Twelve months, from this one, each on its day 28.
    const rows = page.getByRole('listitem').filter({ hasText: /de 20\d\d/ })
    await expect(rows).toHaveCount(12)
    const next = page.getByRole('listitem').filter({ hasText: monthLabel(nextMonth) })
    await expect(next).toContainText('Prevista')
    await expect(next).toContainText(brDate(`${nextMonth}-28`))
    await expect(next).toContainText(moneyPattern(1000))
    const beyond = page
      .getByRole('listitem')
      .filter({ hasText: monthLabel(shiftMonth(thisMonth, 3)) })
    await expect(beyond).toContainText('Prevista')
    // Only this month and the next one can be posted ahead of the job.
    await expect(beyond.getByRole('button', { name: 'Lançar agora' })).toHaveCount(0)

    // Posting next month's receipt asks first, then creates the movement and freezes the month.
    await next.getByRole('button', { name: 'Lançar agora' }).click()
    const confirm = page.getByRole('alertdialog', { name: 'Lançar esta receita agora?' })
    await expect(confirm).toContainText(monthLabel(nextMonth))
    await confirm.getByRole('button', { name: 'Lançar agora' }).click()
    await expect(next).toContainText('Lançada')
    await expect(next.getByRole('button', { name: 'Lançar agora' })).toHaveCount(0)

    const posted = await apiGet<MovementPage>(request, '/financial_movement', {
      description,
      start_date: from,
      end_date: to,
    })
    expect(posted.content).toHaveLength(1)
    expect(posted.content[0]).toMatchObject({ operation_type: 'CREDIT', amount: 1000 })
    expect(['PENDING', 'LATE']).toContain(posted.content[0]!.status)

    // Inactivating asks first and keeps the history.
    await page.getByRole('button', { name: 'Inativar', exact: true }).click()
    await page
      .getByRole('alertdialog', { name: 'Inativar receita?' })
      .getByRole('button', { name: 'Inativar' })
      .click()
    await expect(page.getByText('inativa', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ativar', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Lançar agora' })).toHaveCount(0)
  } finally {
    await cleanUp(request, description, from, to)
  }
})

test('reviews a year of the holiday calendar: sees what changes, then saves the complete list', async ({
  page,
  request,
}) => {
  // Far from the years in use, so the review changes no date the other specs read.
  const year = 2031
  const holiday = unique('Feriado E2E')

  await page.goto(`/receita/calendario?ano=${year}`)
  await expect(page.getByRole('heading', { name: String(year) })).toBeVisible()
  // The first run finds the year not reviewed; the next ones, reviewed by the previous.
  const review = page.getByRole('button', { name: `Revisar ${year}` })
  const edit = page.getByRole('button', { name: 'Editar feriados' })
  await expect(review.or(edit)).toBeVisible()
  await ((await review.isVisible()) ? review : edit).click()

  const sheet = page.getByRole('dialog', {
    name: new RegExp(`(Revisar|Editar feriados de) ${year}`),
  })
  // The list is the COMPLETE year: empty it, then add the one holiday of this run.
  while ((await sheet.getByRole('button', { name: /^Remover feriado/ }).count()) > 0) {
    await sheet.getByRole('button', { name: 'Remover feriado 1' }).click()
  }
  await sheet.getByRole('button', { name: 'Adicionar feriado' }).click()
  await sheet.getByLabel('Data do feriado 1').fill(`${year}-07-04`)
  await sheet.getByLabel('Nome do feriado 1').fill(holiday)
  await sheet.getByRole('button', { name: 'Ver o que muda' }).click()

  // The preview is the real endpoint's answer; nothing is written yet.
  await expect(sheet.getByText(`Gravar ${year} com 1 feriado.`)).toBeVisible()
  const before = await apiGet<{ holidays: { name: string }[] }>(
    request,
    `/holiday_calendar/${year}`,
  )
  expect(before.holidays.map((item) => item.name)).not.toContain(holiday)

  await sheet.getByRole('button', { name: 'Gravar revisão' }).click()
  await expect(page.getByText(`Calendário de ${year} revisado.`)).toBeVisible()
  await expect(page.getByText(holiday)).toBeVisible()
  await expect(page.getByText('revisado', { exact: true })).toBeVisible()

  const saved = await apiGet<{ reviewed: boolean; holidays: { date: string; name: string }[] }>(
    request,
    `/holiday_calendar/${year}`,
  )
  expect(saved.reviewed).toBe(true)
  expect(saved.holidays).toEqual([{ date: `${year}-07-04`, name: holiday }])
})
