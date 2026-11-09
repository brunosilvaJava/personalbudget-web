import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { useForm } from 'react-hook-form'

import { FormAlert } from '@/components/domain/FormAlert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { SheetBody, SheetFooter } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { splitFieldError } from '@/lib/api-errors'
import { useOnline } from '@/lib/online'
import { JUSTIFICATION_MAX_LENGTH } from './rules'
import {
  justificationSchema,
  type JustificationFormInput,
  type JustificationFormValues,
} from './schema'

interface JustifiedConfirmProps {
  /** what is about to happen: the preview, or the explanation */
  children: ReactNode
  confirmLabel: string
  destructive?: boolean
  pending: boolean
  /** the write failed: shown under the field and above the buttons */
  error: unknown
  onConfirm: (justification: string) => void
  /** "Voltar" to the previous step; absent when there is none */
  onBack?: () => void
}

/**
 * The last step of a change that goes to the history of the cycles: what will happen, why (required,
 * kept in the history) and the button that writes it.
 */
export function JustifiedConfirm({
  children,
  confirmLabel,
  destructive,
  pending,
  error,
  onConfirm,
  onBack,
}: JustifiedConfirmProps) {
  const online = useOnline()
  const { register, handleSubmit, formState } = useForm<
    JustificationFormInput,
    unknown,
    JustificationFormValues
  >({ resolver: zodResolver(justificationSchema), defaultValues: { justification: '' } })
  const failure = error ? splitFieldError(error, 'justification') : { field: null, message: null }

  return (
    <form
      onSubmit={(event) => void handleSubmit((values) => onConfirm(values.justification))(event)}
      className="contents"
      noValidate
    >
      <SheetBody>
        {children}
        <Field
          id="cycle-justification"
          label="Motivo"
          error={formState.errors.justification?.message ?? failure.field ?? undefined}
          description={`Fica no histórico. Até ${JUSTIFICATION_MAX_LENGTH} letras.`}
        >
          {(aria) => (
            <Textarea
              {...aria}
              maxLength={JUSTIFICATION_MAX_LENGTH}
              placeholder="Ex.: o salário passou a cair no dia 28"
              {...register('justification')}
            />
          )}
        </Field>
        {failure.message && <FormAlert message={failure.message} />}
      </SheetBody>
      <SheetFooter className="sticky bottom-0 border-t bg-background">
        <Button
          type="submit"
          variant={destructive ? 'destructive' : 'default'}
          className="h-12 text-base"
          disabled={pending || !online}
        >
          {pending && <LoaderCircle className="animate-spin" aria-hidden />}
          {confirmLabel}
        </Button>
        {onBack && (
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={onBack}
            disabled={pending}
          >
            Voltar e editar
          </Button>
        )}
      </SheetFooter>
    </form>
  )
}
