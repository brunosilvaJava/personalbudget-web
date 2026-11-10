import { expect, test } from '@playwright/test'

import { apiGet, unique } from './helpers'

interface Receivable {
  amount: number
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
