import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import type { CreditCardHolderResponse, UUID } from '@/api/contracts'
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
import { useOnline } from '@/lib/online'
import { useCreateHolder, useUpdateHolder } from './holderQueries'
import {
  HOLDER_FIELDS,
  holderDefaults,
  holderSchema,
  toHolderRequest,
  toHolderUpdate,
  type HolderFormInput,
  type HolderFormValues,
} from './holderSchema'

interface HolderSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cardCode: UUID
  /** without it the sheet creates an additional holder */
  holder?: CreditCardHolderResponse
}

export function HolderSheet({ open, onOpenChange, cardCode, holder }: HolderSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{holder ? 'Renomear titular' : 'Novo titular'}</SheetTitle>
          <SheetDescription>
            {holder
              ? 'O novo nome aparece também nas compras que já existem.'
              : 'Quem usa um cartão adicional. O limite continua sendo o mesmo do cartão.'}
          </SheetDescription>
        </SheetHeader>
        {open && (
          <HolderForm cardCode={cardCode} holder={holder} onDone={() => onOpenChange(false)} />
        )}
      </SheetContent>
    </Sheet>
  )
}

function HolderForm({
  cardCode,
  holder,
  onDone,
}: {
  cardCode: UUID
  holder?: CreditCardHolderResponse
  onDone: () => void
}) {
  const online = useOnline()
  const create = useCreateHolder()
  const update = useUpdateHolder()
  const pending = create.isPending || update.isPending
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, setError, formState } = useForm<
    HolderFormInput,
    unknown,
    HolderFormValues
  >({ resolver: zodResolver(holderSchema), defaultValues: holderDefaults(holder) })
  const onError = (error: unknown) => setFormError(applyApiErrors(error, setError, HOLDER_FIELDS))

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    if (!holder) {
      create.mutateAsync({ cardCode, body: toHolderRequest(values) }).then(() => {
        toast.success('Titular adicionado.')
        onDone()
      }, onError)
      return
    }
    const body = toHolderUpdate(holder, values)
    if (Object.keys(body).length === 0) return onDone()
    update.mutateAsync({ cardCode, holderCode: holder.code, body }).then(() => {
      toast.success('Titular atualizado.')
      onDone()
    }, onError)
  })

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="contents" noValidate>
      <SheetBody>
        <Field id="holder-name" label="Nome" error={formState.errors.name?.message}>
          {(aria) => <Input {...aria} {...register('name')} maxLength={80} autoComplete="off" />}
        </Field>
        {formError && <FormAlert message={formError} />}
      </SheetBody>
      <SheetFooter className="sticky bottom-0 border-t bg-background">
        <Button type="submit" className="h-12 text-base" disabled={pending || !online}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden />}
          {holder ? 'Salvar' : 'Adicionar titular'}
        </Button>
      </SheetFooter>
    </form>
  )
}
