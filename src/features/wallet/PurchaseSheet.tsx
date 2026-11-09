import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'

import type { CardPurchaseResponse, UUID } from '@/api/contracts'
import { ConfirmDialog } from '@/components/domain/ConfirmDialog'
import { FormAlert } from '@/components/domain/FormAlert'
import { LoadError } from '@/components/domain/LoadError'
import { MoneyInput } from '@/components/domain/MoneyInput'
import { StatusBadge } from '@/components/domain/StatusBadge'
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
import { Skeleton } from '@/components/ui/skeleton'
import { CategorySelect } from '@/features/categories/CategorySelect'
import { useCategoryLookup } from '@/features/categories/queries'
import { applyApiErrors, errorMessage } from '@/lib/api-errors'
import { formatDate, formatMoney, formatShortDate, formatShortMonth } from '@/lib/format'
import { fromCents } from '@/lib/money'
import { useOnline } from '@/lib/online'
import {
  useActiveCards,
  useCardLookup,
  useCreatePurchase,
  useDeletePurchase,
  usePurchase,
  useUpdatePurchase,
} from './cardQueries'
import {
  PURCHASE_FIELDS,
  purchaseDefaults,
  purchaseSchema,
  toPurchaseRequest,
  toPurchaseUpdate,
  type PurchaseFormInput,
  type PurchaseFormValues,
} from './cardSchema'

interface PurchaseSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** shows this purchase; without it the sheet creates one */
  purchaseCode?: UUID | null
  /** the card of a new purchase */
  cardCode?: UUID
}

/**
 * A card purchase: create it (value PER INSTALLMENT, total shown), see in which invoice each
 * installment fell, edit or delete it. The installments are movements the back creates.
 */
export function PurchaseSheet({ open, onOpenChange, purchaseCode, cardCode }: PurchaseSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        {open && (
          <PurchaseContent
            key={purchaseCode ?? 'new'}
            purchaseCode={purchaseCode ?? null}
            cardCode={cardCode}
            onClose={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

type Mode = 'view' | 'edit' | 'create'

function PurchaseContent({
  purchaseCode,
  cardCode,
  onClose,
}: {
  purchaseCode: UUID | null
  cardCode?: UUID
  onClose: () => void
}) {
  const [shownCode, setShownCode] = useState(purchaseCode)
  const [mode, setMode] = useState<Mode>(purchaseCode ? 'view' : 'create')
  const purchase = usePurchase(shownCode)

  if (mode === 'create') {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Compra no cartão</SheetTitle>
          <SheetDescription>
            O valor é de cada parcela. A fatura de cada uma sai do dia de fechamento do cartão.
          </SheetDescription>
        </SheetHeader>
        <PurchaseForm
          cardCode={cardCode}
          onSaved={(saved) => {
            setShownCode(saved.code)
            setMode('view')
          }}
        />
      </>
    )
  }

  if (purchase.isPending) {
    return (
      <SheetBody className="pt-14">
        <Skeleton className="h-40 w-full" />
      </SheetBody>
    )
  }
  if (purchase.isError) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Compra no cartão</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <LoadError error={purchase.error} onRetry={() => void purchase.refetch()} />
        </SheetBody>
      </>
    )
  }

  if (mode === 'edit') {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Editar compra</SheetTitle>
          <SheetDescription>
            Data, parcelas e valor só mudam enquanto nenhuma parcela tiver pagamento.
          </SheetDescription>
        </SheetHeader>
        <PurchaseForm purchase={purchase.data} onSaved={() => setMode('view')} />
      </>
    )
  }

  return (
    <PurchaseView purchase={purchase.data} onEdit={() => setMode('edit')} onDeleted={onClose} />
  )
}

function PurchaseView({
  purchase,
  onEdit,
  onDeleted,
}: {
  purchase: CardPurchaseResponse
  onEdit: () => void
  onDeleted: () => void
}) {
  const online = useOnline()
  const cards = useCardLookup()
  const categories = useCategoryLookup()
  const remove = useDeletePurchase()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const category = purchase.category_code ? categories.get(purchase.category_code) : undefined

  return (
    <>
      <SheetHeader>
        <SheetTitle>{purchase.description}</SheetTitle>
        <p className="text-2xl font-semibold text-expense tabular-nums">
          {formatMoney(purchase.total_amount)}
        </p>
        <p className="text-sm text-muted-foreground">
          {purchase.installments === 1
            ? 'À vista'
            : `${purchase.installments}x de ${formatMoney(purchase.installment_amount)}`}{' '}
          · {cards.get(purchase.card_code)?.name ?? 'Cartão'} · {formatDate(purchase.purchase_date)}
          {category && ` · ${category.name}`}
        </p>
      </SheetHeader>
      <SheetBody>
        <section aria-labelledby="installments-title" className="flex flex-col gap-2">
          <h3 id="installments-title" className="text-sm font-medium">
            Parcelas e faturas
          </h3>
          <ul className="divide-y rounded-lg border">
            {purchase.installment_list.map((installment) => (
              <li key={installment.movement_code}>
                <Link
                  to={`/carteira/faturas/${installment.invoice_code}`}
                  className="flex min-h-12 items-center gap-3 px-3 py-2 text-sm hover:bg-accent/60"
                >
                  <span className="w-10 text-muted-foreground tabular-nums">
                    {installment.installment_number}/{installment.installment_count}
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span>Fatura {formatShortMonth(installment.invoice_reference_month)}</span>
                    <span className="text-xs text-muted-foreground">
                      vence {formatShortDate(installment.due_date)}
                    </span>
                  </span>
                  <StatusBadge status={installment.status} operationType="DEBIT" />
                  <span className="tabular-nums">{formatMoney(installment.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        {error && <FormAlert message={error} />}
      </SheetBody>
      <SheetFooter className="sticky bottom-0 flex-row border-t bg-background">
        <Button variant="outline" className="h-11 flex-1" onClick={onEdit}>
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
        title="Excluir compra?"
        description={`“${purchase.description}” e todas as parcelas saem das faturas. Não há como desfazer.`}
        confirmLabel="Excluir"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutateAsync(purchase.code).then(
            () => {
              setConfirmDelete(false)
              toast.success('Compra excluída.')
              onDeleted()
            },
            (deleteError) => {
              setConfirmDelete(false)
              setError(errorMessage(deleteError))
            },
          )
        }
      />
    </>
  )
}

function PurchaseForm({
  purchase,
  cardCode,
  onSaved,
}: {
  purchase?: CardPurchaseResponse
  cardCode?: UUID
  onSaved: (purchase: CardPurchaseResponse) => void
}) {
  const online = useOnline()
  const create = useCreatePurchase()
  const update = useUpdatePurchase()
  const cards = useActiveCards()
  const pending = create.isPending || update.isPending
  const [formError, setFormError] = useState<string | null>(null)
  const { register, control, handleSubmit, setError, formState } = useForm<
    PurchaseFormInput,
    unknown,
    PurchaseFormValues
  >({
    resolver: zodResolver(purchaseSchema),
    defaultValues: purchaseDefaults(purchase, cardCode ?? cards.data?.[0]?.code),
  })
  const installments = useWatch({ control, name: 'installments' })
  const amount = useWatch({ control, name: 'installment_amount' })
  const total =
    Number.isInteger(installments) && installments > 0 && amount
      ? fromCents(amount * installments)
      : null
  const onError = (error: unknown) => setFormError(applyApiErrors(error, setError, PURCHASE_FIELDS))

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    if (!purchase) {
      create.mutateAsync(toPurchaseRequest(values)).then((saved) => {
        toast.success(`Compra de ${formatMoney(saved.total_amount)} lançada no cartão.`)
        onSaved(saved)
      }, onError)
      return
    }
    const body = toPurchaseUpdate(purchase, values)
    if (Object.keys(body).length === 0) return onSaved(purchase)
    update.mutateAsync({ code: purchase.code, body }).then((saved) => {
      toast.success('Compra atualizada.')
      onSaved(saved)
    }, onError)
  })

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="contents" noValidate>
      <SheetBody>
        {!purchase && (
          <Controller
            control={control}
            name="card_code"
            render={({ field, fieldState }) => (
              <Field id="purchase-card" label="Cartão" error={fieldState.error?.message}>
                {(aria) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...aria}>
                      <SelectValue
                        placeholder={cards.isPending ? 'Carregando…' : 'Escolha o cartão'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {cards.data?.map((card) => (
                        <SelectItem key={card.code} value={card.code}>
                          {card.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
            )}
          />
        )}
        <Field
          id="purchase-description"
          label="Descrição"
          error={formState.errors.description?.message}
        >
          {(aria) => (
            <Input
              {...aria}
              {...register('description')}
              maxLength={100}
              autoComplete="off"
              placeholder="Ex.: Geladeira"
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Controller
            control={control}
            name="installment_amount"
            render={({ field, fieldState }) => (
              <Field
                id="purchase-amount"
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
            id="purchase-installments"
            label="Parcelas"
            error={formState.errors.installments?.message}
          >
            {(aria) => (
              <Input
                {...aria}
                type="number"
                inputMode="numeric"
                min={1}
                max={60}
                {...register('installments', { valueAsNumber: true })}
              />
            )}
          </Field>
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Total da compra:{' '}
          <strong className="text-foreground tabular-nums">
            {total === null ? '—' : formatMoney(total)}
          </strong>
        </p>
        <Field
          id="purchase-date"
          label="Data da compra"
          error={formState.errors.purchase_date?.message}
        >
          {(aria) => <Input {...aria} type="date" {...register('purchase_date')} />}
        </Field>
        <Controller
          control={control}
          name="category_code"
          render={({ field, fieldState }) => (
            <Field
              id="purchase-category"
              label="Categoria (opcional)"
              error={fieldState.error?.message}
            >
              {(aria) => (
                <CategorySelect
                  {...aria}
                  operationType="DEBIT"
                  value={field.value}
                  allowNone={!purchase?.category_code}
                  onChange={(code) => field.onChange(code)}
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
          {purchase ? 'Salvar' : 'Lançar compra'}
        </Button>
      </SheetFooter>
    </form>
  )
}
