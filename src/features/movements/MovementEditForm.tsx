import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import type { FinancialMovementResponse, OperationType } from '@/api/contracts'
import { FormAlert } from '@/components/domain/FormAlert'
import { MoneyInput } from '@/components/domain/MoneyInput'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SheetBody, SheetFooter } from '@/components/ui/sheet'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CategorySelect } from '@/features/categories/CategorySelect'
import { ClosedCycleNote } from '@/features/pay-cycles/ClosedCycleNote'
import { useClosedCycle } from '@/features/pay-cycles/queries'
import { applyApiErrors } from '@/lib/api-errors'
import { useOnline } from '@/lib/online'
import { useUpdateMovement } from './queries'
import {
  MOVEMENT_EDIT_FIELDS,
  movementEditDefaults,
  movementEditSchema,
  toUpdateRequest,
  type MovementEditInput,
  type MovementEditValues,
} from './schema'

interface MovementEditFormProps {
  movement: FinancialMovementResponse
  onCancel: () => void
  onSaved: () => void
}

/**
 * Full edit. Only what changed is sent. Editing a movement that already has a payment is allowed:
 * the screen warns and the back decides (400 or 409 with its message).
 */
export function MovementEditForm({ movement, onCancel, onSaved }: MovementEditFormProps) {
  const online = useOnline()
  const update = useUpdateMovement()
  const closedCycle = useClosedCycle(movement.competence_date ?? undefined)
  const [formError, setFormError] = useState<string | null>(null)
  const { register, control, handleSubmit, setValue, setError, formState } = useForm<
    MovementEditInput,
    unknown,
    MovementEditValues
  >({
    resolver: zodResolver(movementEditSchema),
    defaultValues: movementEditDefaults(movement),
  })
  const operationType = useWatch({ control, name: 'operation_type' })
  const competenceMode = useWatch({ control, name: 'competence_mode' })
  const hasPayment = (movement.amount_paid ?? 0) > 0
  const recurring = movement.recurrence_bill_code !== null

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    const body = toUpdateRequest(movement, values)
    if (Object.keys(body).length === 0) {
      onCancel()
      return
    }
    update.mutate(
      { code: movement.code, body },
      {
        onSuccess: () => {
          toast.success('Movimentação atualizada.')
          onSaved()
        },
        onError: (error) => setFormError(applyApiErrors(error, setError, MOVEMENT_EDIT_FIELDS)),
      },
    )
  })

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="contents" noValidate>
      <SheetBody>
        {closedCycle && (
          <ClosedCycleNote cycle={closedCycle}>
            Valor, tipo, categoria e competência não podem mudar enquanto ele estiver fechado; a
            descrição e o vencimento sim.
          </ClosedCycleNote>
        )}

        {hasPayment && (
          <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <p>
              Já há pagamento registrado. Mudar o valor ou o tipo pode ser recusado; para desfazer o
              pagamento, use o estorno.
            </p>
          </div>
        )}

        <Controller
          control={control}
          name="operation_type"
          render={({ field }) => (
            <ToggleGroup
              type="single"
              aria-label="Tipo"
              value={field.value}
              onValueChange={(value) => {
                if (!value) return
                field.onChange(value as OperationType)
                setValue('category_code', null)
              }}
            >
              <ToggleGroupItem value="DEBIT">Despesa</ToggleGroupItem>
              <ToggleGroupItem value="CREDIT">Receita</ToggleGroupItem>
            </ToggleGroup>
          )}
        />

        <Controller
          control={control}
          name="amount"
          render={({ field, fieldState }) => (
            <Field id="edit-amount" label="Valor" error={fieldState.error?.message}>
              {(aria) => (
                <MoneyInput
                  {...aria}
                  ref={field.ref}
                  name={field.name}
                  value={field.value ?? null}
                  onChange={(cents) => field.onChange(cents)}
                  onBlur={field.onBlur}
                />
              )}
            </Field>
          )}
        />

        <Field
          id="edit-description"
          label="Descrição"
          error={formState.errors.description?.message}
        >
          {(aria) => (
            <Input {...aria} {...register('description')} autoComplete="off" maxLength={50} />
          )}
        </Field>

        <Controller
          control={control}
          name="category_code"
          render={({ field, fieldState }) => (
            <Field
              id="edit-category"
              label="Categoria"
              error={fieldState.error?.message}
              description={
                movement.category_code
                  ? 'A categoria pode ser trocada, mas não retirada.'
                  : undefined
              }
            >
              {(aria) => (
                <CategorySelect
                  {...aria}
                  operationType={operationType}
                  value={field.value}
                  allowNone={movement.category_code === null}
                  onChange={(code) => field.onChange(code)}
                />
              )}
            </Field>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <Field id="edit-date" label="Data" error={formState.errors.movement_date?.message}>
            {(aria) => <Input {...aria} type="date" {...register('movement_date')} />}
          </Field>
          <Field id="edit-due" label="Vencimento" error={formState.errors.due_date?.message}>
            {(aria) => <Input {...aria} type="date" {...register('due_date')} />}
          </Field>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Competência</legend>
          <Controller
            control={control}
            name="competence_mode"
            render={({ field }) => (
              <ToggleGroup
                type="single"
                aria-label="Competência"
                value={field.value}
                onValueChange={(value) => value && field.onChange(value)}
              >
                <ToggleGroupItem value="auto">Automática</ToggleGroupItem>
                <ToggleGroupItem value="manual">Escolher</ToggleGroupItem>
              </ToggleGroup>
            )}
          />
          {competenceMode === 'auto' ? (
            <p className="text-sm text-muted-foreground">
              {recurring
                ? 'Segue a data da ocorrência da conta recorrente.'
                : 'Segue a data do lançamento.'}
            </p>
          ) : (
            <Field
              id="edit-competence"
              label="Mês do orçamento"
              error={formState.errors.competence_date?.message}
              description="A data a que a despesa ou receita pertence no orçamento, independente do vencimento."
            >
              {(aria) => <Input {...aria} type="date" {...register('competence_date')} />}
            </Field>
          )}
        </fieldset>

        {formError && <FormAlert message={formError} />}
      </SheetBody>
      <SheetFooter className="sticky bottom-0 flex-row border-t bg-background">
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1"
          onClick={onCancel}
          disabled={update.isPending}
        >
          Cancelar
        </Button>
        <Button type="submit" className="h-11 flex-1" disabled={update.isPending || !online}>
          {update.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
          Salvar
        </Button>
      </SheetFooter>
    </form>
  )
}
