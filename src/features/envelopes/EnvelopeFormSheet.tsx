import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'

import type { BudgetEnvelopeResponse, UUID } from '@/api/contracts'
import { FormAlert } from '@/components/domain/FormAlert'
import { MoneyInput } from '@/components/domain/MoneyInput'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { CategorySelect } from '@/features/categories/CategorySelect'
import { applyApiErrors } from '@/lib/api-errors'
import { useOnline } from '@/lib/online'
import { useCreateEnvelope, useUpdateEnvelope } from './queries'
import {
  ENVELOPE_FIELDS,
  envelopeDefaults,
  envelopeSchema,
  toEnvelopeRequest,
  toEnvelopeUpdate,
  type EnvelopeFormInput,
  type EnvelopeFormValues,
} from './schema'

interface EnvelopeFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cycleCode: UUID
  /** editing this envelope (only the amount changes); creating when absent */
  envelope?: BudgetEnvelopeResponse
  /** categories that already have an envelope in the cycle (the back refuses a second one) */
  takenCategories: ReadonlySet<UUID>
}

export function EnvelopeFormSheet({
  open,
  onOpenChange,
  cycleCode,
  envelope,
  takenCategories,
}: EnvelopeFormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {envelope ? `Envelope de ${envelope.category_name}` : 'Novo envelope'}
          </SheetTitle>
          <SheetDescription>
            {envelope
              ? 'Só o valor do envelope pode mudar; para trocar a categoria, exclua e crie outro.'
              : 'Quanto você pretende gastar numa categoria neste ciclo. Só categorias de despesa.'}
          </SheetDescription>
        </SheetHeader>
        {open && (
          <EnvelopeForm
            cycleCode={cycleCode}
            envelope={envelope}
            takenCategories={takenCategories}
            onDone={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function EnvelopeForm({
  cycleCode,
  envelope,
  takenCategories,
  onDone,
}: {
  cycleCode: UUID
  envelope?: BudgetEnvelopeResponse
  takenCategories: ReadonlySet<UUID>
  onDone: () => void
}) {
  const online = useOnline()
  const create = useCreateEnvelope()
  const update = useUpdateEnvelope()
  const pending = create.isPending || update.isPending
  const [formError, setFormError] = useState<string | null>(null)
  const { control, handleSubmit, setError } = useForm<
    EnvelopeFormInput,
    unknown,
    EnvelopeFormValues
  >({ resolver: zodResolver(envelopeSchema), defaultValues: envelopeDefaults(envelope) })

  const onError = (error: unknown) => setFormError(applyApiErrors(error, setError, ENVELOPE_FIELDS))

  // The toast comes from the hook; the list this refreshes may take this sheet off the screen
  // before an answer callback runs, so closing goes through the promise, not through `mutate`.
  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    const request = envelope
      ? update.mutateAsync({ code: envelope.code, body: toEnvelopeUpdate(values) })
      : create.mutateAsync({ cycleCode, body: toEnvelopeRequest(values) })
    void request.then(onDone, onError)
  })

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="contents" noValidate>
      <SheetBody>
        {envelope ? (
          <p className="text-sm">
            Categoria: <strong>{envelope.category_name}</strong>
          </p>
        ) : (
          <Controller
            control={control}
            name="category_code"
            render={({ field, fieldState }) => (
              <Field id="envelope-category" label="Categoria" error={fieldState.error?.message}>
                {(aria) => (
                  <CategorySelect
                    {...aria}
                    value={field.value || null}
                    onChange={(code) => field.onChange(code ?? '')}
                    operationType="DEBIT"
                    allowNone={false}
                    excludeCodes={takenCategories}
                  />
                )}
              </Field>
            )}
          />
        )}
        <Controller
          control={control}
          name="planned_amount"
          render={({ field, fieldState }) => (
            <Field id="envelope-amount" label="Valor planejado" error={fieldState.error?.message}>
              {(aria) => (
                <MoneyInput
                  {...aria}
                  ref={field.ref}
                  name={field.name}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="0,00"
                />
              )}
            </Field>
          )}
        />
        {formError && <FormAlert message={formError} />}
      </SheetBody>
      <SheetFooter className="sticky bottom-0 border-t bg-background">
        <Button type="submit" className="h-12 text-base" disabled={pending || !online}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden />}
          {envelope ? 'Salvar' : 'Criar envelope'}
        </Button>
      </SheetFooter>
    </form>
  )
}
