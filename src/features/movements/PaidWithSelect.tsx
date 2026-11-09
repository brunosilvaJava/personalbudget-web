import type { AccountResponse, CreditCardResponse } from '@/api/contracts'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { encodePaidWith } from './paidWith'

interface PaidWithSelectProps {
  id?: string
  value: string
  onChange: (value: string) => void
  accounts: readonly AccountResponse[]
  /** empty for a revenue: it is never received on a card */
  cards: readonly CreditCardResponse[]
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

/** Accounts and cards in one list: "account:<code>" or "card:<code>". */
export function PaidWithSelect({
  id,
  value,
  onChange,
  accounts,
  cards,
  ...aria
}: PaidWithSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} {...aria}>
        <SelectValue placeholder="Conta padrão" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Contas</SelectLabel>
          {accounts.map((account) => (
            <SelectItem
              key={account.code}
              value={encodePaidWith({ kind: 'account', code: account.code })}
            >
              {account.name}
              {account.default ? ' (padrão)' : ''}
            </SelectItem>
          ))}
        </SelectGroup>
        {cards.length > 0 && (
          <SelectGroup>
            <SelectLabel>Cartões</SelectLabel>
            {cards.map((card) => (
              <SelectItem key={card.code} value={encodePaidWith({ kind: 'card', code: card.code })}>
                {card.name}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  )
}
