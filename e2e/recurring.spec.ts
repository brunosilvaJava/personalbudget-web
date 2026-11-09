import { expect, test } from '@playwright/test'

import { apiGet, todayIso, unique } from './helpers'

interface MovementPage {
  content: { description: string; recurrence_bill_code: string | null }[]
}

test('a monthly bill due today is posted as soon as it is saved, once', async ({
  page,
  request,
}) => {
  const description = unique('Internet')
  const today = todayIso()
  const day = Number(today.slice(8, 10))

  await page.goto('/recorrentes/fixas')
  await page.getByRole('button', { name: 'Nova conta fixa' }).click()
  const sheet = page.getByRole('dialog', { name: 'Nova conta fixa' })
  await sheet.getByLabel('Descrição', { exact: true }).fill(description)
  await sheet.getByLabel('Valor', { exact: true }).fill('119,90')
  await sheet.getByRole('button', { name: `Dia ${day}`, exact: true }).click()
  await sheet.getByRole('button', { name: 'Criar conta fixa' }).click()

  await expect(
    page.getByText(/o lançamento de hoje já foi gerado\. Não lance de novo\./),
  ).toBeVisible()

  // The movement is there without waiting for the midnight job, and it is only one.
  const posted = await apiGet<MovementPage>(request, '/financial_movement', {
    start_date: `${today.slice(0, 8)}01`,
    end_date: today,
    description,
  })
  expect(posted.content).toHaveLength(1)
  expect(posted.content[0]?.recurrence_bill_code).not.toBeNull()

  await page.goto('/movimentacoes')
  await expect(page.getByRole('button', { name: new RegExp(description) })).toBeVisible()
})
