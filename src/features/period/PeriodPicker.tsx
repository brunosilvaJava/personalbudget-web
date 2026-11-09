import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { monthOf } from '@/lib/dates'
import { formatDateRange, formatMonth } from '@/lib/format'
import { cn } from '@/lib/utils'
import { periodKind, samePeriod, type Period } from './period'
import { usePayCycle, useShiftPeriod } from './queries'

interface PeriodPickerProps {
  period: Period
  onChange: (period: Period) => void
  /** the period "Atual" goes back to (current cycle or month) */
  defaultPeriod?: Period
  className?: string
}

/** "‹ Ciclo Nov/Dez ›" with the dates below; arrows move by cycle, by month or by the same length. */
export function PeriodPicker({ period, onChange, defaultPeriod, className }: PeriodPickerProps) {
  const shift = useShiftPeriod()
  const [moving, setMoving] = useState(false)
  const kind = periodKind(period)
  const { data: cycle } = usePayCycle(period.cycleCode)

  const title =
    kind === 'cycle'
      ? `Ciclo ${cycle?.label ?? ''}`.trim()
      : kind === 'month'
        ? capitalize(formatMonth(monthOf(period.start)))
        : 'Período'
  const subtitle = kind === 'month' ? null : formatDateRange(period.start, period.end)

  async function move(direction: -1 | 1) {
    setMoving(true)
    try {
      onChange(await shift(period, direction))
    } finally {
      setMoving(false)
    }
  }

  const isDefault = !defaultPeriod || samePeriod(period, defaultPeriod)

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Button
        variant="ghost"
        size="icon"
        className="size-11"
        aria-label="Período anterior"
        disabled={moving}
        onClick={() => void move(-1)}
      >
        <ChevronLeft className="size-5" aria-hidden />
      </Button>
      <div className="min-w-0 flex-1 text-center" aria-live="polite">
        <p className="truncate font-medium">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground tabular-nums">{subtitle}</p>}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-11"
        aria-label="Próximo período"
        disabled={moving}
        onClick={() => void move(1)}
      >
        <ChevronRight className="size-5" aria-hidden />
      </Button>
      {!isDefault && defaultPeriod && (
        <Button variant="outline" size="sm" className="h-9" onClick={() => onChange(defaultPeriod)}>
          Atual
        </Button>
      )}
    </div>
  )
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
