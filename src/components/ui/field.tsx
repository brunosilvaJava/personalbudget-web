import * as React from 'react'

import { cn } from '@/lib/utils'
import { Label } from './label'

interface FieldProps {
  /** id of the control, so the label and the error point to it */
  id: string
  label: React.ReactNode
  /** the field error from react-hook-form (local zod rule or the 400 of the API) */
  error?: string
  /** a hint below the control, hidden while there is an error */
  description?: React.ReactNode
  className?: string
  /** receives the aria props to spread on the control */
  children: (aria: {
    id: string
    'aria-invalid': boolean
    'aria-describedby': string | undefined
  }) => React.ReactNode
}

/**
 * Label, control and message, wired for screen readers. The error replaces the hint, so the
 * sheet does not jump twice.
 */
function Field({ id, label, error, description, className, children }: FieldProps) {
  const messageId = `${id}-message`
  const hasMessage = Boolean(error || description)
  return (
    <div data-slot="field" className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': hasMessage ? messageId : undefined,
      })}
      {error ? (
        <p id={messageId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        description && (
          <p id={messageId} className="text-sm text-muted-foreground">
            {description}
          </p>
        )
      )}
    </div>
  )
}

export { Field }
