import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'

import {
  CREDIT_CARD_PLASTIC_KINDS,
  type CreditCardHolderResponse,
  type CreditCardPlasticResponse,
  type UUID,
} from '@/api/contracts'
import { FormAlert } from '@/components/domain/FormAlert'
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
import { ThirdPartySelect } from '@/features/third-parties/ThirdPartySelect'
import { applyApiErrors } from '@/lib/api-errors'
import { useOnline } from '@/lib/online'
import { useCreatePlastic, useUpdatePlastic } from './holderQueries'
import {
  PLASTIC_FIELDS,
  plasticDefaults,
  plasticSchema,
  toPlasticRequest,
  toPlasticUpdate,
  type PlasticFormInput,
  type PlasticFormValues,
} from './holderSchema'
import { PLASTIC_KIND_LABEL, PLASTIC_STATUS_LABEL } from './labels'

interface PlasticSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cardCode: UUID
  /** the active holders, to choose from when creating */
  holders: CreditCardHolderResponse[]
  /** a new plastic starts with this holder chosen */
  holderCode?: UUID
  /** without it the sheet creates a plastic */
  plastic?: CreditCardPlasticResponse
}

export function PlasticSheet({
  open,
  onOpenChange,
  cardCode,
  holders,
  holderCode,
  plastic,
}: PlasticSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {plastic ? `Plástico final ${plastic.last_digits}` : 'Novo plástico'}
          </SheetTitle>
          <SheetDescription>
            {plastic
              ? `De ${plastic.holder_name}. Titular e dígitos não mudam: para outro cartão, cadastre um novo plástico.`
              : 'Os 4 últimos dígitos ligam a compra de um extrato ao titular que usou o cartão.'}
          </SheetDescription>
        </SheetHeader>
        {open && (
          <PlasticForm
            cardCode={cardCode}
            holders={holders}
            holderCode={holderCode}
            plastic={plastic}
            onDone={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function PlasticForm({
  cardCode,
  holders,
  holderCode,
  plastic,
  onDone,
}: {
  cardCode: UUID
  holders: CreditCardHolderResponse[]
  holderCode?: UUID
  plastic?: CreditCardPlasticResponse
  onDone: () => void
}) {
  const online = useOnline()
  const create = useCreatePlastic()
  const update = useUpdatePlastic()
  const pending = create.isPending || update.isPending
  const [formError, setFormError] = useState<string | null>(null)
  const { register, control, handleSubmit, setError, formState } = useForm<
    PlasticFormInput,
    unknown,
    PlasticFormValues
  >({
    resolver: zodResolver(plasticSchema),
    defaultValues: plasticDefaults(plastic, holderCode ?? holders[0]?.code),
  })
  const onError = (error: unknown) => setFormError(applyApiErrors(error, setError, PLASTIC_FIELDS))

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    if (!plastic) {
      create.mutateAsync({ cardCode, body: toPlasticRequest(values) }).then(() => {
        toast.success(`Plástico final ${values.last_digits} cadastrado.`)
        onDone()
      }, onError)
      return
    }
    const body = toPlasticUpdate(plastic, values)
    if (Object.keys(body).length === 0) return onDone()
    update.mutateAsync({ cardCode, plasticCode: plastic.code, body }).then(() => {
      toast.success('Plástico atualizado.')
      onDone()
    }, onError)
  })

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="contents" noValidate>
      <SheetBody>
        {!plastic && (
          <>
            <Controller
              control={control}
              name="holder_code"
              render={({ field, fieldState }) => (
                <Field id="plastic-holder" label="Titular" error={fieldState.error?.message}>
                  {(aria) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger {...aria}>
                        <SelectValue placeholder="Escolha o titular" />
                      </SelectTrigger>
                      <SelectContent>
                        {holders.map((holder) => (
                          <SelectItem key={holder.code} value={holder.code}>
                            {holder.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>
              )}
            />
            <Field
              id="plastic-digits"
              label="Últimos 4 dígitos"
              error={formState.errors.last_digits?.message}
            >
              {(aria) => (
                <Input
                  {...aria}
                  {...register('last_digits')}
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="off"
                  placeholder="0000"
                />
              )}
            </Field>
          </>
        )}
        <Controller
          control={control}
          name="kind"
          render={({ field, fieldState }) => (
            <Field id="plastic-kind" label="Tipo" error={fieldState.error?.message}>
              {(aria) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger {...aria}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CREDIT_CARD_PLASTIC_KINDS.map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {PLASTIC_KIND_LABEL[kind]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          )}
        />
        {plastic && (
          <Controller
            control={control}
            name="status"
            render={({ field, fieldState }) => (
              <Field
                id="plastic-status"
                label="Situação"
                error={fieldState.error?.message}
                description="Um plástico substituído ou inativo deixa de aparecer na hora de lançar a compra."
              >
                {(aria) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...aria}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['ACTIVE', 'REPLACED', 'INACTIVE'] as const).map((status) => (
                        <SelectItem key={status} value={status}>
                          {PLASTIC_STATUS_LABEL[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
            )}
          />
        )}
        {plastic && (
          <Controller
            control={control}
            name="default_third_party_code"
            render={({ field, fieldState }) => (
              <Field
                id="plastic-third-party"
                label="Terceiro padrão (opcional)"
                error={fieldState.error?.message}
                description="As compras deste plástico viram deste terceiro, salvo as que disserem outra coisa. Vale sobre o padrão do cartão."
              >
                {(aria) => (
                  <ThirdPartySelect
                    {...aria}
                    value={field.value}
                    onChange={field.onChange}
                    noneLabel="Seguir o padrão do cartão"
                  />
                )}
              </Field>
            )}
          />
        )}
        {formError && <FormAlert message={formError} />}
      </SheetBody>
      <SheetFooter className="sticky bottom-0 border-t bg-background">
        <Button type="submit" className="h-12 text-base" disabled={pending || !online}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden />}
          {plastic ? 'Salvar' : 'Cadastrar plástico'}
        </Button>
      </SheetFooter>
    </form>
  )
}
