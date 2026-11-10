import { expect, type APIRequestContext, type Page } from '@playwright/test'

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

/** The date `days` days from `date` ("2026-11-30" + 1 → "2026-12-01"), in plain calendar arithmetic. */
export function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

// ───────────────────────── pay cycles, shared by the specs that need them ─────────────────────────

export interface PayCycleConfig {
  mode: 'CALENDAR_MONTH' | 'PAY_CYCLE'
  anchor_schedule_code: string | null
  activation_date: string | null
  version: number
}

export interface PayCycle {
  code: string
  label: string
  start_date: string
  end_date_exclusive: string
  end_adjusted: boolean
  status: string
  version: number
}

export interface IncomeSchedule {
  code: string
  description: string
}

/** What every spec that creates an anchor schedule calls it, so the clean-up finds them. */
export const ANCHOR_PREFIX = 'Âncora E2E'

/** Turns the cycles off (the cycles that started stay as history) so the other specs see months. */
export async function cyclesOff(request: APIRequestContext) {
  const config = await apiGet<PayCycleConfig>(request, '/pay_cycle_config')
  if (config.mode !== 'PAY_CYCLE') return
  const response = await request.post('/api/pay_cycle_config/deactivation', {
    data: { expected_version: config.version, justification: 'Limpeza do teste E2E' },
  })
  expect(response.ok(), `deactivation answered ${response.status()}`).toBe(true)
}

/**
 * The cycles off and no anchor schedule of the E2E left active: the anchor cannot be inactivated
 * while the cycles are on, and there can be only one active anchor on the shared database.
 */
export async function cleanUpCycles(request: APIRequestContext) {
  await cyclesOff(request)
  const schedules = await apiGet<IncomeSchedule[]>(request, '/income_schedule', {
    status: 'ACTIVE',
  })
  for (const schedule of schedules.filter((item) => item.description.startsWith(ANCHOR_PREFIX))) {
    await request.patch(`/api/income_schedule/${schedule.code}/inactivate`)
  }
}

/**
 * An anchor schedule that pays on a day `daysAhead` days from now, so the first cycle is short and a
 * later activation (the other viewport runs the same specs) can start where it ends, within the 31
 * days the back accepts. "Keep" needs no holiday calendar: the dates are the same on any database.
 */
export async function createAnchor(
  request: APIRequestContext,
  description: string,
  daysAhead = 10,
): Promise<IncomeSchedule> {
  const today = todayIso()
  const created = await request.post('/api/income_schedule', {
    data: {
      description,
      amount: 1000,
      rule_type: 'FIXED_DAY',
      rule_value: Number(shiftDate(today, daysAhead).slice(8)),
      business_week: 'MONDAY_TO_FRIDAY',
      non_business_day_policy: 'KEEP',
      start_month: today.slice(0, 7),
      anchor: true,
    },
  })
  expect(
    created.ok(),
    `POST /income_schedule answered ${created.status()}: ${await created.text()}`,
  ).toBe(true)
  return (await created.json()) as IncomeSchedule
}

/** The first day an activation may use: today, or the end of the last cycle that exists. */
export async function firstActivationDay(request: APIRequestContext): Promise<string> {
  const today = todayIso()
  const history = await apiGet<PayCycle[]>(request, '/pay_cycle')
  const lastEnd = history
    .map((cycle) => cycle.end_date_exclusive)
    .sort()
    .at(-1)
  return lastEnd && lastEnd > today ? lastEnd : today
}

/**
 * Activates the cycles through the API (preview, then the version it answered) and returns the
 * chain. Without `initialDate` it starts where an activation may (today, or the end of the last
 * cycle); a past one is only accepted up to 31 days back and not before the end of the last cycle.
 */
export async function activateCycles(
  request: APIRequestContext,
  initialDate?: string,
): Promise<PayCycle[]> {
  const firstDay = initialDate ?? (await firstActivationDay(request))
  const preview = await request.post('/api/pay_cycle_config/activation/preview', {
    data: { initial_date: firstDay },
  })
  expect(preview.ok(), `activation preview answered ${preview.status()}`).toBe(true)
  const { expected_version } = (await preview.json()) as { expected_version: number }
  const activation = await request.post('/api/pay_cycle_config/activation', {
    data: { initial_date: firstDay, expected_version },
  })
  expect(activation.ok(), `activation answered ${activation.status()}`).toBe(true)
  const chain = (await apiGet<PayCycle[]>(request, '/pay_cycle'))
    .filter((cycle) => cycle.start_date >= firstDay)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
  expect(chain.length, 'cycles created by the activation').toBeGreaterThanOrEqual(3)
  return chain
}

/**
 * Opens the movements list searching for a description. The database is shared by every spec, so a month
 * soon holds more than one page (20) of movements and a row just launched may not be on the first one.
 */
export async function findInList(page: Page, description: string) {
  await page.goto(`/movimentacoes?busca=${encodeURIComponent(description)}`)
}
