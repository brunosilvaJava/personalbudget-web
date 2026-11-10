import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import type { ReceivableResponse } from '@/api/contracts'
import { FormAlert } from '@/components/domain/FormAlert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { applyApiErrors } from '@/lib/api-errors'
import { formatShortDate } from '@/lib/format'
import { useOnline } from '@/lib/online'
import { useUpdateReceivableDueDate } from './receivableQueries'

const schema = z.object({ due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data.') })
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

interface DueDateSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  receivable: ReceivableResponse | null
}

/** The date the third party promised to pay. It does not move the invoice of the card. */
export function DueDateSheet({ open, onOpenChange, receivable }: DueDateSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Alterar vencimento</SheetTitle>
          <SheetDescription>
            {receivable
              ? `${receivable.description}, hoje vence em ${formatShortDate(receivable.due_date)}.`
              : undefined}
          </SheetDescription>
        </SheetHeader>
        {open && receivable && (
          <DueDateForm receivable={receivable} onDone={() => onOpenChange(false)} />
        )}
      </SheetContent>
    </Sheet>
  )
}

function DueDateForm({
  receivable,
  onDone,
}: {
  receivable: ReceivableResponse
  onDone: () => void
}) {
  const online = useOnline()
  const update = useUpdateReceivableDueDate()
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, setError, formState } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { due_date: receivable.due_date },
  })

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    if (values.due_date === receivable.due_date) return onDone()
    update
      .mutateAsync({
        thirdPartyCode: receivable.third_party_code,
        receivableCode: receivable.code,
        body: { due_date: values.due_date },
      })
      .then(
        () => {
          toast.success('Vencimento atualizado.')
          onDone()
        },
        (error) => setFormError(applyApiErrors(error, setError, ['due_date'] as const)),
      )
  })

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="contents" noValidate>
      <SheetBody>
        <Field
          id="receivable-due"
          label="Novo vencimento"
          error={formState.errors.due_date?.message}
        >
          {(aria) => <Input {...aria} type="date" {...register('due_date')} />}
        </Field>
        {formError && <FormAlert message={formError} />}
      </SheetBody>
      <SheetFooter className="sticky bottom-0 border-t bg-background">
        <Button type="submit" className="h-12 text-base" disabled={update.isPending || !online}>
          {update.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
          Salvar
        </Button>
      </SheetFooter>
    </form>
  )
}
