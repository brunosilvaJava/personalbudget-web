import { ChartLine, ChevronRight } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts'

import type { DailyBalance } from '@/api/contracts'
import { EmptyState } from '@/components/domain/EmptyState'
import { ErrorState } from '@/components/domain/ErrorState'
import { PageHeader } from '@/components/layout/PageHeader'
import { ChartContainer, ChartLegend, type ChartConfig } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { PeriodPicker } from '@/features/period/PeriodPicker'
import { readPeriod, writePeriod } from '@/features/period/period'
import { useDefaultPeriod } from '@/features/period/queries'
import { todayIso } from '@/lib/dates'
import { formatDayHeader, formatMoney, formatShortDate, formatSignedValue } from '@/lib/format'
import { fromCents, toCents } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useDailyBalance } from './queries'

const chartConfig = {
  real: { label: 'Real (pago)', color: 'var(--income)' },
  projected: { label: 'Projetado', color: 'var(--primary)' },
} satisfies ChartConfig

/**
 * Caixa diário: real x projected closing of each day of the period (the current cycle by default,
 * else the month; the end is inclusive, so a cycle ends on last_day). Cash based: it does not add
 * the accounts' initial balances.
 */
export function DailyBalancePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { period: fallback } = useDefaultPeriod()
  const period = readPeriod(searchParams) ?? fallback
  const focusDay = searchParams.get('dia')
  const balance = useDailyBalance(period?.start, period?.end)

  return (
    <>
      <PageHeader title="Caixa diário" description="Entradas, saídas e saldo, dia a dia" />
      <div className="flex flex-col gap-4">
        {period ? (
          <PeriodPicker
            period={period}
            defaultPeriod={fallback}
            onChange={(next) => {
              const params = writePeriod(searchParams, next)
              params.delete('dia')
              setSearchParams(params, { replace: true })
            }}
            className="rounded-lg border bg-card p-1"
          />
        ) : (
          <div className="h-[54px] rounded-lg border bg-card" aria-hidden />
        )}
        {!period || balance.isPending ? (
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando o caixa">
            <Skeleton className="aspect-video w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : balance.isError ? (
          <ErrorState
            error={balance.error}
            onRetry={() => void balance.refetch()}
            retrying={balance.isRefetching}
          />
        ) : balance.data.length === 0 ? (
          <EmptyState icon={ChartLine} title="Nada no período" />
        ) : (
          <>
            <BalanceChart days={balance.data} />
            <p className="text-xs text-muted-foreground">
              Saldo do movimento, sem o saldo inicial das contas. O dinheiro de hoje nas contas está
              em “Saldo nas contas”, no Início.
            </p>
            <DayList days={balance.data} focusDay={focusDay} />
          </>
        )}
      </div>
    </>
  )
}

function BalanceChart({ days }: { days: DailyBalance[] }) {
  const today = todayIso()
  const data = useMemo(
    () =>
      days.map((day) => ({
        date: day.date,
        // The real line stops today: after it, only the projection says something.
        real: day.date <= today ? day.balance.closing : null,
        projected: day.projected.closing,
      })),
    [days, today],
  )
  return (
    <section
      aria-label="Gráfico do saldo real e projetado"
      className="rounded-lg border bg-card p-3"
    >
      <ChartContainer config={chartConfig} className="aspect-[16/9] w-full lg:aspect-[3/1]">
        <LineChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tickFormatter={(value: string) => formatShortDate(value)}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(value: number) => compactMoney(value)}
          />
          <ReferenceLine y={0} stroke="var(--warning)" strokeDasharray="4 4" />
          <Tooltip
            formatter={(value, name) => [
              formatMoney(Number(value)),
              chartConfig[name as keyof typeof chartConfig]?.label ?? String(name),
            ]}
            labelFormatter={(label) => formatDayHeader(String(label))}
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--popover-foreground)',
            }}
          />
          <Line
            dataKey="projected"
            type="monotone"
            stroke="var(--color-projected)"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="real"
            type="monotone"
            stroke="var(--color-real)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
      <ChartLegend config={chartConfig} />
    </section>
  )
}

const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
function compactMoney(value: number): string {
  return compact.format(value)
}

/** Each day: what came in, went out and the closing; tapping opens the movements of that day. */
function DayList({ days, focusDay }: { days: DailyBalance[]; focusDay: string | null }) {
  const today = todayIso()
  useEffect(() => {
    if (!focusDay) return
    document.getElementById(`day-${focusDay}`)?.scrollIntoView({ block: 'center' })
  }, [focusDay])

  return (
    <ul className="divide-y overflow-hidden rounded-lg border bg-card">
      {days.map((day) => {
        const future = day.date > today
        const revenue = fromCents(
          toCents(day.balance.total_revenue) + toCents(day.projected.pending_total_revenue),
        )
        const expense = fromCents(
          toCents(day.balance.total_expense) + toCents(day.projected.pending_total_expense),
        )
        const closing = future ? day.projected.closing : day.balance.closing
        const quiet = revenue === 0 && expense === 0
        return (
          <li key={day.date} id={`day-${day.date}`}>
            <Link
              to={`/movimentacoes?inicio=${day.date}&fim=${day.date}`}
              className={cn(
                'flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/60',
                day.date === focusDay && 'bg-warning/10',
                day.date === today && 'bg-accent/40',
              )}
            >
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'text-sm font-medium first-letter:uppercase',
                    quiet && 'text-muted-foreground',
                  )}
                >
                  {formatDayHeader(day.date)}
                  {day.date === today && ' · hoje'}
                </p>
                {!quiet && (
                  <p className="text-xs tabular-nums">
                    {revenue !== 0 && (
                      <span className="text-income">{formatSignedValue(revenue)}</span>
                    )}
                    {revenue !== 0 && expense !== 0 && (
                      <span className="text-muted-foreground"> · </span>
                    )}
                    {expense !== 0 && (
                      <span className="text-expense">{formatSignedValue(expense)}</span>
                    )}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end text-right">
                <span className={cn('font-medium tabular-nums', closing < 0 && 'text-expense')}>
                  {formatMoney(closing)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {future ? 'projetado' : `projetado ${formatMoney(day.projected.closing)}`}
                </span>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
