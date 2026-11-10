import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import type { ThirdPartyResponse } from '@/api/contracts'
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
import { useCreateThirdParty, useUpdateThirdParty } from './queries'

const schema = z.object({
  name: z.string().trim().min(1, 'Informe o nome.').max(80, 'No máximo 80 letras.'),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>
const FIELDS = ['name'] as const

interface ThirdPartySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** without it the sheet creates a third party */
  thirdParty?: ThirdPartyResponse
}

export function ThirdPartySheet({ open, onOpenChange, thirdParty }: ThirdPartySheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{thirdParty ? 'Renomear terceiro' : 'Novo terceiro'}</SheetTitle>
          <SheetDescription>
            Alguém que usa o seu cartão e vai te devolver o que gastou. O que ele deve aparece em “A
            receber”.
          </SheetDescription>
        </SheetHeader>
        {open && <ThirdPartyForm thirdParty={thirdParty} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

function ThirdPartyForm({
  thirdParty,
  onDone,
}: {
  thirdParty?: ThirdPartyResponse
  onDone: () => void
}) {
  const online = useOnline()
  const create = useCreateThirdParty()
  const update = useUpdateThirdParty()
  const pending = create.isPending || update.isPending
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, setError, formState } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: thirdParty?.name ?? '' },
  })
  const onError = (error: unknown) => setFormError(applyApiErrors(error, setError, FIELDS))

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    if (!thirdParty) {
      create.mutateAsync({ name: values.name }).then(() => {
        toast.success('Terceiro cadastrado.')
        onDone()
      }, onError)
      return
    }
    if (values.name === thirdParty.name) return onDone()
    update.mutateAsync({ code: thirdParty.code, body: { name: values.name } }).then(() => {
      toast.success('Terceiro atualizado.')
      onDone()
    }, onError)
  })

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="contents" noValidate>
      <SheetBody>
        <Field id="third-party-name" label="Nome" error={formState.errors.name?.message}>
          {(aria) => <Input {...aria} {...register('name')} maxLength={80} autoComplete="off" />}
        </Field>
        {formError && <FormAlert message={formError} />}
      </SheetBody>
      <SheetFooter className="sticky bottom-0 border-t bg-background">
        <Button type="submit" className="h-12 text-base" disabled={pending || !online}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden />}
          {thirdParty ? 'Salvar' : 'Cadastrar terceiro'}
        </Button>
      </SheetFooter>
    </form>
  )
}
