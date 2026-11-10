import { ArrowLeftRight, LoaderCircle } from 'lucide-react'
import { useEffect, useEffectEvent, useRef } from 'react'

import type { FinancialMovementResponse } from '@/api/contracts'
import { EmptyState } from '@/components/domain/EmptyState'
import { ErrorState } from '@/components/domain/ErrorState'
import { LaunchButton } from '@/components/layout/LaunchButton'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCategoryLookup } from '@/features/categories/queries'
import { useThirdPartyLookup } from '@/features/third-parties/queries'
import { formatDayHeader, formatSignedValue } from '@/lib/format'
import type { MovementListFilters } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { groupByDay } from './grouping'
import { MovementRow } from './MovementRow'
import { useMovementList } from './queries'

interface MovementListProps {
  filters: MovementListFilters | undefined
  /** true when some filter besides the period is on: the empty state says so */
  filtered: boolean
  onClearFilters?: () => void
  onSelect?: (movement: FinancialMovementResponse) => void
}

export function MovementList({ filters, filtered, onClearFilters, onSelect }: MovementListProps) {
  const list = useMovementList(filters)
  const categories = useCategoryLookup()
  const thirdParties = useThirdPartyLookup()
  const sentinel = useLoadMoreOnScroll(
    () => void list.fetchNextPage(),
    list.hasNextPage && !list.isFetchingNextPage,
  )

  if (list.isPending) return <MovementListSkeleton />
  if (list.isError) {
    return (
      <ErrorState
        error={list.error}
        onRetry={() => void list.refetch()}
        retrying={list.isRefetching}
      />
    )
  }

  const movements = list.data.pages.flatMap((page) => page.content)
  const total = list.data.pages[0]?.total_elements ?? 0

  if (movements.length === 0) {
    return filtered ? (
      <EmptyState
        icon={ArrowLeftRight}
        title="Nada encontrado com esses filtros"
        description="Tente outro período ou tire algum filtro."
        action={
          onClearFilters && (
            <Button variant="outline" className="h-11" onClick={onClearFilters}>
              Limpar filtros
            </Button>
          )
        }
      />
    ) : (
      <EmptyState
        icon={ArrowLeftRight}
        title="Nenhuma movimentação no período"
        description="Lance uma despesa ou receita para ela aparecer aqui."
        action={<LaunchButton variant="wide" className="w-auto px-6" />}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {total === 1 ? '1 movimentação' : `${total} movimentações`}
      </p>
      {groupByDay(movements).map((day) => (
        <section key={day.date} aria-labelledby={`day-${day.date}`}>
          <header className="mb-1.5 flex items-baseline justify-between gap-3 px-1">
            <h2 id={`day-${day.date}`} className="text-sm font-medium first-letter:uppercase">
              {formatDayHeader(day.date)}
            </h2>
            <span
              className={cn(
                'text-xs tabular-nums',
                day.net < 0
                  ? 'text-expense'
                  : day.net > 0
                    ? 'text-income'
                    : 'text-muted-foreground',
              )}
            >
              {formatSignedValue(day.net)}
            </span>
          </header>
          <ul className="divide-y overflow-hidden rounded-lg border bg-card">
            {day.movements.map((movement) => (
              <li key={movement.code}>
                <MovementRow
                  movement={movement}
                  category={
                    movement.category_code ? categories.get(movement.category_code) : undefined
                  }
                  thirdPartyName={
                    movement.third_party_code
                      ? thirdParties.get(movement.third_party_code)?.name
                      : undefined
                  }
                  onSelect={onSelect}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {list.hasNextPage && (
        <div ref={sentinel} className="flex justify-center py-2">
          <Button
            variant="outline"
            className="h-11"
            onClick={() => void list.fetchNextPage()}
            disabled={list.isFetchingNextPage}
          >
            {list.isFetchingNextPage && <LoaderCircle className="animate-spin" aria-hidden />}
            Carregar mais
          </Button>
        </div>
      )}
    </div>
  )
}

/** Loads the next page when the "Carregar mais" button scrolls into view. */
function useLoadMoreOnScroll(loadMore: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const onVisible = useEffectEvent(loadMore)
  useEffect(() => {
    const element = ref.current
    if (!element || !enabled || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onVisible()
      },
      { rootMargin: '200px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [enabled])
  return ref
}

export function MovementListSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando movimentações">
      {[3, 2].map((rows, group) => (
        <div key={group} className="flex flex-col gap-1.5">
          <Skeleton className="ml-1 h-4 w-32" />
          <div className="divide-y rounded-lg border">
            {Array.from({ length: rows }, (_, row) => (
              <div key={row} className="flex items-start gap-3 px-4 py-3">
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
