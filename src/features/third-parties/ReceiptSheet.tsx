import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import type { ReceiptRequest, ThirdPartyResponse } from '@/api/contracts'
import { FormAlert } from '@/components/domain/FormAlert'
import { MoneyInput } from '@/components/domain/MoneyInput'
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
import { amountSchema } from '@/features/movements/schema'
import { AccountSelect } from '@/features/wallet/AccountSelect'
import { applyApiErrors } from '@/lib/api-errors'
import { todayIso } from '@/lib/dates'
import { formatMoney } from '@/lib/format'
import { fromCents, toCents } from '@/lib/money'
import { useOnline } from '@/lib/online'
import { useReceive } from './receivableQueries'

const schema = z.object({
  /** cents */
  amount: amountSchema,
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data.'),
  account_code: z.string().nullable(),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>
const FIELDS = ['amount', 'effective_date', 'account_code'] as const

interface ReceiptSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  thirdParty: ThirdPartyResponse
  /** what is left to receive, the sum of the receivables still open */
  remaining: number
}

/**
 * Money received from a third party. The back spreads it from the oldest receivable to the newest,
 * one settlement each; the last one can be partial.
 */
export function ReceiptSheet({ open, onOpenChange, thirdParty, remaining }: ReceiptSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Registrar recebimento</SheetTitle>
          <SheetDescription>
            {thirdParty.name} deve {formatMoney(remaining)}. O valor abate do vencimento mais antigo
            para o mais novo.
          </SheetDescription>
        </SheetHeader>
        {open && (
          <ReceiptForm
            thirdParty={thirdParty}
            remaining={remaining}
            onDone={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function ReceiptForm({
  thirdParty,
  remaining,
  onDone,
}: {
  thirdParty: ThirdPartyResponse
  remaining: number
  onDone: () => void
}) {
  const online = useOnline()
  const receive = useReceive()
  const [formError, setFormError] = useState<string | null>(null)
  const { register, control, handleSubmit, setError, formState } = useForm<
    FormInput,
    unknown,
    FormValues
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: toCents(remaining),
      effective_date: todayIso(),
      account_code: null,
    },
  })

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    if (values.amount > toCents(remaining)) {
      setError('amount', { message: `Acima do que falta receber (${formatMoney(remaining)}).` })
      return
    }
    const body: ReceiptRequest = {
      amount: fromCents(values.amount),
      effective_date: values.effective_date,
    }
    if (values.account_code) body.account_code = values.account_code
    receive.mutateAsync({ thirdPartyCode: thirdParty.code, body }).then(
      () => {
        toast.success(`Recebimento de ${formatMoney(body.amount)} registrado.`)
        onDone()
      },
      (error) => setFormError(applyApiErrors(error, setError, FIELDS)),
    )
  })

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="contents" noValidate>
      <SheetBody>
        <Controller
          control={control}
          name="amount"
          render={({ field, fieldState }) => (
            <Field id="receipt-amount" label="Valor recebido" error={fieldState.error?.message}>
              {(aria) => (
                <MoneyInput
                  {...aria}
                  ref={field.ref}
                  name={field.name}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            </Field>
          )}
        />
        <Field
          id="receipt-date"
          label="Data do recebimento"
          error={formState.errors.effective_date?.message}
        >
          {(aria) => <Input {...aria} type="date" {...register('effective_date')} />}
        </Field>
        <Controller
          control={control}
          name="account_code"
          render={({ field, fieldState }) => (
            <Field
              id="receipt-account"
              label="Conta que recebeu (opcional)"
              error={fieldState.error?.message}
              description="Sem escolha, entra na conta padrão."
            >
              {(aria) => <AccountSelect {...aria} value={field.value} onChange={field.onChange} />}
            </Field>
          )}
        />
        {formError && <FormAlert message={formError} />}
      </SheetBody>
      <SheetFooter className="sticky bottom-0 border-t bg-background">
        <Button type="submit" className="h-12 text-base" disabled={receive.isPending || !online}>
          {receive.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
          Registrar recebimento
        </Button>
      </SheetFooter>
    </form>
  )
}
