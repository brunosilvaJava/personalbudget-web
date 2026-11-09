import { zodResolver } from '@hookform/resolvers/zod'
import { Layers, LoaderCircle, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'

import type { InstallmentBillResponse, OperationType } from '@/api/contracts'
import { Amount } from '@/components/domain/Amount'
import { ConfirmDialog } from '@/components/domain/ConfirmDialog'
import { EmptyState } from '@/components/domain/EmptyState'
import { ErrorState } from '@/components/domain/ErrorState'
import { FormAlert } from '@/components/domain/FormAlert'
import { MoneyInput } from '@/components/domain/MoneyInput'
import { Badge } from '@/components/ui/badge'
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
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CategorySelect } from '@/features/categories/CategorySelect'
import {
  useCreateInstallmentBill,
  useDeleteInstallmentBill,
  useInstallmentBills,
  useUpdateInstallmentBill,
} from '@/features/recurring/queries'
import {
  INSTALLMENT_BILL_FIELDS,
  installmentBillDefaults,
  installmentBillSchema,
  toInstallmentBillRequest,
  toInstallmentBillUpdate,
  type InstallmentBillFormInput,
  type InstallmentBillFormValues,
} from '@/features/recurring/schema'
import { applyApiErrors, errorMessage } from '@/lib/api-errors'
import { shiftDate, todayIso } from '@/lib/dates'
import { formatDate, formatMoney } from '@/lib/format'
import { fromCents, toCents } from '@/lib/money'
import { useOnline } from '@/lib/online'

/** Recorrentes › Parceladas: installments outside a card (carnê, boleto). */
export function InstallmentBillsPage() {
  const online = useOnline()
  const bills = useInstallmentBills({})
  const [selected, setSelected] = useState<InstallmentBillResponse | null>(null)
  const [creating, setCreating] = useState(false)
  const list = bills.data?.pages.flatMap((page) => page.content) ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-muted-foreground">
          Carnês e boletos parcelados. Compra no cartão vai em{' '}
          <Link to="/carteira/cartoes" className="underline underline-offset-4">
            Carteira › Cartões
          </Link>
          .
        </p>
        <Button className="h-11" onClick={() => setCreating(true)} disabled={!online}>
          <Plus aria-hidden />
          Nova parcelada
        </Button>
      </div>

      {bills.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Carregando parceladas">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : bills.isError ? (
        <ErrorState error={bills.error} onRetry={() => void bills.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={Layers} title="Nenhuma compra parcelada" />
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {list.map((bill) => (
            <li key={bill.code}>
              <button
                type="button"
                className="flex min-h-14 w-full items-start gap-3 px-4 py-3 text-left hover:bg-accent/60"
                onClick={() => setSelected(bill)}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">
                    <span className="truncate">{bill.description}</span>
                    {bill.status === 'DONE' && <Badge variant="muted">concluída</Badge>}
                  </p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {bill.installment_count} de {bill.installment_total} lançadas · total{' '}
                    {formatMoney(
                      fromCents(toCents(Math.abs(bill.amount)) * bill.installment_total),
                    )}
                  </p>
                  {bill.next_installment_date && (
                    <p className="text-xs text-muted-foreground">
                      Próxima parcela: {formatDate(bill.next_installment_date)}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end">
                  <Amount operationType={bill.operation_type} amount={bill.amount} />
                  <span className="text-xs text-muted-foreground">por parcela</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {bills.hasNextPage && (
        <Button
          variant="outline"
          className="h-11 self-center"
          onClick={() => void bills.fetchNextPage()}
          disabled={bills.isFetchingNextPage}
        >
          {bills.isFetchingNextPage && <LoaderCircle className="animate-spin" aria-hidden />}
          Carregar mais
        </Button>
      )}

      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Nova compra parcelada</SheetTitle>
            <SheetDescription>O valor é de cada parcela, não o total.</SheetDescription>
          </SheetHeader>
          {creating && <InstallmentBillForm onSaved={() => setCreating(false)} />}
        </SheetContent>
      </Sheet>
      <InstallmentBillSheet bill={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

function InstallmentBillSheet({
  bill,
  onClose,
}: {
  bill: InstallmentBillResponse | null
  onClose: () => void
}) {
  const online = useOnline()
  const [editing, setEditing] = useState(false)
  const remove = useDeleteInstallmentBill()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <Sheet
      open={bill !== null}
      onOpenChange={(open) => {
        if (!open) {
          setEditing(false)
          setError(null)
          onClose()
        }
      }}
    >
      <SheetContent aria-describedby={undefined}>
        {bill && editing && (
          <>
            <SheetHeader>
              <SheetTitle>Editar parcelada</SheetTitle>
            </SheetHeader>
            <InstallmentBillForm
              bill={bill}
              onCancel={() => setEditing(false)}
              onSaved={() => {
                setEditing(false)
                onClose()
              }}
            />
          </>
        )}
        {bill && !editing && (
          <>
            <SheetHeader>
              <SheetTitle>{bill.description}</SheetTitle>
              <p className="text-sm text-muted-foreground tabular-nums">
                {bill.installment_total}x de {formatMoney(Math.abs(bill.amount))} ·{' '}
                {bill.installment_count} lançadas
              </p>
            </SheetHeader>
            <SheetBody>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Compra</dt>
                <dd className="text-right">
                  {bill.purchase_date ? formatDate(bill.purchase_date) : '—'}
                </dd>
                <dt className="text-muted-foreground">Próxima parcela</dt>
                <dd className="text-right">
                  {bill.next_installment_date
                    ? formatDate(bill.next_installment_date)
                    : 'concluída'}
                </dd>
                <dt className="text-muted-foreground">Total</dt>
                <dd className="text-right tabular-nums">
                  {formatMoney(fromCents(toCents(Math.abs(bill.amount)) * bill.installment_total))}
                </dd>
              </dl>
              {error && <FormAlert message={error} />}
            </SheetBody>
            <SheetFooter className="sticky bottom-0 flex-row border-t bg-background">
              <Button variant="outline" className="h-11 flex-1" onClick={() => setEditing(true)}>
                <Pencil aria-hidden />
                Editar
              </Button>
              <Button
                variant="outline"
                className="h-11 flex-1 text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={!online}
              >
                <Trash2 aria-hidden />
                Excluir
              </Button>
            </SheetFooter>
            <ConfirmDialog
              open={confirmDelete}
              onOpenChange={setConfirmDelete}
              title="Excluir parcelada?"
              description="As próximas parcelas deixam de ser lançadas. As já lançadas continuam em Movimentações."
              confirmLabel="Excluir"
              destructive
              pending={remove.isPending}
              onConfirm={() =>
                remove.mutateAsync(bill.code).then(
                  () => {
                    setConfirmDelete(false)
                    toast.success('Parcelada excluída.')
                    onClose()
                  },
                  (deleteError) => {
                    setConfirmDelete(false)
                    setError(errorMessage(deleteError))
                  },
                )
              }
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function InstallmentBillForm({
  bill,
  onSaved,
  onCancel,
}: {
  bill?: InstallmentBillResponse
  onSaved: () => void
  onCancel?: () => void
}) {
  const online = useOnline()
  const create = useCreateInstallmentBill()
  const update = useUpdateInstallmentBill()
  const pending = create.isPending || update.isPending
  const [formError, setFormError] = useState<string | null>(null)
  const { register, control, handleSubmit, setValue, setError, formState } = useForm<
    InstallmentBillFormInput,
    unknown,
    InstallmentBillFormValues
  >({ resolver: zodResolver(installmentBillSchema), defaultValues: installmentBillDefaults(bill) })
  const operationType = useWatch({ control, name: 'operation_type' })
  const amount = useWatch({ control, name: 'amount' })
  const total = useWatch({ control, name: 'installment_total' })
  const purchaseDate = useWatch({ control, name: 'purchase_date' })
  const totalValue =
    amount && Number.isInteger(total) && total > 0 ? fromCents(amount * total) : null
  const old = Boolean(purchaseDate) && purchaseDate < shiftDate(todayIso(), -30)

  const onSuccess = (saved: InstallmentBillResponse) => {
    const posted = saved.installment_count - (bill?.installment_count ?? 0)
    toast.success(
      `${bill ? 'Parcelada atualizada' : 'Parcelada criada'}.${
        posted > 0
          ? ` ${posted === 1 ? '1 parcela foi lançada' : `${posted} parcelas foram lançadas`} ao salvar.`
          : ''
      }`,
    )
    onSaved()
  }
  const onError = (error: unknown) =>
    setFormError(applyApiErrors(error, setError, INSTALLMENT_BILL_FIELDS))

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    if (bill) {
      update
        .mutateAsync({ code: bill.code, body: toInstallmentBillUpdate(bill, values) })
        .then(onSuccess, onError)
    } else {
      create.mutateAsync(toInstallmentBillRequest(values)).then(onSuccess, onError)
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
          id="installment-description"
          label="Descrição"
          error={formState.errors.description?.message}
        >
          {(aria) => (
            <Input
              {...aria}
              {...register('description')}
              maxLength={50}
              autoComplete="off"
              placeholder="Ex.: Carnê da loja"
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Controller
            control={control}
            name="amount"
            render={({ field, fieldState }) => (
              <Field
                id="installment-amount"
                label="Valor da parcela"
                error={fieldState.error?.message}
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
          <Field
            id="installment-total"
            label="Parcelas"
            error={formState.errors.installment_total?.message}
            description={bill ? `${bill.installment_count} já lançadas` : undefined}
          >
            {(aria) => (
              <Input
                {...aria}
                type="number"
                inputMode="numeric"
                min={bill?.installment_count || 1}
                {...register('installment_total', { valueAsNumber: true })}
              />
            )}
          </Field>
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Total:{' '}
          <strong className="text-foreground tabular-nums">
            {totalValue === null ? '—' : formatMoney(totalValue)}
          </strong>
        </p>
        <Field
          id="installment-date"
          label="Data da compra"
          error={formState.errors.purchase_date?.message}
          description={
            bill && bill.installment_count > 0
              ? 'Com parcelas já lançadas, mudar a data não reprograma as próximas.'
              : undefined
          }
        >
          {(aria) => <Input {...aria} type="date" {...register('purchase_date')} />}
        </Field>
        {old && !bill && (
          <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <p>A compra tem mais de 30 dias: as parcelas já vencidas serão lançadas ao salvar.</p>
          </div>
        )}
        <Controller
          control={control}
          name="category_code"
          render={({ field, fieldState }) => (
            <Field
              id="installment-category"
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
          {bill ? 'Salvar' : 'Criar parcelada'}
        </Button>
      </SheetFooter>
    </form>
  )
}
