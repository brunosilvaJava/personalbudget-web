import { useState, type ComponentProps } from 'react'

import { Input } from '@/components/ui/input'
import { formatCentsForInput, parseMoneyInput } from '@/lib/money'
import { cn } from '@/lib/utils'

type MoneyInputProps = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  /** integer cents, or null when empty */
  value: number | null
  onChange: (cents: number | null) => void
}

/**
 * Amount typed on the phone's number pad. The form keeps integer CENTS; the text the person types
 * stays as typed while the field has focus and turns into "1.234,56" on blur.
 */
export function MoneyInput({
  value,
  onChange,
  onBlur,
  onFocus,
  className,
  ...props
}: MoneyInputProps) {
  const [text, setText] = useState(() => (value === null ? '' : formatCentsForInput(value)))
  // A value set from outside (a form reset) replaces the text; one that came from typing does not.
  const [synced, setSynced] = useState(value)
  if (value !== synced) {
    setSynced(value)
    if (parseMoneyInput(text) !== value) setText(value === null ? '' : formatCentsForInput(value))
  }

  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground"
      >
        R$
      </span>
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={cn('pl-10 text-right text-lg font-medium tabular-nums', className)}
        value={text}
        onFocus={onFocus}
        onChange={(event) => {
          setText(event.target.value)
          onChange(parseMoneyInput(event.target.value))
        }}
        onBlur={(event) => {
          const cents = parseMoneyInput(event.target.value)
          setText(cents === null ? '' : formatCentsForInput(cents))
          onBlur?.(event)
        }}
      />
    </div>
  )
}
