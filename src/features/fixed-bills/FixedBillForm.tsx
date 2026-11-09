import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import type { FixedBillResponse, OperationType, RecurrenceType } from '@/api/contracts'
import { FormAlert } from '@/components/domain/FormAlert'
import { MoneyInput } from '@/components/domain/MoneyInput'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SheetBody, SheetFooter } from '@/components/ui/sheet'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CategorySelect } from '@/features/categories/CategorySelect'
import { occursOn, RECURRENCE_LABEL, WEEKDAYS } from '@/features/recurring/recurrence'
import { useCreateFixedBill, useUpdateFixedBill } from '@/features/recurring/queries'
import {
  FIXED_BILL_FIELDS,
  fixedBillDefaults,
  fixedBillSchema,
  toFixedBillRequest,
  toFixedBillUpdate,
  type FixedBillFormInput,
  type FixedBillFormValues,
} from '@/features/recurring/schema'
import { applyApiErrors } from '@/lib/api-errors'
import { todayIso } from '@/lib/dates'
import { formatDate } from '@/lib/format'
import { useOnline } from '@/lib/online'
import { cn } from '@/lib/utils'

const MONTH_DAYS = Array.from({ length: 31 }, (_, index) => index + 1)

/**
 * Create or edit a fixed bill. The day picker follows the recurrence: weekdays, days of the month
 * or a date in the year. Saving can post today's occurrence on the server, so the toast says when
 * it did, to avoid launching it again by hand.
 */
export function FixedBillForm({
  bill,
  onSaved,
  onCancel,
}: {
  bill?: FixedBillResponse
  onSaved: (bill: FixedBillResponse) => void
  onCancel?: () => void
}) {
  const online = useOnline()
  const create = useCreateFixedBill()
  const update = useUpdateFixedBill()
  const pending = create.isPending || update.isPending
  const [formError, setFormError] = useState<string | null>(null)
  const { register, control, handleSubmit, setValue, setError, formState } = useForm<
    FixedBillFormInput,
    unknown,
    FixedBillFormValues
  >({ resolver: zodResolver(fixedBillSchema), defaultValues: fixedBillDefaults(bill) })
  const recurrence = useWatch({ control, name: 'recurrence_type' })
  const operationType = useWatch({ control, name: 'operation_type' })
  const daysError = (formState.errors as { days?: { message?: string } }).days?.message

  const onSuccess = (saved: FixedBillResponse) => {
    const today = todayIso()
    const postedToday =
      saved.next_due_date !== null &&
      saved.next_due_date > today &&
      (saved.start_date ?? today) <= today &&
      occursOn(saved, today)
    if (postedToday) {
      toast.info('Hoje é dia desta conta: o lançamento de hoje já foi gerado. Não lance de novo.', {
        duration: 8000,
      })
    }
    toast.success(
      `${bill ? 'Conta fixa atualizada' : 'Conta fixa criada'}.${
        saved.next_due_date ? ` Próximo lançamento: ${formatDate(saved.next_due_date)}.` : ''
      }`,
    )
    onSaved(saved)
  }
  const onError = (error: unknown) =>
    setFormError(applyApiErrors(error, setError, FIXED_BILL_FIELDS))

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    if (bill) {
      update
        .mutateAsync({ code: bill.code, body: toFixedBillUpdate(bill, values) })
        .then(onSuccess, onError)
    } else {
      create.mutateAsync(toFixedBillRequest(values)).then(onSuccess, onError)
    }
  })

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="contents" noValidate>
      <SheetBody>
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
        <Field
          id="fixed-description"
          label="Descrição"
          error={formState.errors.description?.message}
        >
          {(aria) => (
            <Input
              {...aria}
              {...register('description')}
              maxLength={50}
              autoComplete="off"
              placeholder="Ex.: Aluguel, Internet"
            />
          )}
        </Field>
        <Controller
          control={control}
          name="amount"
          render={({ field, fieldState }) => (
            <Field id="fixed-amount" label="Valor" error={fieldState.error?.message}>
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

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Repete</legend>
          <Controller
            control={control}
            name="recurrence_type"
            render={({ field }) => (
              <ToggleGroup
                type="single"
                aria-label="Recorrência"
                value={field.value}
                onValueChange={(value) => value && field.onChange(value as RecurrenceType)}
              >
                {(['WEEKLY', 'MONTHLY', 'YEARLY'] as const).map((type) => (
                  <ToggleGroupItem key={type} value={type}>
                    {RECURRENCE_LABEL[type]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
          />
          {recurrence === 'WEEKLY' && (
            <Controller
              control={control}
              name="weekly_days"
              render={({ field }) => (
                <ToggleGroup
                  type="multiple"
                  aria-label="Dias da semana"
                  className="grid grid-cols-7 gap-1"
                  value={field.value.map(String)}
                  onValueChange={(values) => field.onChange(values.map(Number))}
                >
                  {WEEKDAYS.map(({ day, short, long }) => (
                    <ToggleGroupItem
                      key={day}
                      value={String(day)}
                      aria-label={long}
                      className="px-0"
                    >
                      {short}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}
            />
          )}
          {recurrence === 'MONTHLY' && (
            <Controller
              control={control}
              name="monthly_days"
              render={({ field }) => (
                <ToggleGroup
                  type="multiple"
                  aria-label="Dias do mês"
                  className="grid grid-cols-7 gap-1"
                  value={field.value.map(String)}
                  onValueChange={(values) => field.onChange(values.map(Number))}
                >
                  {MONTH_DAYS.map((day) => (
                    <ToggleGroupItem
                      key={day}
                      value={String(day)}
                      aria-label={`Dia ${day}`}
                      className={cn('px-0 tabular-nums')}
                    >
                      {day}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}
            />
          )}
          {recurrence === 'YEARLY' && (
            <Field id="fixed-yearly" label="Data no ano">
              {(aria) => <Input {...aria} type="date" {...register('yearly_date')} />}
            </Field>
          )}
          {recurrence === 'MONTHLY' && (
            <p className="text-xs text-muted-foreground">
              Em meses mais curtos, o dia 31 cai no último dia do mês.
            </p>
          )}
          {daysError && (
            <p role="alert" className="text-sm text-destructive">
              {daysError}
            </p>
          )}
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Field id="fixed-start" label="Começa em" error={formState.errors.start_date?.message}>
            {(aria) => <Input {...aria} type="date" {...register('start_date')} />}
          </Field>
          <Field
            id="fixed-end"
            label="Termina em (opcional)"
            error={formState.errors.end_date?.message}
          >
            {(aria) => <Input {...aria} type="date" {...register('end_date')} />}
          </Field>
        </div>
        <Controller
          control={control}
          name="category_code"
          render={({ field, fieldState }) => (
            <Field
              id="fixed-category"
              label="Categoria (opcional)"
              error={fieldState.error?.message}
            >
              {(aria) => (
                <CategorySelect
                  {...aria}
                  operationType={operationType}
                  value={field.value}
                  allowNone={!bill?.category_code}
                  onChange={(code) => field.onChange(code)}
                />
              )}
            </Field>
          )}
        />
        {formError && <FormAlert message={formError} />}
      </SheetBody>
      <SheetFooter className="sticky bottom-0 flex-row border-t bg-background">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1"
            onClick={onCancel}
            disabled={pending}
          >
            Cancelar
          </Button>
        )}
        <Button type="submit" className="h-11 flex-1" disabled={pending || !online}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden />}
          {bill ? 'Salvar' : 'Criar conta fixa'}
        </Button>
      </SheetFooter>
    </form>
  )
}
