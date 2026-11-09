import { expect, type APIRequestContext } from '@playwright/test'

const TIME_ZONE = 'America/Sao_Paulo'

/** Today in Brasília, "yyyy-mm-dd". */
export function todayIso(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: TIME_ZONE })
}

/** A name nobody else used: the database is shared by every spec and every viewport. */
export function unique(label: string): string {
  const stamp = Date.now().toString(36).slice(-4)
  const salt = Math.random().toString(36).slice(2, 5)
  return `${label} ${stamp}${salt}`
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const signedCurrency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  signDisplay: 'exceptZero',
})

/** 1234.5 → "R$ 1.234,50", the way the app shows it. */
export const money = (value: number) => currency.format(value)
/** The same with a sign: -50 → "-R$ 50,00". */
export const signedMoney = (value: number) => signedCurrency.format(value)

/** Regex for a text that holds `value` as money; the space after "R$" is a no-break space. */
export function moneyPattern(value: number): RegExp {
  const escaped = money(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(escaped.replace(/\s/g, '\\s'))
}

/** GET on the API through the app's own `/api` proxy. */
export async function apiGet<T>(
  request: APIRequestContext,
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const response = await request.get(`/api${path}`, { params })
  expect(response.ok(), `GET ${path} answered ${response.status()}`).toBe(true)
  return (await response.json()) as T
}

/** The sum of the active accounts today, from the API. */
export async function totalBalance(request: APIRequestContext): Promise<number> {
  const { total } = await apiGet<{ total: number }>(request, '/account/balance')
  return total
}

/** The balance of one account today, from the API. */
export async function accountBalance(request: APIRequestContext, code: string): Promise<number> {
  const { balance } = await apiGet<{ balance: number }>(request, `/account/${code}/balance`)
  return balance
}

/** The code of the account with this name. */
export async function accountCodeByName(request: APIRequestContext, name: string): Promise<string> {
  const accounts = await apiGet<{ code: string; name: string }[]>(request, '/account')
  const found = accounts.find((account) => account.name === name)
  expect(found, `account "${name}" in GET /account`).toBeDefined()
  return found!.code
}

const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

/** The month `offset` months from `month` ("2026-11" + 2 → "2027-01"). */
export function shiftMonth(month: string, offset: number): string {
  const [year, number] = month.split('-').map(Number) as [number, number]
  const index = year * 12 + (number - 1) + offset
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

/** "2026-12" → "dezembro de 2026", the way the app writes a month. */
export function monthLabel(month: string): string {
  const [year, number] = month.split('-').map(Number) as [number, number]
  return `${MONTH_NAMES[number - 1]} de ${year}`
}

/** "2026-12-28" → "28/12/2026". */
export function brDate(date: string): string {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}
