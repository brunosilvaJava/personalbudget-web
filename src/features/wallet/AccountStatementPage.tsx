import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUpRight,
  CreditCard,
  Flag,
  Pencil,
  ReceiptText,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import type { AccountResponse, AccountStatementEntryResponse } from '@/api/contracts'
import { ConfirmDialog } from '@/components/domain/ConfirmDialog'
import { ErrorState } from '@/components/domain/ErrorState'
import { FormAlert } from '@/components/domain/FormAlert'
import { LoadError } from '@/components/domain/LoadError'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PeriodPicker } from '@/features/period/PeriodPicker'
import { monthPeriod, readPeriod, writePeriod } from '@/features/period/period'
import { errorMessage } from '@/lib/api-errors'
import { currentMonth, shiftDate } from '@/lib/dates'
import { formatDate, formatMoney, formatSignedValue } from '@/lib/format'
import { useOnline } from '@/lib/online'
import { cn } from '@/lib/utils'
import { AccountFormSheet } from './AccountFormSheet'
import { ACCOUNT_TYPE_LABEL } from './labels'
import {
  useAccount,
  useAccountBalance,
  useAccountLookup,
  useAccountStatement,
  useSetAccountActive,
  useUpdateAccount,
} from './queries'
import { TransferFormSheet } from './TransferFormSheet'

/** One account: today's balance, its actions and the statement of the period (the month by default). */
export function AccountStatementPage() {
  const { code = '' } = useParams()
  const account = useAccount(code)

  return (
    <>
      <Button asChild variant="ghost" className="mb-2 -ml-3 h-11">
        <Link to="/carteira/contas">
          <ArrowLeft aria-hidden />
          Contas
        </Link>
      </Button>
      {account.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : account.isError ? (
        <LoadError error={account.error} onRetry={() => void account.refetch()} />
      ) : (
        <AccountView account={account.data} />
      )}
    </>
  )
}

function AccountView({ account }: { account: AccountResponse }) {
  const online = useOnline()
  const balance = useAccountBalance(account.code)
  const update = useUpdateAccount()
  const setActive = useSetAccountActive()
  const [editing, setEditing] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [confirmInactivate, setConfirmInactivate] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const active = account.status === 'ACTIVE'

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{account.name}</h1>
          {account.default && <Badge variant="secondary">padrão</Badge>}
          {!active && <Badge variant="muted">inativa</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">{ACCOUNT_TYPE_LABEL[account.type]}</p>
        <p className="mt-2 text-sm text-muted-foreground">Saldo hoje</p>
        {balance.isPending ? (
          <Skeleton className="h-8 w-40" />
        ) : balance.isError ? (
          <p className="text-sm text-destructive">{errorMessage(balance.error)}</p>
        ) : (
          <p
            className={cn(
              'text-3xl font-semibold tabular-nums',
              balance.data.balance < 0 && 'text-expense',
            )}
          >
            {formatMoney(balance.data.balance)}
          </p>
        )}
      </header>

      <div className="flex flex-wrap gap-2">
        {active && (
          <Button className="h-11" onClick={() => setTransferring(true)} disabled={!online}>
            <ArrowRightLeft aria-hidden />
            Transferir
          </Button>
        )}
        <Button variant="outline" className="h-11" onClick={() => setEditing(true)}>
          <Pencil aria-hidden />
          Editar
        </Button>
        {active && !account.default && (
          <Button
            variant="outline"
            className="h-11"
            disabled={update.isPending || !online}
            onClick={() =>
              update.mutate(
                { code: account.code, body: { default: true } },
                {
                  onSuccess: () => toast.success(`“${account.name}” agora é a conta padrão.`),
                  onError: (error) => setActionError(errorMessage(error)),
                },
              )
            }
          >
            <Flag aria-hidden />
            Tornar padrão
          </Button>
        )}
        {!account.default && (
          <Button
            variant="outline"
            className="h-11"
            disabled={setActive.isPending || !online}
            onClick={() =>
              active
                ? setConfirmInactivate(true)
                : setActive.mutate(
                    { code: account.code, active: true },
                    {
                      onSuccess: () => toast.success('Conta ativada.'),
                      onError: (error) => setActionError(errorMessage(error)),
                    },
                  )
            }
          >
            {active ? 'Inativar' : 'Ativar'}
          </Button>
        )}
      </div>
      {actionError && <FormAlert message={actionError} />}

      <Statement account={account} />

      <AccountFormSheet open={editing} onOpenChange={setEditing} account={account} />
      <TransferFormSheet
        open={transferring}
        onOpenChange={setTransferring}
        fromAccountCode={account.code}
      />
      <ConfirmDialog
        open={confirmInactivate}
        onOpenChange={setConfirmInactivate}
        title="Inativar conta?"
        description="Ela sai das listas de escolha, mas o histórico e o saldo continuam. Dá para ativar de novo."
        confirmLabel="Inativar"
        pending={setActive.isPending}
        onConfirm={() =>
          setActive.mutate(
            { code: account.code, active: false },
            {
              onSuccess: () => {
                setConfirmInactivate(false)
                toast.success('Conta inativada.')
              },
              onError: (error) => {
                setConfirmInactivate(false)
                setActionError(errorMessage(error))
              },
            },
          )
        }
      />
    </div>
  )
}

function Statement({ account }: { account: AccountResponse }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const defaultPeriod = monthPeriod(currentMonth())
  const period = readPeriod(searchParams) ?? defaultPeriod
  const statement = useAccountStatement(account.code, period.start, period.end)
  const accounts = useAccountLookup()

  return (
    <section aria-labelledby="statement-title" className="flex flex-col gap-3">
      <h2 id="statement-title" className="font-medium">
        Extrato
      </h2>
      <PeriodPicker
        period={period}
        defaultPeriod={defaultPeriod}
        onChange={(next) => setSearchParams(writePeriod(searchParams, next), { replace: true })}
        className="rounded-lg border bg-card p-1"
      />
      {statement.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : statement.isError ? (
        <ErrorState
          error={statement.error}
          onRetry={() => void statement.refetch()}
          retrying={statement.isRefetching}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <BalanceLine
            label={`Saldo em ${formatDate(shiftDate(statement.data.start_date, -1))}`}
            value={statement.data.opening_balance}
          />
          {statement.data.entries.length === 0 ? (
            <p className="border-t px-4 py-6 text-center text-sm text-muted-foreground">
              Nada entrou nem saiu desta conta no período.
            </p>
          ) : (
            <ul className="divide-y border-t">
              {statement.data.entries.map((entry, index) => (
                <li key={entryKey(entry, index)}>
                  <EntryRow
                    entry={entry}
                    counterpart={
                      entry.counterpart_account_code
                        ? accounts.get(entry.counterpart_account_code)?.name
                        : undefined
                    }
                  />
                </li>
              ))}
            </ul>
          )}
          <BalanceLine
            label={`Saldo em ${formatDate(statement.data.end_date)}`}
            value={statement.data.closing_balance}
            className="border-t"
          />
        </div>
      )}
    </section>
  )
}

function entryKey(entry: AccountStatementEntryResponse, index: number): string {
  return entry.settlement_code ?? entry.transfer_code ?? `${entry.type}-${index}`
}

function BalanceLine({
  label,
  value,
  className,
}: {
  label: string
  value: number
  className?: string
}) {
  return (
    <div
      className={cn('flex items-center justify-between bg-muted/50 px-4 py-3 text-sm', className)}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-medium tabular-nums', value < 0 && 'text-expense')}>
        {formatMoney(value)}
      </span>
    </div>
  )
}

const ENTRY_ICON = {
  INITIAL_BALANCE: Flag,
  SETTLEMENT: ReceiptText,
  TRANSFER_IN: ArrowDownLeft,
  TRANSFER_OUT: ArrowUpRight,
} as const

function EntryRow({
  entry,
  counterpart,
}: {
  entry: AccountStatementEntryResponse
  counterpart: string | undefined
}) {
  const Icon = entry.invoice_payment_code ? CreditCard : ENTRY_ICON[entry.type]
  let detail: ReactNode = null
  if (entry.type === 'TRANSFER_IN') detail = `Transferência de ${counterpart ?? 'outra conta'}`
  if (entry.type === 'TRANSFER_OUT') detail = `Transferência para ${counterpart ?? 'outra conta'}`
  if (entry.invoice_payment_code) detail = 'Pagamento de fatura'
  if (entry.type === 'INITIAL_BALANCE') detail = 'Não conta como receita'

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {entry.description ?? (entry.type === 'TRANSFER_IN' ? 'Entrada' : 'Saída')}
        </p>
        <p className="text-sm text-muted-foreground">
          {formatDate(entry.date)}
          {detail && <> · {detail}</>}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span
          className={cn(
            'font-medium tabular-nums',
            entry.amount > 0 && 'text-income',
            entry.amount < 0 && 'text-expense',
          )}
        >
          {formatSignedValue(entry.amount)}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatMoney(entry.balance)}
        </span>
      </div>
    </div>
  )
}
