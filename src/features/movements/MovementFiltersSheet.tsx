import { useState } from 'react'

import type { FinancialMovementStatus, OperationType, UUID } from '@/api/contracts'
import { ErrorState } from '@/components/domain/ErrorState'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { useGroupedCategories } from '@/features/categories/queries'
import type { Period } from '@/features/period/period'
import { EMPTY_FILTERS, type MovementFilters } from './filters'

interface MovementFiltersSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: MovementFilters
  period: Period
  onApply: (filters: MovementFilters, period: Period) => void
}

const STATUS_OPTIONS: { value: FinancialMovementStatus; label: string }[] = [
  { value: 'PENDING', label: 'Pendentes' },
  { value: 'LATE', label: 'Atrasadas' },
  { value: 'PAID_OUT', label: 'Pagas' },
]

/** Type, status, category and a custom period. Nothing changes until "Aplicar". */
export function MovementFiltersSheet({
  open,
  onOpenChange,
  filters,
  period,
  onApply,
}: MovementFiltersSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>Escolha o que mostrar na lista.</SheetDescription>
        </SheetHeader>
        {open && (
          <FiltersForm
            initialFilters={filters}
            initialPeriod={period}
            onApply={(nextFilters, nextPeriod) => {
              onApply(nextFilters, nextPeriod)
              onOpenChange(false)
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function FiltersForm({
  initialFilters,
  initialPeriod,
  onApply,
}: {
  initialFilters: MovementFilters
  initialPeriod: Period
  onApply: (filters: MovementFilters, period: Period) => void
}) {
  const [draft, setDraft] = useState(initialFilters)
  const [start, setStart] = useState(initialPeriod.start)
  const [end, setEnd] = useState(initialPeriod.end)
  const periodChanged = start !== initialPeriod.start || end !== initialPeriod.end
  const periodInvalid = !start || !end || end < start

  return (
    <form
      className="contents"
      onSubmit={(event) => {
        event.preventDefault()
        if (periodInvalid) return
        onApply(draft, periodChanged ? { start, end } : initialPeriod)
      }}
    >
      <SheetBody className="gap-6">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Tipo</legend>
          <ToggleGroup
            type="single"
            value={draft.operationType ?? 'ALL'}
            onValueChange={(value) =>
              value &&
              setDraft({
                ...draft,
                operationType: value === 'ALL' ? undefined : (value as OperationType),
              })
            }
          >
            <ToggleGroupItem value="ALL">Todas</ToggleGroupItem>
            <ToggleGroupItem value="DEBIT">Despesas</ToggleGroupItem>
            <ToggleGroupItem value="CREDIT">Receitas</ToggleGroupItem>
          </ToggleGroup>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Status</legend>
          <ToggleGroup
            type="multiple"
            value={draft.statuses}
            onValueChange={(value) =>
              setDraft({ ...draft, statuses: value as FinancialMovementStatus[] })
            }
          >
            {STATUS_OPTIONS.map(({ value, label }) => (
              <ToggleGroupItem key={value} value={value}>
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="text-xs text-muted-foreground">Nenhum marcado mostra todos.</p>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-medium">Período</legend>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="filter-start">De</Label>
              <Input
                id="filter-start"
                type="date"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                aria-invalid={periodInvalid}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="filter-end">Até</Label>
              <Input
                id="filter-end"
                type="date"
                value={end}
                min={start}
                onChange={(event) => setEnd(event.target.value)}
                aria-invalid={periodInvalid}
              />
            </div>
          </div>
          {periodInvalid && (
            <p role="alert" className="text-sm text-destructive">
              A data final não pode ser antes da inicial.
            </p>
          )}
        </fieldset>

        <CategoryFilter
          selected={draft.categoryCodes}
          withoutCategory={draft.withoutCategory}
          operationType={draft.operationType}
          onChange={(categoryCodes, withoutCategory) =>
            setDraft({ ...draft, categoryCodes, withoutCategory })
          }
        />
      </SheetBody>
      <SheetFooter className="sticky bottom-0 flex-row border-t bg-background">
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1"
          onClick={() => {
            setDraft({ ...EMPTY_FILTERS, search: draft.search })
          }}
        >
          Limpar
        </Button>
        <Button type="submit" className="h-11 flex-1" disabled={periodInvalid}>
          Aplicar
        </Button>
      </SheetFooter>
    </form>
  )
}

function CategoryFilter({
  selected,
  withoutCategory,
  operationType,
  onChange,
}: {
  selected: UUID[]
  withoutCategory: boolean
  operationType: OperationType | undefined
  onChange: (categoryCodes: UUID[], withoutCategory: boolean) => void
}) {
  // Inactive categories stay in the filter: the history still has them.
  const groups = useGroupedCategories({ operationType })

  function toggle(code: UUID, checked: boolean) {
    onChange(checked ? [...selected, code] : selected.filter((c) => c !== code), withoutCategory)
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">Categoria</legend>
      <CheckRow
        id="filter-without-category"
        label="Sem categoria"
        checked={withoutCategory}
        disabled={selected.length > 0}
        onChange={(checked) => onChange(selected, checked)}
      />
      {groups.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-32" />
        </div>
      ) : groups.error ? (
        <ErrorState
          error={groups.error}
          title="Não foi possível carregar as categorias"
          onRetry={groups.refetch}
          className="py-6"
        />
      ) : (
        groups.data?.map((group) => (
          <div key={group.code} className="flex flex-col gap-1">
            <p className="mt-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {group.name}
            </p>
            {group.categories.map((category) => (
              <CheckRow
                key={category.code}
                id={`filter-category-${category.code}`}
                label={
                  category.status === 'INACTIVE' ? `${category.name} (inativa)` : category.name
                }
                checked={selected.includes(category.code)}
                onChange={(checked) => toggle(category.code, checked)}
              />
            ))}
          </div>
        ))
      )}
    </fieldset>
  )
}

function CheckRow({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex min-h-10 items-center gap-3">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(value === true)}
        className="size-5"
      />
      <Label htmlFor={id} className="flex-1 py-2 font-normal">
        {label}
      </Label>
    </div>
  )
}
