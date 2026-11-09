import type { CategoryResponse, OperationType, UUID } from '@/api/contracts'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCategoryLookup, useGroupedCategories } from './queries'

/** Radix Select cannot have an empty value: this one stands for "no category". */
const NONE = 'none'

interface CategorySelectProps {
  id?: string
  value: UUID | null
  onChange: (code: UUID | null, category: CategoryResponse | null) => void
  operationType: OperationType
  /** false when the category cannot be removed (PATCH only replaces it) */
  allowNone?: boolean
  disabled?: boolean
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

/**
 * ACTIVE categories of the operation type, grouped by group. A current value that is INACTIVE
 * (an old movement) still shows, so editing does not change it by accident.
 */
export function CategorySelect({
  id,
  value,
  onChange,
  operationType,
  allowNone = true,
  disabled,
  ...aria
}: CategorySelectProps) {
  const groups = useGroupedCategories({ operationType, activeOnly: true })
  const lookup = useCategoryLookup()
  const current = value ? lookup.get(value) : undefined
  const currentIsHidden = current !== undefined && current.status !== 'ACTIVE'

  return (
    <Select
      value={value ?? NONE}
      onValueChange={(next) => {
        if (next === NONE) onChange(null, null)
        else onChange(next, lookup.get(next) ?? null)
      }}
      disabled={disabled || groups.isPending}
    >
      <SelectTrigger id={id} {...aria}>
        <SelectValue placeholder={groups.isPending ? 'Carregando…' : 'Sem categoria'} />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {allowNone && (
          <>
            <SelectItem value={NONE}>Sem categoria</SelectItem>
            <SelectSeparator />
          </>
        )}
        {currentIsHidden && <SelectItem value={current.code}>{current.name} (inativa)</SelectItem>}
        {groups.data?.map((group) => (
          <SelectGroup key={group.code}>
            <SelectLabel>{group.name}</SelectLabel>
            {group.categories.map((category) => (
              <SelectItem key={category.code} value={category.code}>
                {category.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
