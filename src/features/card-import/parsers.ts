import type { ISODate, Money } from '@/api/contracts'
import { parseCsv } from './csv'

export type StatementBank = 'NUBANK' | 'C6'

/** One purchase of the statement, as it would be sent to POST /card_purchase/batch. */
export interface ImportLine {
  /** the row of the file (1 = the first row after the header), the stable identity of the line */
  id: number
  description: string
  /** the date of the file: the back reads it as the date of the purchase (see shiftBack) */
  purchaseDate: ISODate
  installments: number
  /** 1 unless the statement shows "k/N" */
  firstInstallment: number
  /** the value of EACH installment, in reais */
  installmentAmount: Money
  /** the plastic, when the bank says it (C6) */
  lastDigits: string | null
  /** the name printed on the plastic, when the bank says it (C6) */
  holderName: string | null
  /** C6: the purchase was made in another currency (the value used is already the one in R$) */
  international: boolean
}

export type SkipReason = 'PAYMENT' | 'CREDIT' | 'ZERO' | 'INVALID'

/** A row that is not a purchase: shown apart, never sent. */
export interface SkippedLine {
  id: number
  date: string
  description: string
  /** negative for a payment or a credit */
  amount: Money | null
  reason: SkipReason
}

export interface ParsedStatement {
  bank: StatementBank
  lines: ImportLine[]
  skipped: SkippedLine[]
}

export class StatementParseError extends Error {}

const NUBANK_HEADER = ['date', 'title', 'amount']
const C6_FIRST_COLUMN = 'data de compra'

/** The bank is told by the header of the file. */
export function detectBank(rows: string[][]): StatementBank | null {
  const header = rows[0]?.map((value) => value.trim().toLowerCase()) ?? []
  if (NUBANK_HEADER.every((name, index) => header[index] === name)) return 'NUBANK'
  if (header[0] === C6_FIRST_COLUMN) return 'C6'
  return null
}

export function parseStatement(text: string): ParsedStatement {
  const rows = parseCsv(text)
  const bank = detectBank(rows)
  if (bank === null) {
    throw new StatementParseError(
      'Não reconheci o arquivo. Use o CSV da fatura do Nubank ou do C6, sem alterar o cabeçalho.',
    )
  }
  const body = rows.slice(1)
  return bank === 'NUBANK' ? parseNubank(body) : parseC6(body)
}

// ───────────────────────── common ─────────────────────────

/** "  GITHUB,   INC.  SA " → "GITHUB, INC. SA", at most 100 chars (the limit of the API). */
export function cleanDescription(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim().slice(0, 100)
}

/** "1.234,56", "50,00", "- 4.664,49" → 1234.56, 50, -4664.49. */
export function parseBrazilianMoney(value: string): Money | null {
  const text = value.replace(/\s+/g, '')
  if (!/^-?\d{1,3}(\.\d{3})*(,\d{1,2})?$|^-?\d+(,\d{1,2})?$/.test(text)) return null
  return Math.round(Number(text.replace(/\./g, '').replace(',', '.')) * 100) / 100
}

/** "160.00", "-8394.06" → 160, -8394.06. */
export function parseDotMoney(value: string): Money | null {
  const text = value.trim()
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) return null
  return Math.round(Number(text) * 100) / 100
}

function isPayment(description: string): boolean {
  return /pagamento/i.test(description)
}

function skip(
  id: number,
  date: string,
  description: string,
  amount: Money | null,
  reason: SkipReason,
): SkippedLine {
  return { id, date, description, amount, reason }
}

/** The way a negative or empty value is skipped; null when the row is a purchase to import. */
function skipReason(amount: Money, description: string): SkipReason | null {
  if (amount === 0) return 'ZERO'
  if (amount < 0) return isPayment(description) ? 'PAYMENT' : 'CREDIT'
  return null
}

// ───────────────────────── Nubank ─────────────────────────

const NUBANK_INSTALLMENT = /\s*-\s*Parcela\s+(\d+)\/(\d+)\s*$/i

/** date,title,amount — ISO date, amount "1.234,56", installments as a "- Parcela k/N" suffix. */
function parseNubank(rows: string[][]): ParsedStatement {
  const lines: ImportLine[] = []
  const skipped: SkippedLine[] = []

  rows.forEach((row, index) => {
    const id = index + 1
    const [date = '', title = '', rawAmount = ''] = row.map((value) => value.trim())
    const amount = parseBrazilianMoney(rawAmount)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || amount === null || title === '') {
      skipped.push(skip(id, date, title, amount, 'INVALID'))
      return
    }
    const reason = skipReason(amount, title)
    if (reason) {
      skipped.push(skip(id, date, cleanDescription(title), amount, reason))
      return
    }
    const installment = NUBANK_INSTALLMENT.exec(title)
    const first = installment ? Number(installment[1]) : 1
    const count = installment ? Number(installment[2]) : 1
    if (first < 1 || count < first || count > 60) {
      skipped.push(skip(id, date, title, amount, 'INVALID'))
      return
    }
    lines.push({
      id,
      description: cleanDescription(title.replace(NUBANK_INSTALLMENT, '')),
      purchaseDate: date,
      installments: count,
      firstInstallment: first,
      installmentAmount: amount,
      lastDigits: null,
      holderName: null,
      international: false,
    })
  })
  return { bank: 'NUBANK', lines, skipped }
}

// ───────────────────────── C6 ─────────────────────────

/**
 * Data de Compra, Nome no Cartão, Final do Cartão, Categoria, Descrição, Parcela, Valor (em US$),
 * Cotação (em R$), Valor (em R$), (a trailing comma). The description is not quoted, so one with a
 * comma ("GITHUB, INC. SA") has more fields: the first 4 and the last 4 (after dropping an empty
 * last one) are fixed, and what is left in the middle is the description.
 */
function parseC6(rows: string[][]): ParsedStatement {
  const lines: ImportLine[] = []
  const skipped: SkippedLine[] = []

  rows.forEach((raw, index) => {
    const id = index + 1
    const fields = [...raw]
    if (fields.length > 0 && fields[fields.length - 1]?.trim() === '') fields.pop()
    if (fields.length < 9) {
      skipped.push(skip(id, '', fields.join(','), null, 'INVALID'))
      return
    }
    const [rawDate = '', holderName = '', digits = ''] = fields.map((value) => value.trim())
    const [rawInstallments = '', rawUsd = '', , rawBrl = ''] = fields
      .slice(-4)
      .map((value) => value.trim())
    const description = cleanDescription(fields.slice(4, -4).join(','))

    const date = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(rawDate)
    const amount = parseDotMoney(rawBrl)
    if (!date || amount === null || description === '') {
      skipped.push(skip(id, rawDate, description, amount, 'INVALID'))
      return
    }
    const isoDate = `${date[3]}-${date[2]}-${date[1]}`
    const reason = skipReason(amount, description)
    if (reason) {
      skipped.push(skip(id, isoDate, description, amount, reason))
      return
    }
    const plan = /^(\d+)\/(\d+)$/.exec(rawInstallments)
    const single = /^[uú]nica$/i.test(rawInstallments)
    const first = plan ? Number(plan[1]) : 1
    const count = plan ? Number(plan[2]) : 1
    if ((!plan && !single) || first < 1 || count < first || count > 60) {
      skipped.push(skip(id, isoDate, description, amount, 'INVALID'))
      return
    }
    const usd = parseDotMoney(rawUsd)
    lines.push({
      id,
      description,
      purchaseDate: isoDate,
      installments: count,
      firstInstallment: first,
      installmentAmount: amount,
      lastDigits: /^\d{4}$/.test(digits) ? digits : null,
      holderName: holderName || null,
      international: usd !== null && usd !== 0,
    })
  })
  return { bank: 'C6', lines, skipped }
}

// ───────────────────────── helpers for the preview ─────────────────────────

/**
 * The same day `months` months earlier (the last day of the month when it does not exist). The back
 * dates installment k as the purchase date plus k-1 months, so a line that shows the date of the
 * installment (not the date of the purchase) is moved back k-1 months to land in the right invoice.
 */
export function shiftBack(date: ISODate, months: number): ISODate {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 - months, 1))
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, last))
  return target.toISOString().slice(0, 10)
}

const FEE = /anuidade|tarifa/i

/**
 * A fee that the same statement refunds (an annuity of 98,00 and a "Estorno Tarifa" of -98,00):
 * the ids of the lines to leave unchecked, with the credit that cancels each one.
 */
export function pairRefundedFees(
  lines: ImportLine[],
  skipped: SkippedLine[],
): Map<number, SkippedLine> {
  const pairs = new Map<number, SkippedLine>()
  const credits = skipped.filter((line) => line.reason === 'CREDIT' && line.amount !== null)
  for (const credit of credits) {
    const fee = lines.find(
      (line) =>
        !pairs.has(line.id) &&
        FEE.test(line.description) &&
        line.installmentAmount === -(credit.amount ?? 0),
    )
    if (fee) pairs.set(fee.id, credit)
  }
  return pairs
}
