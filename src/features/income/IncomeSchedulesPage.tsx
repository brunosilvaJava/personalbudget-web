import { ChevronRight, HandCoins, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import type { IncomeScheduleResponse, IncomeScheduleStatus } from '@/api/contracts'
import { Amount } from '@/components/domain/Amount'
import { EmptyState } from '@/components/domain/EmptyState'
import { ErrorState } from '@/components/domain/ErrorState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useOnline } from '@/lib/online'
import { IncomeScheduleFormSheet } from './IncomeScheduleFormSheet'
import { useIncomeSchedules } from './queries'
import { describeRule, describeValidity } from './rules'

/** Receita › Agenda: the schedules of income, each opening its occurrences. */
export function IncomeSchedulesPage() {
  const online = useOnline()
  const navigate = useNavigate()
  const [status, setStatus] = useState<IncomeScheduleStatus>('ACTIVE')
  const schedules = useIncomeSchedules(status)
  const [creating, setCreating] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ToggleGroup
          type="single"
          aria-label="Situação"
          value={status}
          onValueChange={(value) => value && setStatus(value as IncomeScheduleStatus)}
          className="sm:w-72"
        >
          <ToggleGroupItem value="ACTIVE">Ativas</ToggleGroupItem>
          <ToggleGroupItem value="INACTIVE">Inativas</ToggleGroupItem>
        </ToggleGroup>
        <Button className="h-11 sm:ml-auto" onClick={() => setCreating(true)} disabled={!online}>
          <Plus aria-hidden />
          Nova receita
        </Button>
      </div>

      {schedules.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Carregando receitas">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : schedules.isError ? (
        <ErrorState error={schedules.error} onRetry={() => void schedules.refetch()} />
      ) : schedules.data.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title={status === 'ACTIVE' ? 'Nenhuma receita ativa' : 'Nenhuma receita inativa'}
          description={
            status === 'ACTIVE'
              ? 'Cadastre o salário: o app calcula a data de cada mês e lança no dia.'
              : undefined
          }
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {schedules.data.map((schedule) => (
            <ScheduleItem key={schedule.code} schedule={schedule} />
          ))}
        </ul>
      )}

      <IncomeScheduleFormSheet
        open={creating}
        onOpenChange={setCreating}
        onSaved={(saved) => void navigate(`/receita/agenda/${saved.code}`)}
      />
    </div>
  )
}

function ScheduleItem({ schedule }: { schedule: IncomeScheduleResponse }) {
  return (
    <li>
      <Link
        to={`/receita/agenda/${schedule.code}`}
        className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/60"
      >
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{schedule.description}</span>
            {schedule.anchor && <Badge variant="secondary">âncora</Badge>}
          </p>
          <p className="text-sm text-muted-foreground">{describeRule(schedule)}</p>
          <p className="text-xs text-muted-foreground">{describeValidity(schedule)}</p>
        </div>
        <Amount operationType="CREDIT" amount={schedule.amount} />
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  )
}
