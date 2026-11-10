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
import { todayIso } from '@/lib/dates'
import { formatMoney } from '@/lib/format'
import { useOnline } from '@/lib/online'
import { useWriteOff } from './receivableQueries'

const schema = z.object({
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data.'),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

interface WriteOffSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  receivable: ReceivableResponse | null
  thirdPartyName: string
}

/**
 * Giving up on what a third party still owes for one receivable. It is always the WHOLE open
 * balance: it turns into an expense of yours and no cash moves.
 */
export function WriteOffSheet({
  open,
  onOpenChange,
  receivable,
  thirdPartyName,
}: WriteOffSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Dar baixa</SheetTitle>
          <SheetDescription>
            {receivable
              ? `${receivable.description}: ${thirdPartyName} deixa de dever ${formatMoney(receivable.remaining_amount)}.`
              : undefined}
          </SheetDescription>
        </SheetHeader>
        {open && receivable && (
          <WriteOffForm receivable={receivable} onDone={() => onOpenChange(false)} />
        )}
      </SheetContent>
    </Sheet>
  )
}

function WriteOffForm({
  receivable,
  onDone,
}: {
  receivable: ReceivableResponse
  onDone: () => void
}) {
  const online = useOnline()
  const writeOff = useWriteOff()
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, setError, formState } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { effective_date: todayIso() },
  })

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    writeOff
      .mutateAsync({
        thirdPartyCode: receivable.third_party_code,
        receivableCode: receivable.code,
        body: { effective_date: values.effective_date },
      })
      .then(
        () => {
          toast.success(`Baixa de ${formatMoney(receivable.remaining_amount)} registrada.`)
          onDone()
        },
        (error) => setFormError(applyApiErrors(error, setError, ['effective_date'] as const)),
      )
  })

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="contents" noValidate>
      <SheetBody>
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <p>
            A baixa vale para <strong>o saldo inteiro</strong> desta parcela. Vira uma despesa sua
            na categoria “Perdas com terceiros”, na competência da data abaixo, e não mexe em
            nenhuma conta.
          </p>
          <p className="text-muted-foreground">
            Para perdoar só uma parte, registre antes o que ele pagou: a baixa leva o que sobrar.
          </p>
        </div>
        <Field
          id="writeoff-date"
          label="Data da baixa"
          error={formState.errors.effective_date?.message}
        >
          {(aria) => <Input {...aria} type="date" {...register('effective_date')} />}
        </Field>
        {formError && <FormAlert message={formError} />}
      </SheetBody>
      <SheetFooter className="sticky bottom-0 border-t bg-background">
        <Button
          type="submit"
          variant="destructive"
          className="h-12 text-base"
          disabled={writeOff.isPending || !online}
        >
          {writeOff.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
          Dar baixa em {formatMoney(receivable.remaining_amount)}
        </Button>
      </SheetFooter>
    </form>
  )
}
