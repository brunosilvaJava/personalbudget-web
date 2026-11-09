import { Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PeriodPicker } from '@/features/period/PeriodPicker'
import { readPeriod, writePeriod, type Period } from '@/features/period/period'
import { useDefaultPeriod } from '@/features/period/queries'
import {
  countSheetFilters,
  EMPTY_FILTERS,
  readFilters,
  toListFilters,
  writeFilters,
  type MovementFilters,
} from './filters'
import { MovementFiltersSheet } from './MovementFiltersSheet'
import { MovementList, MovementListSkeleton } from './MovementList'

const SEARCH_DEBOUNCE_MS = 400

export function MovementsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { period: fallbackPeriod } = useDefaultPeriod()
  const period = readPeriod(searchParams) ?? fallbackPeriod
  const filters = readFilters(searchParams)
  const [filtersOpen, setFiltersOpen] = useState(false)

  function update(nextFilters: MovementFilters, nextPeriod: Period | undefined, replace = false) {
    let next = writeFilters(searchParams, nextFilters)
    if (nextPeriod) next = writePeriod(next, nextPeriod)
    setSearchParams(next, { replace })
  }

  const sheetCount = countSheetFilters(filters)
  const filtered = sheetCount > 0 || filters.search.trim() !== ''

  return (
    <>
      <PageHeader title="Movimentações" description="Receitas e despesas do período" />

      <div className="mb-4 flex flex-col gap-3">
        {period ? (
          <PeriodPicker
            period={period}
            defaultPeriod={fallbackPeriod}
            onChange={(next) => update(filters, next)}
            className="rounded-lg border bg-card p-1"
          />
        ) : (
          <div className="h-[54px] rounded-lg border bg-card" aria-hidden />
        )}
        <div className="flex gap-2">
          <SearchBox
            value={filters.search}
            onChange={(search) => update({ ...filters, search }, period, true)}
          />
          <Button
            variant="outline"
            className="relative h-11 shrink-0"
            onClick={() => setFiltersOpen(true)}
            aria-label={sheetCount > 0 ? `Filtros (${sheetCount} ativos)` : 'Filtros'}
          >
            <SlidersHorizontal aria-hidden />
            <span className="hidden sm:inline">Filtros</span>
            {sheetCount > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                {sheetCount}
              </span>
            )}
          </Button>
        </div>
        {filtered && (
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <span className="truncate">{describeFilters(filters)}</span>
            <Button
              variant="link"
              className="h-auto shrink-0 p-0"
              onClick={() => update({ ...EMPTY_FILTERS }, period)}
            >
              Limpar filtros
            </Button>
          </div>
        )}
      </div>

      {period ? (
        <MovementList
          filters={toListFilters(period, filters)}
          filtered={filtered}
          onClearFilters={() => update({ ...EMPTY_FILTERS }, period)}
        />
      ) : (
        <MovementListSkeleton />
      )}

      {period && (
        <MovementFiltersSheet
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          filters={filters}
          period={period}
          onApply={(nextFilters, nextPeriod) => update(nextFilters, nextPeriod)}
        />
      )}
    </>
  )
}

/** Debounced: the list does not reload on every key. */
function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [text, setText] = useState(value)
  // The URL changed from outside (e.g. "Limpar filtros"): show it.
  const [synced, setSynced] = useState(value)
  if (value !== synced) {
    setSynced(value)
    setText(value)
  }
  useEffect(() => {
    if (text === value) return
    const timer = setTimeout(() => onChange(text), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text, value, onChange])

  return (
    <div className="relative flex-1">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        placeholder="Buscar pela descrição"
        aria-label="Buscar pela descrição"
        className="pl-9"
        value={text}
        onChange={(event) => setText(event.target.value)}
        enterKeyHint="search"
      />
    </div>
  )
}

function describeFilters(filters: MovementFilters): string {
  const parts: string[] = []
  if (filters.search.trim()) parts.push(`“${filters.search.trim()}”`)
  if (filters.operationType) parts.push(filters.operationType === 'DEBIT' ? 'Despesas' : 'Receitas')
  const statusNames = { PENDING: 'Pendentes', LATE: 'Atrasadas', PAID_OUT: 'Pagas' } as const
  if (filters.statuses.length > 0)
    parts.push(filters.statuses.map((s) => statusNames[s]).join(', '))
  const categories = filters.categoryCodes.length
  if (categories > 0) parts.push(categories === 1 ? '1 categoria' : `${categories} categorias`)
  else if (filters.withoutCategory) parts.push('Sem categoria')
  return parts.join(' · ')
}
