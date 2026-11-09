import { expect, test, type Page } from '@playwright/test'

import { apiGet, money, signedMoney } from './helpers'

interface Dashboard {
  month_total_revenue: number
  month_total_expense: number
  month_net_change: number
}

const card = (page: Page, title: string) =>
  page.locator('section').filter({ has: page.getByRole('heading', { name: title }) })

test('the dashboard shows the numbers the API returns', async ({ page, request }) => {
  const dashboard = await apiGet<Dashboard>(request, '/dashboard')
  const balances = await apiGet<{ total: number }>(request, '/account/balance')

  await page.goto('/')

  await expect(card(page, 'Saldo nas contas')).toContainText(money(balances.total))
  await expect(card(page, 'Receitas do mês')).toContainText(
    money(Math.abs(dashboard.month_total_revenue)),
  )
  await expect(card(page, 'Despesas do mês')).toContainText(
    money(Math.abs(dashboard.month_total_expense)),
  )
  await expect(card(page, 'Resultado do mês')).toContainText(
    signedMoney(dashboard.month_net_change),
  )
})
