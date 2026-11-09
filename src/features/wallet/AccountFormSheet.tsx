import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'

import type { AccountResponse, AccountType } from '@/api/contracts'
import { ACCOUNT_TYPES } from '@/api/contracts'
import { FormAlert } from '@/components/domain/FormAlert'
import { MoneyInput } from '@/components/domain/MoneyInput'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { useOnline } from '@/lib/online'
import { ACCOUNT_TYPE_LABEL } from './labels'
import { useCreateAccount, useUpdateAccount } from './queries'
import {
  ACCOUNT_FIELDS,
  accountDefaults,
  accountSchema,
  toAccountRequest,
  toAccountUpdate,
  type AccountFormInput,
  type AccountFormValues,
} from './schema'

interface AccountFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** editing this account; creating when absent */
  account?: AccountResponse
}

export function AccountFormSheet({ open, onOpenChange, account }: AccountFormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{account ? 'Editar conta' : 'Nova conta'}</SheetTitle>
          <SheetDescription>
            Conta no banco, carteira de dinheiro ou poupança. O saldo inicial é o que havia nela na
            data escolhida: ele não conta como receita.
          </SheetDescription>
        </SheetHeader>
        {open && <AccountForm account={account} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

function AccountForm({ account, onDone }: { account?: AccountResponse; onDone: () => void }) {
  const online = useOnline()
  const create = useCreateAccount()
  const update = useUpdateAccount()
  const pending = create.isPending || update.isPending
  const [formError, setFormError] = useState<string | null>(null)
  const { register, control, handleSubmit, setError, formState } = useForm<
    AccountFormInput,
    unknown,
    AccountFormValues
  >({ resolver: zodResolver(accountSchema), defaultValues: accountDefaults(account) })

  const onError = (error: unknown) => setFormError(applyApiErrors(error, setError, ACCOUNT_FIELDS))

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    if (!account) {
      create.mutateAsync(toAccountRequest(values)).then((created) => {
        toast.success(`Conta “${created.name}” criada.`)
        onDone()
      }, onError)
      return
    }
    const body = toAccountUpdate(account, values)
    if (Object.keys(body).length === 0) return onDone()
    update.mutateAsync({ code: account.code, body }).then(() => {
      toast.success('Conta atualizada.')
      onDone()
    }, onError)
  })

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="contents" noValidate>
      <SheetBody>
        <Field id="account-name" label="Nome" error={formState.errors.name?.message}>
          {(aria) => (
            <Input
              {...aria}
              {...register('name')}
              autoComplete="off"
              maxLength={50}
              placeholder="Ex.: Nubank, Carteira"
            />
          )}
        </Field>
        <Controller
          control={control}
          name="type"
          render={({ field, fieldState }) => (
            <Field id="account-type" label="Tipo" error={fieldState.error?.message}>
              {(aria) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => field.onChange(value as AccountType)}
                >
                  <SelectTrigger {...aria}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {ACCOUNT_TYPE_LABEL[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          )}
        />
        <div className="grid grid-cols-2 gap-3">
          <Controller
            control={control}
            name="initial_balance"
            render={({ field, fieldState }) => (
              <Field id="account-balance" label="Saldo inicial" error={fieldState.error?.message}>
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
          <Field
            id="account-balance-date"
            label="Em"
            error={formState.errors.initial_balance_date?.message}
          >
            {(aria) => <Input {...aria} type="date" {...register('initial_balance_date')} />}
          </Field>
        </div>
        {account && (
          <p className="text-sm text-muted-foreground">
            A data do saldo inicial não pode passar do primeiro pagamento ou transferência da conta.
          </p>
        )}
        {formError && <FormAlert message={formError} />}
      </SheetBody>
      <SheetFooter className="sticky bottom-0 border-t bg-background">
        <Button type="submit" className="h-12 text-base" disabled={pending || !online}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden />}
          {account ? 'Salvar' : 'Criar conta'}
        </Button>
      </SheetFooter>
    </form>
  )
}
