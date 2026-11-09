import { expect, test } from '@playwright/test'

import { apiGet, todayIso, unique } from './helpers'

interface MovementPage {
  content: { description: string; recurrence_bill_code: string | null }[]
}

async function createMonthlyBill(
  page: import('@playwright/test').Page,
  description: string,
  day: number,
) {
  await page.goto('/recorrentes/fixas')
  await page.getByRole('button', { name: 'Nova conta fixa' }).click()
  const sheet = page.getByRole('dialog', { name: 'Nova conta fixa' })
  await sheet.getByLabel('Descrição', { exact: true }).fill(description)
  await sheet.getByLabel('Valor', { exact: true }).fill('119,90')
  await sheet.getByRole('button', { name: `Dia ${day}`, exact: true }).click()
  await sheet.getByRole('button', { name: 'Criar conta fixa' }).click()
}

function postedThisMonth(
  request: import('@playwright/test').APIRequestContext,
  description: string,
) {
  const today = todayIso()
  return apiGet<MovementPage>(request, '/financial_movement', {
    start_date: `${today.slice(0, 8)}01`,
    end_date: today,
    description,
  })
}

test('a monthly bill due today is posted as soon as it is saved, once', async ({
  page,
  request,
}) => {
  const description = unique('Internet')
  await createMonthlyBill(page, description, Number(todayIso().slice(8, 10)))

  await expect(
    page.getByText(/o lançamento de hoje já foi gerado\. Não lance de novo\./),
  ).toBeVisible()

  // The movement is there without waiting for the midnight job, and it is only one.
  const posted = await postedThisMonth(request, description)
  expect(posted.content).toHaveLength(1)
  expect(posted.content[0]?.recurrence_bill_code).not.toBeNull()

  await page.goto('/movimentacoes')
  await expect(page.getByRole('button', { name: new RegExp(description) })).toBeVisible()
})

test('a monthly bill due another day posts nothing today and says when the next one comes', async ({
  page,
  request,
}) => {
  const description = unique('Seguro')
  const today = Number(todayIso().slice(8, 10))
  await createMonthlyBill(page, description, today === 15 ? 16 : 15)

  await expect(
    page.getByText(/Conta fixa criada\. Próximo lançamento: \d{2}\/\d{2}\/\d{4}/),
  ).toBeVisible()
  await expect(page.getByText(/o lançamento de hoje já foi gerado/)).toHaveCount(0)
  expect((await postedThisMonth(request, description)).content).toHaveLength(0)

  await expect(page.getByText(description)).toBeVisible()
})
