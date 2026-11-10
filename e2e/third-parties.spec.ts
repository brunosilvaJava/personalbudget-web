import { expect, test } from '@playwright/test'

import { accountBalance, accountCodeByName, apiGet, moneyPattern, unique } from './helpers'

interface Receivable {
  amount: number
  received_amount: number
  remaining_amount: number
  status: string
  description: string
}

test('a purchase on a card lent to a third party becomes something to receive from them', async ({
  page,
  request,
}) => {
  const partyName = unique('Terceiro')
  const cardName = unique('Cartão Emprestado')
  const purchase = unique('Farmácia')

  await page.goto('/carteira/terceiros')
  await page.getByRole('button', { name: 'Novo terceiro' }).click()
  const partyForm = page.getByRole('dialog', { name: 'Novo terceiro' })
  await partyForm.getByLabel('Nome', { exact: true }).fill(partyName)
  await partyForm.getByRole('button', { name: 'Cadastrar terceiro' }).click()
  await expect(page.getByText(partyName)).toBeVisible()

  // The card is lent: every purchase on it is theirs.
  await page.goto('/carteira/cartoes')
  await page.getByRole('button', { name: 'Novo cartão' }).click()
  const card = page.getByRole('dialog', { name: 'Novo cartão' })
  await card.getByLabel('Nome', { exact: true }).fill(cardName)
  await card.getByLabel('Dia do fechamento').fill('10')
  await card.getByLabel('Dia do vencimento').fill('20')
  await card.getByRole('combobox', { name: /Terceiro padrão/ }).click()
  await page.getByRole('option', { name: partyName }).click()
  await card.getByRole('button', { name: 'Criar cartão' }).click()
  await page.getByRole('link', { name: new RegExp(cardName) }).click()

  await page.getByRole('button', { name: 'Nova compra' }).click()
  const form = page.getByRole('dialog', { name: 'Compra no cartão' })
  await form.getByLabel('Descrição', { exact: true }).fill(purchase)
  await form.getByLabel('Valor da parcela', { exact: true }).fill('120')
  await form.getByRole('button', { name: 'Lançar compra' }).click()
  await expect(
    page.getByRole('dialog', { name: purchase }).getByText(new RegExp(`de ${partyName}`)),
  ).toBeVisible()

  const parties = await apiGet<{ code: string; name: string }[]>(request, '/third_party')
  const party = parties.find((candidate) => candidate.name === partyName)
  expect(party).toBeDefined()
  const receivables = await apiGet<Receivable[]>(request, `/third_party/${party!.code}/receivables`)
  expect(receivables).toHaveLength(1)
  expect(receivables[0]?.amount).toBe(120)

  // And they show up as owing it on the list.
  await page.goto('/carteira/terceiros')
  await expect(page.getByRole('listitem').filter({ hasText: partyName })).toContainText(
    /A receber R\$\s120,00/,
  )
})

test('registers a receipt from the third party: the account gets the money and the receivable shrinks', async ({
  page,
  request,
}) => {
  const partyName = unique('Terceiro')
  const cardName = unique('Cartão Recebível')
  const accountName = unique('Conta Recebe')
  const purchase = unique('Mercado')

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

  await page.goto('/carteira/terceiros')
  await page.getByRole('button', { name: 'Novo terceiro' }).click()
  const partyForm = page.getByRole('dialog', { name: 'Novo terceiro' })
  await partyForm.getByLabel('Nome', { exact: true }).fill(partyName)
  await partyForm.getByRole('button', { name: 'Cadastrar terceiro' }).click()
  await expect(page.getByText(partyName)).toBeVisible()

  await page.goto('/carteira/cartoes')
  await page.getByRole('button', { name: 'Novo cartão' }).click()
  const card = page.getByRole('dialog', { name: 'Novo cartão' })
  await card.getByLabel('Nome', { exact: true }).fill(cardName)
  await card.getByLabel('Dia do fechamento').fill('10')
  await card.getByLabel('Dia do vencimento').fill('20')
  await card.getByRole('combobox', { name: /Terceiro padrão/ }).click()
  await page.getByRole('option', { name: partyName }).click()
  await card.getByRole('button', { name: 'Criar cartão' }).click()
  await page.getByRole('link', { name: new RegExp(cardName) }).click()
  await page.getByRole('button', { name: 'Nova compra' }).click()
  const form = page.getByRole('dialog', { name: 'Compra no cartão' })
  await form.getByLabel('Descrição', { exact: true }).fill(purchase)
  await form.getByLabel('Valor da parcela', { exact: true }).fill('120')
  await form.getByRole('button', { name: 'Lançar compra' }).click()
  await expect(page.getByRole('dialog', { name: purchase })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.goto('/carteira/terceiros')
  await page.getByRole('link', { name: new RegExp(partyName) }).click()
  await expect(page.getByRole('heading', { name: partyName })).toBeVisible()
  await expect(page.getByText(/A receber R\$\s120,00/)).toBeVisible()

  await page.getByRole('button', { name: 'Registrar recebimento' }).click()
  const receipt = page.getByRole('dialog', { name: 'Registrar recebimento' })
  await receipt.getByLabel('Valor recebido').fill('50')
  await receipt.getByRole('combobox', { name: /Conta que recebeu/ }).click()
  await page.getByRole('option', { name: new RegExp(accountName) }).click()
  await receipt.getByRole('button', { name: 'Registrar recebimento' }).click()
  await expect(page.getByText(/Recebimento de R\$\s50,00 registrado/)).toBeVisible()

  await expect.poll(() => accountBalance(request, accountCode)).toBeCloseTo(1050, 2)
  const parties = await apiGet<{ code: string; name: string }[]>(request, '/third_party')
  const party = parties.find((candidate) => candidate.name === partyName)
  const receivables = await apiGet<Receivable[]>(request, `/third_party/${party!.code}/receivables`)
  expect(receivables[0]?.received_amount).toBe(50)
  expect(receivables[0]?.remaining_amount).toBe(70)
})

test('writes off what a third party owes: the receivable closes and no account moves', async ({
  page,
  request,
}) => {
  const partyName = unique('Terceiro')
  const cardName = unique('Cartão Baixa')
  const purchase = unique('Presente')

  await page.goto('/carteira/terceiros')
  await page.getByRole('button', { name: 'Novo terceiro' }).click()
  const partyForm = page.getByRole('dialog', { name: 'Novo terceiro' })
  await partyForm.getByLabel('Nome', { exact: true }).fill(partyName)
  await partyForm.getByRole('button', { name: 'Cadastrar terceiro' }).click()
  await expect(page.getByText(partyName)).toBeVisible()

  await page.goto('/carteira/cartoes')
  await page.getByRole('button', { name: 'Novo cartão' }).click()
  const card = page.getByRole('dialog', { name: 'Novo cartão' })
  await card.getByLabel('Nome', { exact: true }).fill(cardName)
  await card.getByLabel('Dia do fechamento').fill('10')
  await card.getByLabel('Dia do vencimento').fill('20')
  await card.getByRole('combobox', { name: /Terceiro padrão/ }).click()
  await page.getByRole('option', { name: partyName }).click()
  await card.getByRole('button', { name: 'Criar cartão' }).click()
  await page.getByRole('link', { name: new RegExp(cardName) }).click()
  await page.getByRole('button', { name: 'Nova compra' }).click()
  const form = page.getByRole('dialog', { name: 'Compra no cartão' })
  await form.getByLabel('Descrição', { exact: true }).fill(purchase)
  await form.getByLabel('Valor da parcela', { exact: true }).fill('90')
  await form.getByRole('button', { name: 'Lançar compra' }).click()
  await expect(page.getByRole('dialog', { name: purchase })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.goto('/carteira/terceiros')
  await page.getByRole('link', { name: new RegExp(partyName) }).click()
  await page.getByRole('button', { name: /^Dar baixa em / }).click()
  const sheet = page.getByRole('dialog', { name: 'Dar baixa' })
  await expect(sheet.getByText(/Perdas com terceiros/)).toBeVisible()
  await sheet.getByRole('button', { name: /Dar baixa em R\$\s90,00/ }).click()
  await expect(page.getByText(/Baixa de R\$\s90,00 registrada/)).toBeVisible()

  const parties = await apiGet<{ code: string; name: string }[]>(request, '/third_party')
  const party = parties.find((candidate) => candidate.name === partyName)
  const receivables = await apiGet<Receivable[]>(request, `/third_party/${party!.code}/receivables`)
  expect(receivables[0]?.status).toBe('WRITTEN_OFF')
  expect(receivables[0]?.remaining_amount).toBe(0)
  await expect(page.getByText('Baixado')).toBeVisible()
})
