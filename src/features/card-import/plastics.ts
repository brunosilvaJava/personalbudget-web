import type { CreditCardHolderResponse, UUID } from '@/api/contracts'
import type { ImportLine } from './parsers'

export interface NewPlastic {
  lastDigits: string
  /** names printed on the plastic in the file */
  names: string[]
  count: number
}

/** The plastics the file mentions that the card does not have yet, in order of appearance. */
export function findNewPlastics(lines: ImportLine[], known: Set<string>): NewPlastic[] {
  const found = new Map<string, NewPlastic>()
  for (const line of lines) {
    if (!line.lastDigits || known.has(line.lastDigits)) continue
    const entry = found.get(line.lastDigits) ?? { lastDigits: line.lastDigits, names: [], count: 0 }
    entry.count++
    if (line.holderName && !entry.names.includes(line.holderName)) entry.names.push(line.holderName)
    found.set(line.lastDigits, entry)
  }
  return [...found.values()]
}

const plain = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/** The holder whose name is the one printed on the plastic; the TITULAR when none is. */
export function guessHolder(
  plastic: NewPlastic,
  holders: CreditCardHolderResponse[],
): UUID | undefined {
  const byName = holders.find((holder) =>
    plastic.names.some((name) => plain(name) === plain(holder.name)),
  )
  return (byName ?? holders.find((holder) => holder.kind === 'TITULAR') ?? holders[0])?.code
}
