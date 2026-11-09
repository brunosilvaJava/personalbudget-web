import {
  ArrowLeft,
  CreditCard,
  LoaderCircle,
  Pencil,
  ReceiptText,
  Repeat,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import type { FinancialMovementResponse, MovementSettlementResponse } from '@/api/contracts'
import { Amount } from '@/components/domain/Amount'
import { ConfirmDialog } from '@/components/domain/ConfirmDialog'
import { ErrorState } from '@/components/domain/ErrorState'
import { FormAlert } from '@/components/domain/FormAlert'
import { LoadError } from '@/components/domain/LoadError'
import { StatusBadge } from '@/components/domain/StatusBadge'
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
import { useCategoryLookup } from '@/features/categories/queries'
import { ClosedCycleNote } from '@/features/pay-cycles/ClosedCycleNote'
import { useClosedCycle } from '@/features/pay-cycles/queries'
import { AccountSelect } from '@/features/wallet/AccountSelect'
import { PurchaseSheet } from '@/features/wallet/PurchaseSheet'
import { useActiveAccounts } from '@/features/wallet/queries'
import { errorMessage } from '@/lib/api-errors'
import { dateOf, todayIso } from '@/lib/dates'
import { formatDate, formatMoney, formatTime } from '@/lib/format'
import { useOnline } from '@/lib/online'
import { cardInstallmentLabel, isCardInstallment } from './card'
import { MovementEditForm } from './MovementEditForm'
import {
  useCreateSettlement,
  useDeleteMovement,
  useMovement,
  useReverseSettlement,
  useSettlements,
} from './queries'
import { remainingAmount } from './schema'

type Mode = 'details' | 'pay' | 'edit'

interface MovementSheetProps {
  /** the row that was tapped; null closes the sheet */
  movement: FinancialMovementResponse | null
  onClose: () => void
}

/** A movement's details and actions: pay (whole remaining amount), reverse, edit and delete. */
export function MovementSheet({ movement, onClose }: MovementSheetProps) {
  const [mode, setMode] = useState<Mode>('details')
  const [shown, setShown] = useState(movement)
  // Reset to the details when another movement is opened.
  if (movement && movement.code !== shown?.code) {
    setShown(movement)
    setMode('details')
  }

  return (
    <Sheet
      open={movement !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
          setMode('details')
        }
      }}
    >
      <SheetContent aria-describedby={undefined}>
        {movement && (
          <MovementSheetContent
            key={movement.code}
            initial={movement}
            mode={mode}
            setMode={setMode}
            onClose={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function MovementSheetContent({
  initial,
  mode,
  setMode,
  onClose,
}: {
  initial: FinancialMovementResponse
  mode: Mode
  setMode: (mode: Mode) => void
  onClose: () => void
}) {
  const query = useMovement(initial)

  if (query.isError) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>{initial.description}</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <LoadError error={query.error} onRetry={() => void query.refetch()} />
        </SheetBody>
      </>
    )
  }

  const movement = query.data ?? initial
  const credit = movement.operation_type === 'CREDIT'

  if (mode === 'edit') {
    return (
      <>
        <SheetHeader>
          <BackTitle onBack={() => setMode('details')}>Editar movimentação</BackTitle>
        </SheetHeader>
        <MovementEditForm
          movement={movement}
          onCancel={() => setMode('details')}
          onSaved={() => setMode('details')}
        />
      </>
    )
  }

  if (mode === 'pay') {
    return (
      <>
        <SheetHeader>
          <BackTitle onBack={() => setMode('details')}>
            {credit ? 'Registrar recebimento' : 'Registrar pagamento'}
          </BackTitle>
          <SheetDescription>{movement.description}</SheetDescription>
        </SheetHeader>
        <PayForm movement={movement} onDone={() => setMode('details')} />
      </>
    )
  }

  return (
    <Details
      movement={movement}
      onPay={() => setMode('pay')}
      onEdit={() => setMode('edit')}
      onDeleted={onClose}
    />
  )
}

function BackTitle({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  return (
    <div className="-ml-2 flex items-center gap-1">
      <Button variant="ghost" size="icon" className="size-10" onClick={onBack} aria-label="Voltar">
        <ArrowLeft className="size-5" aria-hidden />
      </Button>
      <SheetTitle>{children}</SheetTitle>
    </div>
  )
}

function Details({
  movement,
  onPay,
  onEdit,
  onDeleted,
}: {
  movement: FinancialMovementResponse
  onPay: () => void
  onEdit: () => void
  onDeleted: () => void
}) {
  const online = useOnline()
  const categories = useCategoryLookup()
  const remove = useDeleteMovement()
  const closedCycle = useClosedCycle(movement.competence_date ?? undefined)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [showPurchase, setShowPurchase] = useState(false)

  const card = isCardInstallment(movement)
  const credit = movement.operation_type === 'CREDIT'
  const paid = movement.status === 'PAID_OUT'
  const amountPaid = movement.amount_paid ?? 0
  const category = movement.category_code ? categories.get(movement.category_code) : undefined

  return (
    <>
      <SheetHeader>
        <SheetTitle className="pr-2">{movement.description}</SheetTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Amount
            operationType={movement.operation_type}
            amount={movement.amount}
            className="text-2xl"
          />
          <StatusBadge status={movement.status} operationType={movement.operation_type} />
        </div>
      </SheetHeader>
      <SheetBody>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <Row label="Data">
            {formatDate(movement.movement_date)}
            {/* Recurring movements are posted at midnight: the time says nothing there. */}
            {!movement.movement_date.endsWith('T00:00:00') &&
              ` às ${formatTime(movement.movement_date)}`}
          </Row>
          <Row label="Vencimento">{formatDate(movement.due_date)}</Row>
          <Row label="Categoria">
            {movement.category_code
              ? `${category?.name ?? '…'}${category?.status === 'INACTIVE' ? ' (inativa)' : ''}`
              : 'Sem categoria'}
          </Row>
          {movement.competence_date && (
            <Row label="Competência">
              {formatDate(movement.competence_date)}
              {movement.competence_overridden ? ' (escolhida)' : ''}
            </Row>
          )}
          {amountPaid > 0 && !paid && (
            <Row label={credit ? 'Recebido' : 'Pago'}>
              {formatMoney(amountPaid)} de {formatMoney(movement.amount)}
            </Row>
          )}
        </dl>
        <div className="flex flex-wrap gap-1.5">
          {card && (
            <Badge variant="secondary">
              <CreditCard aria-hidden />
              {cardInstallmentLabel(movement)}
            </Badge>
          )}
          {movement.recurrence_bill_code && !card && (
            <Badge variant="secondary">
              <Repeat aria-hidden />
              gerada por conta recorrente
            </Badge>
          )}
        </div>

        {card ? (
          <div className="flex flex-col gap-3 rounded-lg bg-muted p-3 text-sm">
            <p className="text-muted-foreground">
              Parcela de cartão: ela é paga junto com a fatura e alterada pela compra.
            </p>
            <div className="flex gap-2">
              {movement.card_invoice_code && (
                <Button asChild className="h-11 flex-1">
                  <Link to={`/carteira/faturas/${movement.card_invoice_code}`}>
                    <ReceiptText aria-hidden />
                    Ver fatura
                  </Link>
                </Button>
              )}
              <Button
                variant="outline"
                className="h-11 flex-1"
                onClick={() => setShowPurchase(true)}
              >
                <CreditCard aria-hidden />
                Ver compra
              </Button>
            </div>
          </div>
        ) : (
          <SettlementList movement={movement} />
        )}

        {closedCycle && !card && (
          <ClosedCycleNote cycle={closedCycle}>
            Esta movimentação não pode ser excluída, e valor, tipo, categoria e competência ficam
            travados. Pagar e estornar continuam livres. Reabra o ciclo para mudar o resto.
          </ClosedCycleNote>
        )}

        {deleteError && <FormAlert message={deleteError} />}
      </SheetBody>
      {!card && (
        <SheetFooter className="sticky bottom-0 border-t bg-background">
          {!paid && (
            <Button className="h-12 text-base" onClick={onPay} disabled={!online}>
              {credit ? 'Receber' : 'Pagar'} {formatMoney(remainingAmount(movement))}
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="h-11 flex-1" onClick={onEdit}>
              <Pencil aria-hidden />
              Editar
            </Button>
            <Button
              variant="outline"
              className="h-11 flex-1 text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={!online || closedCycle !== null}
            >
              <Trash2 aria-hidden />
              Excluir
            </Button>
          </div>
        </SheetFooter>
      )}
      {card && (
        <PurchaseSheet
          open={showPurchase}
          onOpenChange={setShowPurchase}
          purchaseCode={movement.card_purchase_code}
        />
      )}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Excluir movimentação?"
        description={`“${movement.description}” sai da lista e dos saldos. Não há como desfazer.`}
        confirmLabel="Excluir"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(movement.code, {
            onSuccess: () => {
              setConfirmDelete(false)
              toast.success('Movimentação excluída.')
              onDeleted()
            },
            onError: (error) => {
              setConfirmDelete(false)
              setDeleteError(errorMessage(error))
            },
          })
        }
      />
    </>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">{children}</dd>
    </>
  )
}

/** Payments and receipts of the movement, newest first, reversed ones struck through. */
function SettlementList({ movement }: { movement: FinancialMovementResponse }) {
  const online = useOnline()
  const settlements = useSettlements(movement.code)
  const reverse = useReverseSettlement()
  const [toReverse, setToReverse] = useState<MovementSettlementResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const credit = movement.operation_type === 'CREDIT'
  const title = credit ? 'Recebimentos' : 'Pagamentos'

  if (settlements.isPending) {
    return (
      <section aria-label={title} className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-11 w-full" />
      </section>
    )
  }
  if (settlements.isError) {
    return (
      <ErrorState
        error={settlements.error}
        title={`Não foi possível carregar os ${title.toLowerCase()}`}
        onRetry={() => void settlements.refetch()}
        className="py-6"
      />
    )
  }
  if (settlements.data.length === 0) return null

  const list = [...settlements.data].sort((a, b) =>
    b.effective_date.localeCompare(a.effective_date),
  )

  return (
    <section aria-labelledby="settlements-title" className="flex flex-col gap-2">
      <h3 id="settlements-title" className="text-sm font-medium">
        {title}
      </h3>
      <ul className="divide-y rounded-lg border">
        {list.map((settlement) => {
          const reversed = settlement.reversed_at !== null
          return (
            <li
              key={settlement.code}
              className="flex min-h-12 items-center gap-3 px-3 py-2 text-sm"
            >
              <div className={reversed ? 'flex-1 text-muted-foreground line-through' : 'flex-1'}>
                <span className="tabular-nums">{formatMoney(settlement.amount)}</span>
                <span className="text-muted-foreground">
                  {' '}
                  em {formatDate(settlement.effective_date)}
                </span>
              </div>
              {reversed ? (
                <Badge variant="muted">
                  estornado em {formatDate(dateOf(settlement.reversed_at!))}
                </Badge>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10"
                  onClick={() => setToReverse(settlement)}
                  disabled={!online}
                >
                  <Undo2 aria-hidden />
                  Estornar
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      {error && <FormAlert message={error} />}
      <ConfirmDialog
        open={toReverse !== null}
        onOpenChange={(open) => !open && setToReverse(null)}
        title={credit ? 'Estornar recebimento?' : 'Estornar pagamento?'}
        description={
          toReverse &&
          `${formatMoney(toReverse.amount)} de ${formatDate(toReverse.effective_date)} deixa de contar. O registro fica no histórico, e a movimentação volta a ficar pendente.`
        }
        confirmLabel="Estornar"
        pending={reverse.isPending}
        onConfirm={() => {
          if (!toReverse) return
          setError(null)
          reverse.mutate(
            { movementCode: movement.code, settlementCode: toReverse.code },
            {
              onSuccess: () => {
                setToReverse(null)
                toast.success('Estorno registrado.')
              },
              onError: (reverseError) => {
                setToReverse(null)
                setError(errorMessage(reverseError))
              },
            },
          )
        }}
      />
    </section>
  )
}

/** "Marcar como pago" is always the WHOLE remaining amount in the MVP; only the date is chosen. */
function PayForm({
  movement,
  onDone,
}: {
  movement: FinancialMovementResponse
  onDone: () => void
}) {
  const online = useOnline()
  const pay = useCreateSettlement()
  const accounts = useActiveAccounts()
  const defaultAccount = accounts.data?.find((account) => account.default)?.code ?? null
  const [chosenAccount, setChosenAccount] = useState<string | null>(null)
  const accountCode = chosenAccount ?? defaultAccount
  const [date, setDate] = useState(todayIso())
  const [error, setError] = useState<string | null>(null)
  const credit = movement.operation_type === 'CREDIT'
  const remaining = remainingAmount(movement)

  return (
    <form
      className="contents"
      onSubmit={(event) => {
        event.preventDefault()
        if (!date) return
        setError(null)
        pay.mutate(
          {
            code: movement.code,
            body: {
              amount: remaining,
              effective_date: date,
              ...(accountCode ? { account_code: accountCode } : {}),
            },
          },
          {
            onSuccess: () => {
              toast.success(credit ? 'Recebimento registrado.' : 'Pagamento registrado.')
              onDone()
            },
            onError: (payError) => setError(errorMessage(payError)),
          },
        )
      }}
    >
      <SheetBody>
        <div className="rounded-lg bg-muted p-4">
          <p className="text-sm text-muted-foreground">
            {(movement.amount_paid ?? 0) > 0 ? 'O que falta' : 'Valor'}
          </p>
          <p className="text-2xl font-semibold tabular-nums">{formatMoney(remaining)}</p>
        </div>
        {(accounts.data?.length ?? 0) > 1 && (
          <Field id="pay-account" label={credit ? 'Recebido na conta' : 'Pago com a conta'}>
            {(aria) => <AccountSelect {...aria} value={accountCode} onChange={setChosenAccount} />}
          </Field>
        )}
        <Field id="pay-date" label={credit ? 'Recebido em' : 'Pago em'}>
          {(aria) => (
            <Input
              {...aria}
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          )}
        </Field>
        {error && <FormAlert message={error} />}
      </SheetBody>
      <SheetFooter className="sticky bottom-0 border-t bg-background">
        <Button
          type="submit"
          className="h-12 text-base"
          disabled={pay.isPending || !online || !date}
        >
          {pay.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
          {credit ? 'Confirmar recebimento' : 'Confirmar pagamento'}
        </Button>
      </SheetFooter>
    </form>
  )
}
