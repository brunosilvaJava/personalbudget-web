import { expect, test } from '@playwright/test'

import { accountBalance, accountCodeByName, moneyPattern, unique } from './helpers'

test('buys on the card, pays the invoice, and the account balance goes down (and back up on reversal)', async ({
  page,
  request,
}) => {
  const accountName = unique('Conta E2E')
  const cardName = unique('Cartão E2E')
  const purchase = unique('Geladeira')

  // An account with R$ 1.000,00 …
  await page.goto('/carteira/contas')
  await page.getByRole('button', { name: 'Nova conta' }).click()
  const account = page.getByRole('dialog', { name: 'Nova conta' })
  await account.getByLabel('Nome', { exact: true }).fill(accountName)
  await account.getByLabel('Saldo inicial', { exact: true }).fill('1000')
  await account.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByRole('link', { name: new RegExp(accountName) })).toContainText(
    moneyPattern(1000),
  )
  const accountCode = await accountCodeByName(request, accountName)

  // … a card whose invoice that account pays …
  await page.goto('/carteira/cartoes')
  await page.getByRole('button', { name: 'Novo cartão' }).click()
  const card = page.getByRole('dialog', { name: 'Novo cartão' })
  await card.getByLabel('Nome', { exact: true }).fill(cardName)
  await card.getByLabel('Dia do fechamento').fill('10')
  await card.getByLabel('Dia do vencimento').fill('20')
  await card.getByLabel('Limite (opcional)').fill('5000')
  await card.getByRole('combobox', { name: 'Conta que paga a fatura (opcional)' }).click()
  await page.getByRole('option', { name: new RegExp(accountName) }).click()
  await card.getByRole('button', { name: 'Criar cartão' }).click()
  await page.getByRole('link', { name: new RegExp(cardName) }).click()

  // … one purchase of R$ 250,00, which lands on an invoice and does not touch the balance …
  await page.getByRole('button', { name: 'Nova compra' }).click()
  const form = page.getByRole('dialog', { name: 'Compra no cartão' })
  await form.getByLabel('Descrição', { exact: true }).fill(purchase)
  await form.getByLabel('Valor da parcela', { exact: true }).fill('250')
  await form.getByRole('button', { name: 'Lançar compra' }).click()
  const bought = page.getByRole('dialog', { name: purchase })
  await expect(bought.getByText('À vista')).toBeVisible()
  expect(await accountBalance(request, accountCode)).toBeCloseTo(1000, 2)

  // … then the invoice is paid, by that account.
  await bought.getByRole('link', { name: /^1\/1\s*Fatura/ }).click()
  await expect(page.getByRole('heading', { name: /^Fatura de / })).toBeVisible()
  await page.getByRole('button', { name: /Pagar fatura/ }).click()
  const pay = page.getByRole('dialog', { name: /Pagar fatura de / })
  await expect(pay.getByRole('combobox', { name: 'Pagar com a conta' })).toHaveText(
    new RegExp(accountName),
  )
  await pay.getByRole('button', { name: 'Confirmar pagamento' }).click()
  await expect(page.getByText(/Fatura paga: R\$\s250,00/)).toBeVisible()

  await expect.poll(() => accountBalance(request, accountCode)).toBeCloseTo(750, 2)
  await page.goto('/carteira/contas')
  await expect(page.getByRole('link', { name: new RegExp(accountName) })).toContainText(
    moneyPattern(750),
  )

  // Reversing the payment gives the money back.
  await page.goBack()
  await page.getByRole('button', { name: 'Estornar' }).click()
  await page
    .getByRole('alertdialog', { name: 'Estornar pagamento da fatura?' })
    .getByRole('button', { name: 'Estornar' })
    .click()
  await expect(page.getByText('Pagamento da fatura estornado.')).toBeVisible()
  await expect.poll(() => accountBalance(request, accountCode)).toBeCloseTo(1000, 2)
})
