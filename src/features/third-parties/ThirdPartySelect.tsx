import type { UUID } from '@/api/contracts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useActiveThirdParties, useThirdPartyLookup } from './queries'

/** Radix Select does not accept an empty value, so "none" gets a stand-in. */
const NONE = '__none__'

interface ThirdPartySelectProps {
  id?: string
  value: UUID | null
  onChange: (code: UUID | null) => void
  /** text of the option that clears the choice */
  noneLabel: string
  disabled?: boolean
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

/** The ACTIVE third parties, plus the chosen one if it was inactivated since. */
export function ThirdPartySelect({
  id,
  value,
  onChange,
  noneLabel,
  disabled,
  ...aria
}: ThirdPartySelectProps) {
  const active = useActiveThirdParties()
  const lookup = useThirdPartyLookup()
  const chosen = value ? lookup.get(value) : undefined
  const options = (active.data ?? []).slice()
  if (chosen && !options.some((party) => party.code === chosen.code)) options.push(chosen)

  return (
    <Select
      value={value ?? NONE}
      onValueChange={(next) => onChange(next === NONE ? null : next)}
      disabled={disabled || active.isPending}
    >
      <SelectTrigger id={id} {...aria}>
        <SelectValue placeholder={active.isPending ? 'Carregando…' : noneLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{noneLabel}</SelectItem>
        {options.map((party) => (
          <SelectItem key={party.code} value={party.code}>
            {party.name}
            {party.status === 'INACTIVE' ? ' (inativo)' : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
