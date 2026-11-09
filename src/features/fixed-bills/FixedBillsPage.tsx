import { LoaderCircle, Pencil, Plus, Repeat, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import type { FixedBillResponse, FixedBillStatus } from '@/api/contracts'
import { Amount } from '@/components/domain/Amount'
import { ConfirmDialog } from '@/components/domain/ConfirmDialog'
import { EmptyState } from '@/components/domain/EmptyState'
import { ErrorState } from '@/components/domain/ErrorState'
import { FormAlert } from '@/components/domain/FormAlert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { useCategoryLookup } from '@/features/categories/queries'
import { describeRecurrence } from '@/features/recurring/recurrence'
import {
  useDeleteFixedBill,
  useFixedBills,
  useSetFixedBillActive,
} from '@/features/recurring/queries'
import { errorMessage } from '@/lib/api-errors'
import { formatDate } from '@/lib/format'
import { useOnline } from '@/lib/online'
import { FixedBillForm } from './FixedBillForm'

/** Recorrentes › Fixas: rent, internet, salary... with the next posting date. */
export function FixedBillsPage() {
  const online = useOnline()
  const [status, setStatus] = useState<FixedBillStatus>('ACTIVE')
  const bills = useFixedBills({ status: [status] })
  const [selected, setSelected] = useState<FixedBillResponse | null>(null)
  const [creating, setCreating] = useState(false)

  const list = bills.data?.pages.flatMap((page) => page.content) ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ToggleGroup
          type="single"
          aria-label="Situação"
          value={status}
          onValueChange={(value) => value && setStatus(value as FixedBillStatus)}
          className="sm:w-72"
        >
          <ToggleGroupItem value="ACTIVE">Ativas</ToggleGroupItem>
          <ToggleGroupItem value="INACTIVE">Inativas</ToggleGroupItem>
        </ToggleGroup>
        <Button className="h-11 sm:ml-auto" onClick={() => setCreating(true)} disabled={!online}>
          <Plus aria-hidden />
          Nova conta fixa
        </Button>
      </div>

      {bills.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Carregando contas fixas">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : bills.isError ? (
        <ErrorState error={bills.error} onRetry={() => void bills.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title={status === 'ACTIVE' ? 'Nenhuma conta fixa ativa' : 'Nenhuma conta fixa inativa'}
          description="Aluguel, internet, salário: o que se repete toda semana, mês ou ano. O app lança no dia."
        />
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
                  <p className="truncate font-medium">{bill.description}</p>
                  <p className="text-sm text-muted-foreground">{describeRecurrence(bill)}</p>
                  <p className="text-xs text-muted-foreground">
                    {bill.next_due_date
                      ? `Próximo lançamento: ${formatDate(bill.next_due_date)}`
                      : 'Sem próximos lançamentos'}
                  </p>
                </div>
                <Amount operationType={bill.operation_type} amount={bill.amount} />
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
            <SheetTitle>Nova conta fixa</SheetTitle>
            <SheetDescription>
              Se hoje for dia dela, o lançamento de hoje é gerado ao salvar.
            </SheetDescription>
          </SheetHeader>
          {creating && <FixedBillForm onSaved={() => setCreating(false)} />}
        </SheetContent>
      </Sheet>
      <FixedBillSheet bill={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

function FixedBillSheet({
  bill,
  onClose,
}: {
  bill: FixedBillResponse | null
  onClose: () => void
}) {
  const [editing, setEditing] = useState(false)
  return (
    <Sheet
      open={bill !== null}
      onOpenChange={(open) => {
        if (!open) {
          setEditing(false)
          onClose()
        }
      }}
    >
      <SheetContent aria-describedby={undefined}>
        {bill &&
          (editing ? (
            <>
              <SheetHeader>
                <SheetTitle>Editar conta fixa</SheetTitle>
              </SheetHeader>
              <FixedBillForm
                bill={bill}
                onCancel={() => setEditing(false)}
                onSaved={() => {
                  setEditing(false)
                  onClose()
                }}
              />
            </>
          ) : (
            <FixedBillDetails bill={bill} onEdit={() => setEditing(true)} onDone={onClose} />
          ))}
      </SheetContent>
    </Sheet>
  )
}

function FixedBillDetails({
  bill,
  onEdit,
  onDone,
}: {
  bill: FixedBillResponse
  onEdit: () => void
  onDone: () => void
}) {
  const online = useOnline()
  const categories = useCategoryLookup()
  const setActive = useSetFixedBillActive()
  const remove = useDeleteFixedBill()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const active = bill.status === 'ACTIVE'
  const category = bill.category_code ? categories.get(bill.category_code) : undefined

  return (
    <>
      <SheetHeader>
        <SheetTitle>{bill.description}</SheetTitle>
        <div className="flex items-center gap-2">
          <Amount operationType={bill.operation_type} amount={bill.amount} className="text-2xl" />
          {!active && <Badge variant="muted">inativa</Badge>}
        </div>
      </SheetHeader>
      <SheetBody>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Repete</dt>
          <dd className="text-right">{describeRecurrence(bill)}</dd>
          <dt className="text-muted-foreground">Próximo</dt>
          <dd className="text-right">
            {bill.next_due_date ? formatDate(bill.next_due_date) : '—'}
          </dd>
          <dt className="text-muted-foreground">Vigência</dt>
          <dd className="text-right">
            {bill.start_date ? `desde ${formatDate(bill.start_date)}` : 'sem início'}
            {bill.end_date ? ` até ${formatDate(bill.end_date)}` : ''}
          </dd>
          <dt className="text-muted-foreground">Categoria</dt>
          <dd className="text-right">{category?.name ?? 'Sem categoria'}</dd>
        </dl>
        {error && <FormAlert message={error} />}
      </SheetBody>
      <SheetFooter className="sticky bottom-0 border-t bg-background">
        <Button
          variant="outline"
          className="h-11"
          disabled={setActive.isPending || !online}
          onClick={() =>
            setActive.mutateAsync({ code: bill.code, active: !active }).then(
              () => {
                toast.success(active ? 'Conta fixa inativada.' : 'Conta fixa ativada.')
                onDone()
              },
              (mutationError) => setError(errorMessage(mutationError)),
            )
          }
        >
          {active ? 'Inativar (parar de lançar)' : 'Ativar'}
        </Button>
        <div className="flex gap-2">
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
        </div>
      </SheetFooter>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Excluir conta fixa?"
        description="Ela para de lançar. Os lançamentos que ela já gerou continuam em Movimentações. Não há como desfazer."
        confirmLabel="Excluir"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutateAsync(bill.code).then(
            () => {
              setConfirmDelete(false)
              toast.success('Conta fixa excluída.')
              onDone()
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
