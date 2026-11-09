import { ChevronDown, ChevronRight, TriangleAlert } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'

import type { DashboardResponse, Money } from '@/api/contracts'
import { ErrorState } from '@/components/domain/ErrorState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PeriodPicker } from '@/features/period/PeriodPicker'
import { monthPeriod } from '@/features/period/period'
import { useAccountBalances, useAllAccounts } from '@/features/wallet/queries'
import { currentMonth, monthOf, monthRange } from '@/lib/dates'
import { formatDate, formatMoney, formatSignedValue } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useDashboard } from './queries'

const MONTH = /^\d{4}-\d{2}$/

/**
 * Início: "Saldo nas contas" (the real money today, initial balances included) on top, then the
 * month's flows from /dashboard. The dashboard does not add the accounts' initial balances, so its
 * balances are labelled as movement of the month, not as the bank balance.
 */
export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const param = searchParams.get('mes')
  const month = param && MONTH.test(param) ? param : currentMonth()
  const dashboard = useDashboard(month)

  return (
    <>
      <PageHeader title="Início" description="Seu dinheiro hoje e o movimento do mês" />
      <div className="flex flex-col gap-4">
        <AccountsBalanceCard />
        {dashboard.data?.has_negative_balance_alert && <NegativeAlert dashboard={dashboard.data} />}
        <PeriodPicker
          period={monthPeriod(month)}
          defaultPeriod={monthPeriod(currentMonth())}
          onChange={(period) => {
            const next = new URLSearchParams(searchParams)
            const chosen = monthOf(period.start)
            if (chosen === currentMonth()) next.delete('mes')
            else next.set('mes', chosen)
            setSearchParams(next, { replace: true })
          }}
          className="rounded-lg border bg-card p-1"
        />
        {dashboard.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2" aria-busy="true" aria-label="Carregando o mês">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-28" />
            ))}
          </div>
        ) : dashboard.isError ? (
          <ErrorState
            error={dashboard.error}
            onRetry={() => void dashboard.refetch()}
            retrying={dashboard.isRefetching}
          />
        ) : (
          <MonthCards dashboard={dashboard.data} month={month} />
        )}
      </div>
    </>
  )
}

/** The total of GET /account/balance; the list per account opens on tap. */
function AccountsBalanceCard() {
  const balances = useAccountBalances()
  const accounts = useAllAccounts()
  const [open, setOpen] = useState(false)
  const names = new Map((accounts.data ?? []).map((account) => [account.code, account.name]))

  return (
    <section aria-labelledby="accounts-balance" className="rounded-lg border bg-card">
      <button
        type="button"
        className="flex w-full items-center gap-3 p-4 text-left"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="accounts-balance-list"
      >
        <div className="flex-1">
          <h2 id="accounts-balance" className="text-sm text-muted-foreground">
            Saldo nas contas
          </h2>
          {balances.isPending ? (
            <Skeleton className="mt-2 h-9 w-44" />
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
        </div>
        <ChevronDown
          className={cn('size-5 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open && balances.data && (
        <ul id="accounts-balance-list" className="divide-y border-t">
          {balances.data.accounts
            .filter((item) => item.balance !== 0 || names.has(item.account_code))
            .map((item) => (
              <li key={item.account_code}>
                <Link
                  to={`/carteira/contas/${item.account_code}`}
                  className="flex min-h-12 items-center gap-3 px-4 py-2 text-sm hover:bg-accent/60"
                >
                  <span className="flex-1">{names.get(item.account_code) ?? 'Conta'}</span>
                  <span
                    className={cn('font-medium tabular-nums', item.balance < 0 && 'text-expense')}
                  >
                    {formatMoney(item.balance)}
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
        </ul>
      )}
    </section>
  )
}

function NegativeAlert({ dashboard }: { dashboard: DashboardResponse }) {
  const month = monthRange(monthOf(dashboard.reference_month))
  const day = dashboard.lowest_balance_date ?? dashboard.first_negative_balance_date
  const params = new URLSearchParams({ inicio: month.start, fim: month.end })
  if (day) params.set('dia', day)
  return (
    <Link
      to={`/caixa?${params}`}
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm transition-colors hover:bg-warning/15"
    >
      <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
      <div className="flex-1">
        <p className="font-medium">
          O movimento do mês fica negativo
          {dashboard.first_negative_balance_date &&
            ` em ${formatDate(dashboard.first_negative_balance_date)}`}
        </p>
        <p className="text-muted-foreground">
          Menor saldo projetado: {formatMoney(dashboard.lowest_projected_balance)}
          {dashboard.lowest_balance_date && ` em ${formatDate(dashboard.lowest_balance_date)}`}.
          Toque para ver o caixa do dia.
        </p>
      </div>
      <ChevronRight className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
    </Link>
  )
}

function MonthCards({ dashboard, month }: { dashboard: DashboardResponse; month: string }) {
  const isCurrent = month === currentMonth()
  const range = monthRange(month)
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard
          title="Receitas do mês"
          real={dashboard.month_total_revenue}
          projected={dashboard.month_projected_total_revenue}
        />
        <StatCard
          title="Despesas do mês"
          real={dashboard.month_total_expense}
          projected={dashboard.month_projected_total_expense}
        />
        <StatCard
          title="Resultado do mês"
          hint="Receitas menos despesas"
          real={dashboard.month_net_change}
          projected={dashboard.projected_net_change}
          signed
        />
        <StatCard
          title="Fechamento do mês (movimento)"
          hint="Movimento acumulado no fim do mês, sem o saldo inicial das contas"
          real={dashboard.month_closing_balance}
          projected={dashboard.month_projected_closing_balance}
          signed
        />
        {isCurrent && (
          <StatCard
            title="Movimento acumulado hoje"
            hint="Não é o saldo do banco: esse é o “Saldo nas contas”"
            real={dashboard.current_balance}
            projected={dashboard.current_projected_balance}
            signed
          />
        )}
      </div>
      {isCurrent && <MonthProgress dashboard={dashboard} />}
      <Button asChild variant="outline" className="h-11 self-start">
        <Link to={`/caixa?inicio=${range.start}&fim=${range.end}`}>
          Ver o caixa dia a dia
          <ChevronRight aria-hidden />
        </Link>
      </Button>
    </>
  )
}

function StatCard({
  title,
  hint,
  real,
  projected,
  signed,
}: {
  title: string
  hint?: string
  real: Money
  projected: Money
  /** a balance or a result: show the sign; revenue and expense show their color */
  signed?: boolean
}) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border bg-card p-4">
      <h3 className="text-sm text-muted-foreground">{title}</h3>
      <Value value={real} signed={signed} className="text-2xl font-semibold" />
      <p className="text-sm text-muted-foreground">
        Projetado: <Value value={projected} signed={signed} className="font-medium" />
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </section>
  )
}

function Value({
  value,
  signed,
  className,
}: {
  value: Money
  signed?: boolean
  className?: string
}): ReactNode {
  return (
    <span
      className={cn(
        'tabular-nums',
        value < 0 && 'text-expense',
        value > 0 && !signed && 'text-income',
        className,
      )}
    >
      {signed ? formatSignedValue(value) : formatMoney(Math.abs(value))}
    </span>
  )
}

function MonthProgress({ dashboard }: { dashboard: DashboardResponse }) {
  const share = dashboard.total_days_in_month
    ? dashboard.days_elapsed / dashboard.total_days_in_month
    : 0
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border bg-card p-4 text-sm">
      <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-primary" style={{ width: `${share * 100}%` }} />
      </div>
      <p className="text-muted-foreground">
        Dia {dashboard.days_elapsed} de {dashboard.total_days_in_month} · faltam{' '}
        {dashboard.days_remaining} {dashboard.days_remaining === 1 ? 'dia' : 'dias'}
      </p>
    </div>
  )
}
