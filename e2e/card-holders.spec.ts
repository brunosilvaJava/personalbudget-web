import { expect, test } from '@playwright/test'

import { apiGet, unique } from './helpers'

interface Holder {
  code: string
  name: string
  kind: string
}

test('adds an additional holder and a plastic, and a purchase made with that plastic shows who used the card', async ({
  page,
  request,
}) => {
  const cardName = unique('Cartão Adicional')
  const holderName = unique('Márcia')
  const digits = String(1000 + Math.floor(Math.random() * 9000))
  const purchase = unique('Mercado')

  await page.goto('/carteira/cartoes')
  await page.getByRole('button', { name: 'Novo cartão' }).click()
  const card = page.getByRole('dialog', { name: 'Novo cartão' })
  await card.getByLabel('Nome', { exact: true }).fill(cardName)
  await card.getByLabel('Dia do fechamento').fill('10')
  await card.getByLabel('Dia do vencimento').fill('20')
  await card.getByRole('button', { name: 'Criar cartão' }).click()
  await page.getByRole('link', { name: new RegExp(cardName) }).click()
  const cardCode = /\/carteira\/cartoes\/([^/?]+)/.exec(page.url())?.[1] ?? ''
  expect(cardCode).not.toBe('')

  // The back creates the TITULAR with the card.
  const section = page.getByRole('region', { name: 'Titulares e plásticos' })
  await expect(section.getByText('titular', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Novo titular' }).click()
  const holderForm = page.getByRole('dialog', { name: 'Novo titular' })
  await holderForm.getByLabel('Nome', { exact: true }).fill(holderName)
  await holderForm.getByRole('button', { name: 'Adicionar titular' }).click()
  await expect(section.getByText(holderName)).toBeVisible()

  await page.getByRole('button', { name: 'Novo plástico' }).click()
  const plasticForm = page.getByRole('dialog', { name: 'Novo plástico' })
  await plasticForm.getByRole('combobox', { name: 'Titular' }).click()
  await page.getByRole('option', { name: holderName }).click()
  await plasticForm.getByLabel('Últimos 4 dígitos').fill(digits)
  await plasticForm.getByRole('button', { name: 'Cadastrar plástico' }).click()
  await expect(
    section.getByRole('button', { name: `Editar plástico final ${digits}` }),
  ).toBeVisible()

  // A purchase made with that plastic belongs to its holder.
  await page.getByRole('button', { name: 'Nova compra' }).click()
  const form = page.getByRole('dialog', { name: 'Compra no cartão' })
  await form.getByLabel('Descrição', { exact: true }).fill(purchase)
  await form.getByLabel('Valor da parcela', { exact: true }).fill('80')
  await form.getByRole('combobox', { name: /Quem usou o cartão/ }).click()
  await page.getByRole('option', { name: new RegExp(`final ${digits}`) }).click()
  await form.getByRole('button', { name: 'Lançar compra' }).click()
  const bought = page.getByRole('dialog', { name: purchase })
  await expect(bought.getByText(new RegExp(`${holderName} \\(final ${digits}\\)`))).toBeVisible()

  const holders = await apiGet<Holder[]>(request, `/credit_card/${cardCode}/holder`)
  expect(holders.map((holder) => holder.kind)).toEqual(['TITULAR', 'ADICIONAL'])
})
