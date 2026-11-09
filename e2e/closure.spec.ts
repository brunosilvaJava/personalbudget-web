import { expect, test, type APIRequestContext } from '@playwright/test'

import {
  ANCHOR_PREFIX,
  activateCycles,
  apiGet,
  brDate,
  cleanUpCycles,
  createAnchor,
  moneyPattern,
  shiftDate,
  todayIso,
  unique,
  type PayCycle,
} from './helpers'

interface ClosurePreview {
  summary: { projected_expense: number }
  expected_version: number
  can_close: boolean
  blockers: string[]
  late_movement_codes: string[]
}

interface Snapshot {
  snapshot_version: number
  projected_expense: number
}

// Many steps against the real API (activating cycles, a movement, closing, reopening). A click
// that never finds its target fails after 10 s with its own locator.
test.setTimeout(120_000)
test.use({ actionTimeout: 10_000 })

async function previewOf(request: APIRequestContext, cycle: PayCycle): Promise<ClosurePreview> {
  const response = await request.post(`/api/pay_cycle/${cycle.code}/closure/preview`)
  expect(response.ok(), `closure preview answered ${response.status()}`).toBe(true)
  return (await response.json()) as ClosurePreview
}

async function statusOf(request: APIRequestContext, cycle: PayCycle): Promise<PayCycle> {
  return apiGet<PayCycle>(request, `/pay_cycle/${cycle.code}`)
}

test('closes a cycle that ended, locks its movements and reopens it', async ({
  page,
  request,
  isMobile,
}) => {
  // The back only accepts an activation that starts at or after the end of the last cycle that
  // started, and the specs that ran before leave one behind (and the next ones need the database
  // as it is). A cycle that has already ended can be made once per database: the mobile run does.
  test.skip(!isMobile, 'the cycle that ended can only be created once on a shared database')

  const today = todayIso()
  // The back does not accept an anchor schedule that starts before this month, so the boundary
  // that ends the cycle is the first day of this month: it is never in the future, and a cycle
  // that ends on it (the end is exclusive) has ended even on the 1st. The first cycle starts two
  // weeks earlier (the back accepts an activation up to 31 days back).
  const boundary = `${today.slice(0, 7)}-01`
  const initialDate = shiftDate(boundary, -14)
  let ended: PayCycle | undefined
  let movementCode: string | undefined

  try {
    await cleanUpCycles(request)
    // Day 1 of the month: `daysAhead` counts from today.
    await createAnchor(
      request,
      unique(ANCHOR_PREFIX),
      Number(boundary.slice(8)) - Number(today.slice(8)),
    )
    const chain = await activateCycles(request, initialDate)

    const target = chain.find((cycle) => cycle.status === 'PENDING_CLOSE')
    const open = chain.find((cycle) => cycle.status === 'OPEN')
    const planned = chain.find((cycle) => cycle.status === 'PLANNED')
    expect(target, 'a cycle that ended in the chain of the activation').toBeDefined()
    expect(open, 'the cycle that has today').toBeDefined()
    expect(planned, 'a cycle that has not started').toBeDefined()
    ended = target!

    const section = page.getByRole('region', { name: 'Fechamento', exact: true })

    // A cycle that has not ended shows what is missing and offers no way to close it.
    await page.goto(`/ciclos/${open!.code}`)
    await expect(
      page.getByRole('heading', { name: `Ciclo ${open!.label}`, level: 1 }),
    ).toBeVisible()
    await expect(section).toContainText(
      `vai até ${brDate(shiftDate(open!.end_date_exclusive, -1))}`,
    )
    await section.getByRole('button', { name: 'Ver o que falta para fechar' }).click()
    const review = page.getByRole('dialog', { name: `Fechamento de ${open!.label}` })
    await expect(review.getByText('O ciclo ainda não terminou')).toBeVisible()
    await expect(review.getByRole('button', { name: 'Fechar o ciclo' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(review).toHaveCount(0)

    await page.goto(`/ciclos/${planned!.code}`)
    await expect(section).toContainText('Este ciclo ainda não começou.')
    await expect(section.getByRole('button')).toHaveCount(0)

    // A movement whose competence is inside the cycle that ended, not yet due: it does not block.
    const description = unique('Mov E2E fechamento')
    const created = await request.post('/api/financial_movement', {
      data: {
        operation_type: 'DEBIT',
        description,
        amount: 250,
        movement_date: `${today}T09:00:00`,
        due_date: `${shiftDate(today, 10)}T09:00:00`,
        competence_date: shiftDate(initialDate, 3),
      },
    })
    expect(created.ok(), `POST /financial_movement answered ${created.status()}`).toBe(true)
    movementCode = ((await created.json()) as { code: string }).code

    const preview = await previewOf(request, ended)
    expect(preview.blockers, 'what blocks the closure of the cycle that ended').toEqual([])
    expect(preview.can_close).toBe(true)
    expect(preview.summary.projected_expense).toBeGreaterThanOrEqual(250)

    // Close it from the screen: the review shows what the snapshot will freeze, the back's numbers.
    await page.goto(`/ciclos/${ended.code}`)
    await section.getByRole('button', { name: 'Fechar o ciclo' }).click()
    const sheet = page.getByRole('dialog', { name: `Fechar ${ended.label}` })
    await expect(sheet.getByText('Nada impede o fechamento')).toBeVisible()
    await expect(sheet.getByRole('row', { name: /Despesas/ })).toContainText(
      moneyPattern(preview.summary.projected_expense),
    )
    await sheet.getByRole('button', { name: 'Fechar o ciclo' }).click()

    await expect(page.getByText('Ciclo fechado. Fechamento versão 1.').first()).toBeVisible()
    await expect(sheet).toHaveCount(0)
    await expect(section).toContainText('Este ciclo está fechado')
    await expect(section.getByText('Em vigor')).toBeVisible()
    await expect(section.getByRole('button', { name: 'Reabrir o ciclo' })).toBeVisible()

    expect((await statusOf(request, ended)).status).toBe('CLOSED')
    const snapshots = await apiGet<Snapshot[]>(request, `/pay_cycle/${ended.code}/snapshots`)
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]).toMatchObject({
      snapshot_version: 1,
      projected_expense: preview.summary.projected_expense,
    })

    // The movement of the closed cycle: the screen says so and does not offer to delete, and the
    // back refuses what the screen did not offer.
    await page.goto(
      `/movimentacoes?inicio=${today}&fim=${today}&busca=${encodeURIComponent(description)}`,
    )
    await page.getByRole('button', { name: new RegExp(description) }).click()
    const movement = page.getByRole('dialog', { name: new RegExp(description) })
    await expect(movement.getByRole('note')).toContainText(`O ciclo ${ended.label} está fechado.`)
    await expect(movement.getByRole('button', { name: 'Excluir' })).toBeDisabled()
    await expect(movement.getByRole('button', { name: /^Pagar/ })).toBeEnabled()
    const refused = await request.delete(`/api/financial_movement/${movementCode}`)
    expect(refused.status()).toBe(409)
    expect(((await refused.json()) as { message: string }).message).toContain(
      'O ciclo está fechado',
    )

    // Reopen it: the closure that was undone stays in the history.
    await page.goto(`/ciclos/${ended.code}`)
    await section.getByRole('button', { name: 'Reabrir o ciclo' }).click()
    const confirm = page.getByRole('alertdialog', { name: `Reabrir ${ended.label}?` })
    await confirm.getByRole('button', { name: 'Reabrir' }).click()

    await expect(section.getByRole('button', { name: 'Fechar o ciclo' })).toBeVisible()
    await expect(section.getByRole('region', { name: 'Fechamentos anteriores' })).toBeVisible()
    await expect(section.getByText('Em vigor')).toHaveCount(0)
    expect((await statusOf(request, ended)).status).toBe('PENDING_CLOSE')
    expect(await apiGet<Snapshot[]>(request, `/pay_cycle/${ended.code}/snapshots`)).toHaveLength(1)
  } finally {
    // Whatever failed, leave the cycle open and the movement gone, so the next specs find the
    // database as it was.
    if (ended) {
      const current = await statusOf(request, ended).catch(() => undefined)
      if (current?.status === 'CLOSED') {
        await request.post(`/api/pay_cycle/${ended.code}/reopen`, {
          data: { expected_version: current.version },
        })
      }
    }
    if (movementCode) await request.delete(`/api/financial_movement/${movementCode}`)
    await cleanUpCycles(request)
  }
})
