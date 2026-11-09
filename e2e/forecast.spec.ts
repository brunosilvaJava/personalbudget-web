import { expect, test, type Page } from '@playwright/test'

import { apiGet, brDate, moneyPattern, shiftDate, todayIso } from './helpers'

interface Forecast {
  until: string
  include_late_income: boolean
  cash_balance: number
  expected_income: number
  late_income: number
  obligations: number
  card_invoices: number
  projected_cash: number
  envelope_reserve: number
  card_beyond_horizon: number
  free_after_reserves: number
  lowest_projected_cash: number
  lowest_projected_cash_date: string
  negative_cash_alert: boolean
  insufficient_budget_alert: boolean
}

const freeRegion = (page: Page) => page.getByRole('region', { name: 'Livre depois das reservas' })
const row = (page: Page, name: RegExp) => page.getByRole('row', { name })

/** Every number the page shows is the one the API computes: the front does no arithmetic of its own. */
async function expectPageMatches(page: Page, forecast: Forecast) {
  const until = brDate(forecast.until)
  await expect(freeRegion(page)).toContainText(`até ${until}`)
  await expect(freeRegion(page)).toContainText(moneyPattern(forecast.free_after_reserves))
  await expect(freeRegion(page)).toContainText(moneyPattern(forecast.lowest_projected_cash))
  await expect(row(page, /Saldo nas contas hoje/)).toContainText(
    moneyPattern(forecast.cash_balance),
  )
  await expect(row(page, /Receitas a receber/)).toContainText(
    moneyPattern(forecast.expected_income),
  )
  await expect(row(page, /Despesas a pagar/)).toContainText(moneyPattern(forecast.obligations))
  await expect(row(page, /Parcelas de cartão/)).toContainText(moneyPattern(forecast.card_invoices))
  await expect(row(page, /Caixa projetado em/)).toContainText(moneyPattern(forecast.projected_cash))
  await expect(row(page, /Reserva dos envelopes/)).toContainText(
    moneyPattern(forecast.envelope_reserve),
  )
  await expect(row(page, /Cartão que vence depois de/)).toContainText(
    moneyPattern(forecast.card_beyond_horizon),
  )
  // The two warnings are independent, and each shows exactly when the API says so.
  const cash = page.getByRole('alert').filter({ hasText: 'Caixa negativo' })
  const budget = page.getByRole('alert').filter({ hasText: 'Orçamento insuficiente' })
  await expect(cash).toHaveCount(forecast.negative_cash_alert ? 1 : 0)
  await expect(budget).toHaveCount(forecast.insufficient_budget_alert ? 1 : 0)
}

test('shows the cash forecast as the API computes it, for the default horizon and another one', async ({
  page,
  request,
}) => {
  const today = todayIso()

  // The default horizon is the back's: the end of the current cycle, or of the month.
  const standard = await apiGet<Forecast>(request, '/forecast')
  await page.goto('/previsao')
  await expectPageMatches(page, standard)
  await expect(page.getByLabel('Previsão até')).toHaveValue(standard.until)
  await expect(page.getByRole('button', { name: 'Voltar ao padrão' })).toHaveCount(0)

  // Another horizon.
  const later = shiftDate(today, 45)
  await page.getByLabel('Previsão até').fill(later)
  const far = await apiGet<Forecast>(request, '/forecast', { until: later })
  expect(far.until).toBe(later)
  await expectPageMatches(page, far)
  await expect(page).toHaveURL(new RegExp(`ate=${later}`))

  // The late income is out of the account until it is asked for.
  const withLate = await apiGet<Forecast>(request, '/forecast', {
    until: later,
    include_late_income: 'true',
  })
  await page.getByRole('switch', { name: 'Contar receitas atrasadas' }).click()
  await expectPageMatches(page, withLate)
  await expect(row(page, /Receitas atrasadas/)).toContainText(moneyPattern(withLate.late_income))
  await expect(page).toHaveURL(/atrasadas=1/)

  // A date the back would refuse is not sent.
  await page.getByLabel('Previsão até').fill(shiftDate(today, 400))
  await expect(page.getByText('A data pode ir no máximo 366 dias à frente.')).toBeVisible()

  // Back to the default.
  await page.getByRole('button', { name: 'Voltar ao padrão' }).click()
  await page.getByRole('switch', { name: 'Contar receitas atrasadas' }).click()
  await expectPageMatches(page, standard)
  await expect(page).not.toHaveURL(/ate=/)
})

test('shows the same free amount on Início and links to the forecast', async ({
  page,
  request,
}) => {
  const standard = await apiGet<Forecast>(request, '/forecast')

  await page.goto('/')
  const card = page.getByRole('link', { name: /Livre depois das reservas/ })
  await expect(card).toContainText(moneyPattern(standard.free_after_reserves))
  await expect(card).toContainText(`até ${brDate(standard.until)}`)

  await card.click()
  await expect(page).toHaveURL(/\/previsao$/)
  await expect(page.getByRole('heading', { name: 'Previsão de caixa', level: 1 })).toBeVisible()
})
