import type { UUID } from '@/api/contracts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useActiveAccounts } from './queries'

interface AccountSelectProps {
  id?: string
  value: UUID | null
  onChange: (code: UUID) => void
  /** an account that cannot be picked (the origin of a transfer) */
  exclude?: UUID | null
  placeholder?: string
  disabled?: boolean
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

/** ACTIVE accounts, the default one first and marked. */
export function AccountSelect({
  id,
  value,
  onChange,
  exclude,
  placeholder = 'Escolha a conta',
  disabled,
  ...aria
}: AccountSelectProps) {
  const accounts = useActiveAccounts()
  return (
    <Select value={value ?? ''} onValueChange={onChange} disabled={disabled || accounts.isPending}>
      <SelectTrigger id={id} {...aria}>
        <SelectValue placeholder={accounts.isPending ? 'Carregando…' : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {accounts.data
          ?.filter((account) => account.code !== exclude)
          .map((account) => (
            <SelectItem key={account.code} value={account.code}>
              {account.name}
              {account.default ? ' (padrão)' : ''}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  )
}
