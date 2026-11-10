import { expect, test } from '@playwright/test'

import { moneyPattern, todayIso, unique } from './helpers'

test('imports a Nubank statement: previews it, leaves the payment out, and launches the purchases', async ({
  page,
}) => {
  const cardName = unique('Cartão Fatura')
  const market = unique('Mercado')
  const store = unique('Loja')
  const today = todayIso()

  await page.goto('/carteira/cartoes')
  await page.getByRole('button', { name: 'Novo cartão' }).click()
  const card = page.getByRole('dialog', { name: 'Novo cartão' })
  await card.getByLabel('Nome', { exact: true }).fill(cardName)
  await card.getByLabel('Dia do fechamento').fill('10')
  await card.getByLabel('Dia do vencimento').fill('20')
  await card.getByRole('button', { name: 'Criar cartão' }).click()
  await page.getByRole('link', { name: new RegExp(cardName) }).click()

  await page.getByRole('link', { name: 'Importar fatura' }).click()
  const csv = [
    'date,title,amount',
    `${today},${market},"50,00"`,
    `${today},Pagamento recebido,"- 300,00"`,
    `${today},${store},"70,00"`,
  ].join('\n')
  await page.getByLabel(/Arquivo da fatura/).setInputFiles({
    name: 'nubank.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  })

  // Nothing is written yet: the list is only a preview, with the payment set apart.
  await expect(page.getByText(market)).toBeVisible()
  await expect(page.getByText(store)).toBeVisible()
  await expect(
    page.getByRole('region', { name: 'Linhas que não entram' }).getByText('Pagamento recebido'),
  ).toBeVisible()
  const submit = page.getByRole('button', { name: 'Importar 2 compras' })
  await expect(submit).toBeEnabled()
  await expect(page.getByText(/soma/)).toContainText(moneyPattern(120))

  await submit.click()
  await expect(page.getByText(new RegExp(`2 compras lançadas em ${cardName}`))).toBeVisible()

  // A second import of the same file finds them all already imported.
  await page.getByRole('link', { name: 'Ver o cartão' }).click()
  await page.getByRole('link', { name: 'Importar fatura' }).click()
  await page.getByLabel(/Arquivo da fatura/).setInputFiles({
    name: 'nubank.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  })
  await expect(page.getByText('já importada')).toHaveCount(2)
})
