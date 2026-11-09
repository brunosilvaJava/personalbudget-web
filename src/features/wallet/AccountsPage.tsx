import { ChevronRight, Plus, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import type { AccountResponse, Money, UUID } from '@/api/contracts'
import { EmptyState } from '@/components/domain/EmptyState'
import { ErrorState } from '@/components/domain/ErrorState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { AccountFormSheet } from './AccountFormSheet'
import { ACCOUNT_TYPE_ICON, ACCOUNT_TYPE_LABEL } from './labels'
import { useAccountBalances, useAllAccounts } from './queries'

/** Each account with today's balance, and "Saldo nas contas" (the real total) on top. */
export function AccountsPage() {
  const accounts = useAllAccounts()
  const balances = useAccountBalances()
  const [creating, setCreating] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  if (accounts.isPending) return <AccountsSkeleton />
  if (accounts.isError) {
    return <ErrorState error={accounts.error} onRetry={() => void accounts.refetch()} />
  }

  const balanceOf = new Map<UUID, Money>(
    (balances.data?.accounts ?? []).map((item) => [item.account_code, item.balance]),
  )
  const active = accounts.data.filter((account) => account.status === 'ACTIVE')
  const inactive = accounts.data.filter((account) => account.status === 'INACTIVE')

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="total-title" className="rounded-lg border bg-card p-4">
        <h2 id="total-title" className="text-sm text-muted-foreground">
          Saldo nas contas hoje
        </h2>
        {balances.isPending ? (
          <Skeleton className="mt-2 h-8 w-40" />
        ) : balances.isError ? (
          <p className="mt-1 text-sm text-destructive">Não foi possível calcular o saldo.</p>
        ) : (
          <p
            className={cn(
              'mt-1 text-3xl font-semibold tabular-nums',
              balances.data.total < 0 && 'text-expense',
            )}
          >
            {formatMoney(balances.data.total)}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          Soma das contas, com o saldo inicial. Transferências entre elas se anulam.
        </p>
      </section>

      <div className="flex items-center justify-between">
        <h2 className="font-medium">Contas</h2>
        <Button variant="outline" className="h-11" onClick={() => setCreating(true)}>
          <Plus aria-hidden />
          Nova conta
        </Button>
      </div>

      {active.length === 0 ? (
        <EmptyState icon={Wallet} title="Nenhuma conta ativa" />
      ) : (
        <AccountList accounts={active} balanceOf={balanceOf} />
      )}

      {inactive.length > 0 && (
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            className="h-11 justify-start text-muted-foreground"
            onClick={() => setShowInactive(!showInactive)}
            aria-expanded={showInactive}
          >
            {showInactive ? 'Esconder' : 'Mostrar'} inativas ({inactive.length})
          </Button>
          {showInactive && <AccountList accounts={inactive} balanceOf={balanceOf} />}
        </div>
      )}

      <AccountFormSheet open={creating} onOpenChange={setCreating} />
    </div>
  )
}

function AccountList({
  accounts,
  balanceOf,
}: {
  accounts: AccountResponse[]
  balanceOf: Map<UUID, Money>
}) {
  return (
    <ul className="divide-y overflow-hidden rounded-lg border bg-card">
      {accounts.map((account) => {
        const Icon = ACCOUNT_TYPE_ICON[account.type]
        const balance = balanceOf.get(account.code)
        return (
          <li key={account.code}>
            <Link
              to={`/carteira/contas/${account.code}`}
              className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/60"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <Icon className="size-5 text-muted-foreground" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{account.name}</p>
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  {ACCOUNT_TYPE_LABEL[account.type]}
                  {account.default && <Badge variant="secondary">padrão</Badge>}
                </p>
              </div>
              <span
                className={cn(
                  'font-medium whitespace-nowrap tabular-nums',
                  balance !== undefined && balance < 0 && 'text-expense',
                )}
              >
                {balance === undefined ? '…' : formatMoney(balance)}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function AccountsSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando contas">
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  )
}
