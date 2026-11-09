import type { Money } from '@/api/contracts'

/**
 * Money is typed and kept in integer CENTS in the forms, and turned into reais only for the API,
 * so sums never meet floating point (0.1 + 0.2).
 */

/** 12.5 → 1250. Rounds, so a value that came from the API as 0.29 does not become 28.999… */
export function toCents(value: Money): number {
  return Math.round(value * 100)
}

/** 1250 → 12.5, the BigDecimal the API expects. */
export function fromCents(cents: number): Money {
  return Math.round(cents) / 100
}

/**
 * What the person typed → cents, or null when it is not a number.
 *
 * Accepts "8", "8,5", "8,50", "8.50", "1.234,56", "1,234.56" and "R$ 1.234,56". The LAST
 * separator followed by one or two digits is the decimal one; any other separator groups
 * thousands ("1.234" is 1234). Some Android number pads only have ".", so both work.
 */
export function parseMoneyInput(text: string): number | null {
  const cleaned = text.replace(/[^\d.,-]/g, '')
  if (!/\d/.test(cleaned) || cleaned.includes('-')) return null

  const match = /^(.*?)[.,](\d{1,2})$/.exec(cleaned)
  const integerPart = (match ? match[1]! : cleaned).replace(/[.,]/g, '')
  const decimalPart = match ? match[2]!.padEnd(2, '0') : '00'
  if (integerPart === '' && !match) return null

  const cents = Number(integerPart || '0') * 100 + Number(decimalPart)
  return Number.isSafeInteger(cents) ? cents : null
}

const editable = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** 123456 → "1.234,56": what the input shows when not being typed in. */
export function formatCentsForInput(cents: number): string {
  return editable.format(cents / 100)
}
