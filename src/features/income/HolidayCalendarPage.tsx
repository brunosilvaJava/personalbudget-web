import { CalendarCheck, ChevronLeft, ChevronRight, Pencil, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

import type { HolidayYearResponse } from '@/api/contracts'
import { EmptyState } from '@/components/domain/EmptyState'
import { ErrorState } from '@/components/domain/ErrorState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { currentMonth } from '@/lib/dates'
import { formatDayHeader } from '@/lib/format'
import { useOnline } from '@/lib/online'
import { HolidayYearSheet } from './HolidayYearSheet'
import { useHolidayYear, useHolidayYears } from './queries'

/** The years the back accepts. */
const MIN_YEAR = 2000
const MAX_YEAR = 2200

function readYear(value: string | null): number | null {
  if (!value || !/^\d{4}$/.test(value)) return null
  const year = Number(value)
  return year >= MIN_YEAR && year <= MAX_YEAR ? year : null
}

/** Receita › Calendário: the holidays year by year, and whether each year was reviewed. */
export function HolidayCalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const year = readYear(searchParams.get('ano')) ?? Number(currentMonth().slice(0, 4))
  const holidayYear = useHolidayYear(year)
  const reviewedYears = useHolidayYears()
  const [editing, setEditing] = useState(false)

  const goTo = (next: number) => {
    if (next < MIN_YEAR || next > MAX_YEAR) return
    setSearchParams({ ano: String(next) }, { replace: true })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="icon"
          className="size-11"
          aria-label="Ano anterior"
          onClick={() => goTo(year - 1)}
          disabled={year <= MIN_YEAR}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold tabular-nums">{year}</h2>
          {holidayYear.data && (
            <Badge variant={holidayYear.data.reviewed ? 'income' : 'warning'}>
              {holidayYear.data.reviewed ? 'revisado' : 'não revisado'}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="size-11"
          aria-label="Próximo ano"
          onClick={() => goTo(year + 1)}
          disabled={year >= MAX_YEAR}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>

      {holidayYear.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Carregando feriados">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : holidayYear.isError ? (
        <ErrorState error={holidayYear.error} onRetry={() => void holidayYear.refetch()} />
      ) : (
        <YearView data={holidayYear.data} onEdit={() => setEditing(true)} />
      )}

      {reviewedYears.data && reviewedYears.data.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Anos revisados:{' '}
          {reviewedYears.data
            .map((item) => item.year)
            .sort((a, b) => a - b)
            .join(', ')}
          .
        </p>
      )}

      {holidayYear.data && (
        <HolidayYearSheet
          open={editing}
          onOpenChange={setEditing}
          year={year}
          holidays={holidayYear.data.holidays}
          reviewed={holidayYear.data.reviewed}
        />
      )}
    </div>
  )
}

function YearView({ data, onEdit }: { data: HolidayYearResponse; onEdit: () => void }) {
  const online = useOnline()

  if (!data.reviewed) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
        <div className="flex gap-3">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <div className="flex flex-col gap-1 text-sm">
            <p className="font-medium">O calendário de {data.year} não foi revisado</p>
            <p className="text-muted-foreground">
              Sem a revisão, o app não sabe quais dias são úteis: as datas de receita deste ano não
              são calculadas, e nada é suposto.
            </p>
          </div>
        </div>
        <Button className="h-11 self-start" onClick={onEdit} disabled={!online}>
          <Pencil aria-hidden />
          Revisar {data.year}
        </Button>
      </div>
    )
  }

  return (
    <>
      {data.holidays.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="Revisado, sem feriados"
          description="Todos os dias de segunda a sexta contam como úteis neste ano."
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {data.holidays.map((holiday) => (
            <li key={holiday.date} className="flex min-h-14 items-center gap-3 px-4 py-3">
              <span className="w-28 shrink-0 text-sm text-muted-foreground first-letter:uppercase">
                {formatDayHeader(holiday.date)}
              </span>
              <span className="font-medium">{holiday.name}</span>
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" className="h-11 self-start" onClick={onEdit} disabled={!online}>
        <Pencil aria-hidden />
        Editar feriados
      </Button>
    </>
  )
}
