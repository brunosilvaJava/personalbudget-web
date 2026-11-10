import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'

import type { CreditCardResponse } from '@/api/contracts'
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
import { ThirdPartySelect } from '@/features/third-parties/ThirdPartySelect'
import { applyApiErrors } from '@/lib/api-errors'
import { useOnline } from '@/lib/online'
import { AccountSelect } from './AccountSelect'
import { useCreateCard, useUpdateCard } from './cardQueries'
import {
  CARD_FIELDS,
  cardDefaults,
  cardSchema,
  toCardRequest,
  toCardUpdate,
  type CardFormInput,
  type CardFormValues,
} from './cardSchema'

interface CardFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  card?: CreditCardResponse
}

export function CardFormSheet({ open, onOpenChange, card }: CardFormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{card ? 'Editar cartão' : 'Novo cartão'}</SheetTitle>
          <SheetDescription>
            {card
              ? 'Novos dias de fechamento e vencimento valem só para compras futuras.'
              : 'O dia de fechamento decide em que fatura cada compra cai.'}
          </SheetDescription>
        </SheetHeader>
        {open && <CardForm card={card} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

function CardForm({ card, onDone }: { card?: CreditCardResponse; onDone: () => void }) {
  const online = useOnline()
  const create = useCreateCard()
  const update = useUpdateCard()
  const pending = create.isPending || update.isPending
  const [formError, setFormError] = useState<string | null>(null)
  const { register, control, handleSubmit, setError, formState } = useForm<
    CardFormInput,
    unknown,
    CardFormValues
  >({ resolver: zodResolver(cardSchema), defaultValues: cardDefaults(card) })
  const onError = (error: unknown) => setFormError(applyApiErrors(error, setError, CARD_FIELDS))

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    if (!card) {
      create.mutateAsync(toCardRequest(values)).then((created) => {
        toast.success(`Cartão “${created.name}” criado.`)
        onDone()
      }, onError)
      return
    }
    const body = toCardUpdate(card, values)
    if (Object.keys(body).length === 0) return onDone()
    update.mutateAsync({ code: card.code, body }).then(() => {
      toast.success('Cartão atualizado.')
      onDone()
    }, onError)
  })

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="contents" noValidate>
      <SheetBody>
        <Field id="card-name" label="Nome" error={formState.errors.name?.message}>
          {(aria) => (
            <Input
              {...aria}
              {...register('name')}
              maxLength={50}
              autoComplete="off"
              placeholder="Ex.: Nubank Visa"
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field
            id="card-closing"
            label="Dia do fechamento"
            error={formState.errors.closing_day?.message}
          >
            {(aria) => (
              <Input
                {...aria}
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                {...register('closing_day', { valueAsNumber: true })}
              />
            )}
          </Field>
          <Field id="card-due" label="Dia do vencimento" error={formState.errors.due_day?.message}>
            {(aria) => (
              <Input
                {...aria}
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                {...register('due_day', { valueAsNumber: true })}
              />
            )}
          </Field>
        </div>
        <Controller
          control={control}
          name="credit_limit"
          render={({ field, fieldState }) => (
            <Field
              id="card-limit"
              label="Limite (opcional)"
              error={fieldState.error?.message}
              description={
                card?.credit_limit != null
                  ? 'O limite pode ser trocado, mas não retirado.'
                  : 'Sem limite, o app não avisa quando uma compra passa do disponível.'
              }
            >
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
        <Controller
          control={control}
          name="default_account_code"
          render={({ field, fieldState }) => (
            <Field
              id="card-account"
              label="Conta que paga a fatura (opcional)"
              error={fieldState.error?.message}
              description="Sem ela, a fatura é paga pela conta padrão."
            >
              {(aria) => <AccountSelect {...aria} value={field.value} onChange={field.onChange} />}
            </Field>
          )}
        />
        <Controller
          control={control}
          name="default_third_party_code"
          render={({ field, fieldState }) => (
            <Field
              id="card-third-party"
              label="Terceiro padrão (opcional)"
              error={fieldState.error?.message}
              description="Cartão emprestado: toda compra vira dele, salvo as do plástico ou da própria compra."
            >
              {(aria) => (
                <ThirdPartySelect
                  {...aria}
                  value={field.value}
                  onChange={field.onChange}
                  noneLabel="Ninguém (minhas compras)"
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
          {card ? 'Salvar' : 'Criar cartão'}
        </Button>
      </SheetFooter>
    </form>
  )
}
