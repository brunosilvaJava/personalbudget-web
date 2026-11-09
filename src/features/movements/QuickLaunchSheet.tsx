import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import type { FinancialMovementResponse, OperationType } from '@/api/contracts'
import { FormAlert } from '@/components/domain/FormAlert'
import { MoneyInput } from '@/components/domain/MoneyInput'
import { useLaunchSheetState } from '@/components/layout/launch'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CategorySelect } from '@/features/categories/CategorySelect'
import { applyApiErrors, errorMessage } from '@/lib/api-errors'
import { todayIso } from '@/lib/dates'
import { formatMoney } from '@/lib/format'
import { useOnline } from '@/lib/online'
import { useCreateSettlement, useQuickLaunch } from './queries'
import {
  QUICK_LAUNCH_FIELDS,
  quickLaunchDefaults,
  quickLaunchSchema,
  remainingAmount,
  toQuickLaunchRequests,
  type QuickLaunchInput,
  type QuickLaunchValues,
} from './schema'

/**
 * "Lançar": an expense, now, already paid, in up to 3 taps. Opens over any screen (?lancar=1).
 * Paid = two calls (movement, then settlement); "ainda não paguei" creates only the movement.
 */
export function QuickLaunchSheet() {
  const [open, close] = useLaunchSheetState()
  return (
    <Sheet open={open} onOpenChange={(next) => !next && close()}>
      <SheetContent
        aria-describedby={undefined}
        // Straight to the amount: the number pad opens with the sheet.
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          document.getElementById('launch-amount')?.focus()
        }}
      >
        {open && <QuickLaunch onDone={close} />}
      </SheetContent>
    </Sheet>
  )
}

function QuickLaunch({ onDone }: { onDone: () => void }) {
  const [unsettled, setUnsettled] = useState<{
    movement: FinancialMovementResponse
    error: unknown
    effectiveDate: string
  } | null>(null)

  if (unsettled) {
    return (
      <PaymentFailed
        movement={unsettled.movement}
        error={unsettled.error}
        effectiveDate={unsettled.effectiveDate}
        onRetryFailed={(error) => setUnsettled({ ...unsettled, error })}
        onDone={onDone}
      />
    )
  }
  return (
    <QuickLaunchForm
      onDone={onDone}
      onPaymentFailed={(movement, error, effectiveDate) =>
        setUnsettled({ movement, error, effectiveDate })
      }
    />
  )
}

function QuickLaunchForm({
  onDone,
  onPaymentFailed,
}: {
  onDone: () => void
  onPaymentFailed: (movement: FinancialMovementResponse, error: unknown, date: string) => void
}) {
  const online = useOnline()
  const launch = useQuickLaunch()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<QuickLaunchInput, unknown, QuickLaunchValues>({
    resolver: zodResolver(quickLaunchSchema),
    defaultValues: quickLaunchDefaults(),
  })
  const { register, control, handleSubmit, setValue, getValues, setError, formState } = form
  const operationType = useWatch({ control, name: 'operation_type' })
  const unpaid = useWatch({ control, name: 'unpaid' })
  const credit = operationType === 'CREDIT'

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    const requests = toQuickLaunchRequests(values)
    launch.mutate(requests, {
      onSuccess: ({ movement, settlementError }) => {
        if (settlementError) {
          onPaymentFailed(movement, settlementError, values.movement_date)
          return
        }
        toast.success(
          `${credit ? 'Receita' : 'Despesa'} de ${formatMoney(movement.amount)} lançada${
            requests.settlement ? (credit ? ' e recebida' : ' e paga') : ''
          }.`,
        )
        onDone()
      },
      onError: (error) => setFormError(applyApiErrors(error, setError, QUICK_LAUNCH_FIELDS)),
    })
  })

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="contents" noValidate>
      <SheetHeader>
        <SheetTitle>Lançar</SheetTitle>
        <SheetDescription className="sr-only">
          Valor, descrição e categoria. Já entra como paga, a menos que você marque que ainda não
          pagou.
        </SheetDescription>
      </SheetHeader>
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
                // Categories belong to one type: a debit category cannot go on a revenue.
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
            <Field id="launch-amount" label="Valor" error={fieldState.error?.message}>
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
          id="launch-description"
          label="Descrição"
          error={formState.errors.description?.message}
        >
          {(aria) => (
            <Input
              {...aria}
              {...register('description')}
              autoComplete="off"
              maxLength={50}
              enterKeyHint="done"
              placeholder={credit ? 'Ex.: Freelance' : 'Ex.: Pão e leite'}
            />
          )}
        </Field>

        <Controller
          control={control}
          name="category_code"
          render={({ field, fieldState }) => (
            <Field
              id="launch-category"
              label="Categoria (opcional)"
              error={fieldState.error?.message}
            >
              {(aria) => (
                <CategorySelect
                  {...aria}
                  operationType={operationType}
                  value={field.value}
                  onChange={(code, category) => {
                    field.onChange(code)
                    // An empty description takes the category name; "Gás" then asks to complete.
                    if (category && getValues('description').trim() === '') {
                      setValue('description', category.name, { shouldValidate: true })
                    }
                  }}
                />
              )}
            </Field>
          )}
        />

        <Field id="launch-date" label="Data" error={formState.errors.movement_date?.message}>
          {(aria) => (
            <Input {...aria} type="date" max={todayIso()} {...register('movement_date')} />
          )}
        </Field>

        <Controller
          control={control}
          name="unpaid"
          render={({ field }) => (
            <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3">
              <Label htmlFor="launch-unpaid" className="flex-1 py-3">
                {credit ? 'Ainda não recebi' : 'Ainda não paguei'}
              </Label>
              <Switch id="launch-unpaid" checked={field.value} onCheckedChange={field.onChange} />
            </div>
          )}
        />

        {unpaid && (
          <Field id="launch-due" label="Vencimento" error={formState.errors.due_date?.message}>
            {(aria) => <Input {...aria} type="date" {...register('due_date')} />}
          </Field>
        )}

        {formError && <FormAlert message={formError} />}
      </SheetBody>
      <SheetFooter className="sticky bottom-0 border-t bg-background">
        <Button type="submit" className="h-12 text-base" disabled={launch.isPending || !online}>
          {launch.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
          {unpaid
            ? `Lançar ${credit ? 'receita' : 'despesa'} pendente`
            : credit
              ? 'Lançar receita recebida'
              : 'Lançar despesa paga'}
        </Button>
      </SheetFooter>
    </form>
  )
}

/** The movement exists but the settlement failed: it stayed unpaid. Offer to pay again. */
function PaymentFailed({
  movement,
  error,
  effectiveDate,
  onRetryFailed,
  onDone,
}: {
  movement: FinancialMovementResponse
  error: unknown
  effectiveDate: string
  onRetryFailed: (error: unknown) => void
  onDone: () => void
}) {
  const online = useOnline()
  const pay = useCreateSettlement()
  const credit = movement.operation_type === 'CREDIT'

  return (
    <>
      <SheetHeader>
        <SheetTitle>
          {credit ? 'Receita lançada, sem recebimento' : 'Despesa lançada, sem pagamento'}
        </SheetTitle>
      </SheetHeader>
      <SheetBody>
        <FormAlert
          message={`“${movement.description}” foi lançada, mas o ${
            credit ? 'recebimento' : 'pagamento'
          } não foi registrado: ${errorMessage(error)} Ela ficou pendente.`}
        />
      </SheetBody>
      <SheetFooter>
        <Button
          className="h-12 text-base"
          disabled={pay.isPending || !online}
          onClick={() =>
            pay.mutate(
              {
                code: movement.code,
                body: { amount: remainingAmount(movement), effective_date: effectiveDate },
              },
              {
                onSuccess: () => {
                  toast.success(credit ? 'Recebimento registrado.' : 'Pagamento registrado.')
                  onDone()
                },
                onError: onRetryFailed,
              },
            )
          }
        >
          {pay.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
          {credit ? 'Tentar receber de novo' : 'Tentar pagar de novo'}
        </Button>
        <Button variant="outline" className="h-11" onClick={onDone} disabled={pay.isPending}>
          Deixar pendente
        </Button>
      </SheetFooter>
    </>
  )
}
