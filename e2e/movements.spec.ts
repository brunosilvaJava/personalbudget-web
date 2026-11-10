import { expect, test } from '@playwright/test'

import { findInList, moneyPattern, totalBalance, unique } from './helpers'

test('launches an expense already paid, then reverses the payment', async ({ page, request }) => {
  const description = unique('Pão e leite')
  const before = await totalBalance(request)

  await page.goto('/movimentacoes?lancar=1')
  const sheet = page.getByRole('dialog', { name: 'Lançar' })
  await sheet.getByLabel('Valor', { exact: true }).fill('18,40')
  await sheet.getByLabel('Descrição', { exact: true }).fill(description)
  await sheet.getByRole('button', { name: 'Lançar despesa paga' }).click()

  await expect(page.getByText(/Despesa de R\$\s18,40 lançada e paga/)).toBeVisible()
  // Two calls (the movement, then its settlement): the account is the one that lost the money.
  await expect.poll(() => totalBalance(request)).toBeCloseTo(before - 18.4, 2)

  await findInList(page, description)
  await page.getByRole('button', { name: new RegExp(description) }).click()
  const movement = page.getByRole('dialog', { name: new RegExp(description) })
  await expect(movement.getByRole('button', { name: /Pagar/ })).toHaveCount(0)
  await movement.getByRole('button', { name: 'Estornar' }).click()
  const confirm = page.getByRole('alertdialog', { name: 'Estornar pagamento?' })
  await confirm.getByRole('button', { name: 'Estornar' }).click()

  await expect(page.getByText('Estorno registrado.')).toBeVisible()
  await expect(movement.getByRole('button', { name: /Pagar/ })).toBeVisible()
  await expect.poll(() => totalBalance(request)).toBeCloseTo(before, 2)
})

test('launches an expense not paid yet: it stays pending and the balance does not move', async ({
  page,
  request,
}) => {
  const description = unique('Energia elétrica')
  const before = await totalBalance(request)

  await page.goto('/movimentacoes?lancar=1')
  const sheet = page.getByRole('dialog', { name: 'Lançar' })
  await sheet.getByLabel('Valor', { exact: true }).fill('231,77')
  await sheet.getByLabel('Descrição', { exact: true }).fill(description)
  await sheet.getByRole('switch', { name: 'Ainda não paguei' }).click()
  await sheet.getByRole('button', { name: 'Lançar despesa pendente' }).click()

  await findInList(page, description)
  const row = page.getByRole('button', { name: new RegExp(description) })
  await expect(row).toBeVisible()
  await expect(row).toContainText(moneyPattern(231.77))
  expect(await totalBalance(request)).toBeCloseTo(before, 2)
})
