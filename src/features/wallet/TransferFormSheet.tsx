import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import type { UUID } from '@/api/contracts'
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
import { applyApiErrors } from '@/lib/api-errors'
import { todayIso } from '@/lib/dates'
import { formatMoney } from '@/lib/format'
import { useOnline } from '@/lib/online'
import { AccountSelect } from './AccountSelect'
import { useCreateTransfer } from './queries'
import {
  TRANSFER_FIELDS,
  toTransferRequest,
  transferSchema,
  type TransferFormInput,
  type TransferFormValues,
} from './schema'

interface TransferFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** the origin, when opened from an account */
  fromAccountCode?: UUID
}

/** Money between two accounts. Neutral: it is not a movement and never shows in the reports. */
export function TransferFormSheet({ open, onOpenChange, fromAccountCode }: TransferFormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Transferir entre contas</SheetTitle>
          <SheetDescription>
            Muda só o saldo das duas contas: não é despesa nem receita.
          </SheetDescription>
        </SheetHeader>
        {open && (
          <TransferForm fromAccountCode={fromAccountCode} onDone={() => onOpenChange(false)} />
        )}
      </SheetContent>
    </Sheet>
  )
}

function TransferForm({ fromAccountCode, onDone }: { fromAccountCode?: UUID; onDone: () => void }) {
  const online = useOnline()
  const create = useCreateTransfer()
  const [formError, setFormError] = useState<string | null>(null)
  const { register, control, handleSubmit, setError, formState } = useForm<
    TransferFormInput,
    unknown,
    TransferFormValues
  >({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      from_account_code: fromAccountCode ?? '',
      to_account_code: '',
      amount: null as unknown as number,
      effective_date: todayIso(),
      description: '',
    },
  })
  const from = useWatch({ control, name: 'from_account_code' })

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    create.mutate(toTransferRequest(values), {
      onSuccess: (transfer) => {
        toast.success(`Transferência de ${formatMoney(transfer.amount)} registrada.`)
        onDone()
      },
      onError: (error) => setFormError(applyApiErrors(error, setError, TRANSFER_FIELDS)),
    })
  })

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="contents" noValidate>
      <SheetBody>
        <Controller
          control={control}
          name="from_account_code"
          render={({ field, fieldState }) => (
            <Field id="transfer-from" label="De" error={fieldState.error?.message}>
              {(aria) => (
                <AccountSelect {...aria} value={field.value || null} onChange={field.onChange} />
              )}
            </Field>
          )}
        />
        <Controller
          control={control}
          name="to_account_code"
          render={({ field, fieldState }) => (
            <Field id="transfer-to" label="Para" error={fieldState.error?.message}>
              {(aria) => (
                <AccountSelect
                  {...aria}
                  value={field.value || null}
                  onChange={field.onChange}
                  exclude={from || null}
                />
              )}
            </Field>
          )}
        />
        <div className="grid grid-cols-2 gap-3">
          <Controller
            control={control}
            name="amount"
            render={({ field, fieldState }) => (
              <Field id="transfer-amount" label="Valor" error={fieldState.error?.message}>
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
          <Field id="transfer-date" label="Data" error={formState.errors.effective_date?.message}>
            {(aria) => <Input {...aria} type="date" {...register('effective_date')} />}
          </Field>
        </div>
        <Field
          id="transfer-description"
          label="Descrição (opcional)"
          error={formState.errors.description?.message}
        >
          {(aria) => (
            <Input
              {...aria}
              {...register('description')}
              maxLength={100}
              autoComplete="off"
              placeholder="Ex.: Reserva de emergência"
            />
          )}
        </Field>
        {formError && <FormAlert message={formError} />}
      </SheetBody>
      <SheetFooter className="sticky bottom-0 border-t bg-background">
        <Button type="submit" className="h-12 text-base" disabled={create.isPending || !online}>
          {create.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
          Transferir
        </Button>
      </SheetFooter>
    </form>
  )
}
