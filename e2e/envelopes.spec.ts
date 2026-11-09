import { expect, test, type APIRequestContext } from '@playwright/test'

import {
  ANCHOR_PREFIX,
  activateCycles,
  apiGet,
  cleanUpCycles,
  createAnchor,
  moneyPattern,
  unique,
  type PayCycle,
} from './helpers'

interface Category {
  code: string
  name: string
  operation_type: 'CREDIT' | 'DEBIT'
  status: 'ACTIVE' | 'INACTIVE'
}

interface Envelope {
  code: string
  category_code: string
  category_name: string
  planned_amount: number
  reserved_amount: number
}

interface CycleEnvelopes {
  envelopes: Envelope[]
  total_planned: number
}

interface Forecast {
  envelope_cycle_code: string | null
  envelope_reserve: number
}

async function envelopesOf(request: APIRequestContext, cycle: PayCycle): Promise<CycleEnvelopes> {
  return apiGet<CycleEnvelopes>(request, `/pay_cycle/${cycle.code}/envelope`)
}

/** What a failed run leaves behind: the envelopes of the cycle, so no cycle keeps a reserve. */
async function deleteEnvelopes(request: APIRequestContext, cycle: PayCycle) {
  const { envelopes } = await envelopesOf(request, cycle)
  for (const envelope of envelopes) await request.delete(`/api/envelope/${envelope.code}`)
}

// Many steps against the real API (activating cycles, three writes, the forecast): more than the
// default 30 s on a slow runner. A click that never finds its target fails after 10 s with its own
// locator, instead of waiting for the end of the test and hiding which step it was.
test.setTimeout(90_000)
test.use({ actionTimeout: 10_000 })

test('plans, changes and removes an envelope of a cycle, and the forecast reserves what is left', async ({
  page,
  request,
}) => {
  let cycle: PayCycle | undefined

  try {
    await cleanUpCycles(request)
    await createAnchor(request, unique(ANCHOR_PREFIX))
    // The first cycle of the new activation, whether or not it is the one that has today.
    const chain = await activateCycles(request)
    const target = chain[0]!
    cycle = target

    const categories = await apiGet<Category[]>(request, '/category')
    const category = categories.find(
      (item) => item.operation_type === 'DEBIT' && item.status === 'ACTIVE',
    )
    expect(category, 'an active expense category in GET /category').toBeDefined()

    // No envelope yet.
    await page.goto(`/ciclos/${target.code}/envelopes`)
    await expect(
      page.getByRole('heading', { name: `Envelopes · ${target.label}`, level: 1 }),
    ).toBeVisible()
    await expect(page.getByText('Nenhum envelope neste ciclo')).toBeVisible()

    // Create one: R$ 800,00 on a category.
    await page.getByRole('button', { name: 'Novo envelope' }).click()
    const sheet = page.getByRole('dialog', { name: 'Novo envelope' })
    await sheet.getByRole('combobox', { name: 'Categoria' }).click()
    await page.getByRole('option', { name: category!.name, exact: true }).click()
    await sheet.getByLabel('Valor planejado').fill('800')
    await sheet.getByRole('button', { name: 'Criar envelope' }).click()

    await expect(page.getByText(`Envelope de ${category!.name} criado.`).first()).toBeVisible()
    // inside the list: the toast is a list item too, and it names the category as well
    const card = page
      .getByRole('list', { name: 'Envelopes do ciclo' })
      .getByRole('listitem')
      .filter({ hasText: category!.name })
    await expect(card).toContainText(moneyPattern(800))
    await expect(card.getByRole('progressbar')).toBeVisible()
    const created = await envelopesOf(request, target)
    expect(created.envelopes).toHaveLength(1)
    expect(created.envelopes[0]).toMatchObject({
      category_code: category!.code,
      planned_amount: 800,
    })

    // A category with an envelope is not offered again.
    await page.getByRole('button', { name: 'Novo envelope' }).click()
    const second = page.getByRole('dialog', { name: 'Novo envelope' })
    await second.getByRole('combobox', { name: 'Categoria' }).click()
    await expect(page.getByRole('option', { name: category!.name, exact: true })).toHaveCount(0)
    // One Escape closes the list; the sheet is out of the accessibility tree while it is open, and
    // back in it when it closes. Wait for that before the second Escape, which closes the sheet:
    // pressed at once, it lands while the list is still closing and leaves the page locked.
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Novo envelope' })).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // Change the amount: only that changes.
    await page.getByRole('button', { name: `Alterar valor de ${category!.name}` }).click()
    const edit = page.getByRole('dialog', { name: `Envelope de ${category!.name}` })
    await edit.getByLabel('Valor planejado').fill('950')
    await edit.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText(`Envelope de ${category!.name} atualizado.`).first()).toBeVisible()
    await expect(card).toContainText(moneyPattern(950))
    const changed = await envelopesOf(request, target)
    expect(changed.envelopes[0]).toMatchObject({ planned_amount: 950 })

    // The forecast reserves what is still free of the envelopes of the CURRENT cycle: the page
    // shows what the API says, whichever cycle that is (it may not be the one planned above).
    const forecast = await apiGet<Forecast>(request, '/forecast')
    await page.goto('/previsao')
    await expect(page.getByRole('row', { name: /Reserva dos envelopes/ })).toContainText(
      moneyPattern(forecast.envelope_reserve),
    )
    if (forecast.envelope_cycle_code === target.code) {
      expect(forecast.envelope_reserve).toBeGreaterThan(0)
      await page.getByRole('link', { name: 'Reserva dos envelopes' }).click()
      await expect(page).toHaveURL(new RegExp(`/ciclos/${target.code}/envelopes$`))
    }

    // Delete it, after confirming.
    await page.goto(`/ciclos/${target.code}/envelopes`)
    await page.getByRole('button', { name: `Excluir envelope de ${category!.name}` }).click()
    const dialog = page.getByRole('alertdialog', { name: 'Excluir este envelope?' })
    await dialog.getByRole('button', { name: 'Excluir' }).click()
    await expect(page.getByText('Envelope excluído.').first()).toBeVisible()
    await expect(page.getByText('Nenhum envelope neste ciclo')).toBeVisible()
    expect((await envelopesOf(request, target)).envelopes).toEqual([])
  } finally {
    if (cycle) await deleteEnvelopes(request, cycle)
    await cleanUpCycles(request)
  }
})
