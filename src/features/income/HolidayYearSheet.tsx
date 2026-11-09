import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { toast } from 'sonner'

import type {
  HolidayCalendarPreviewResponse,
  HolidayRequest,
  HolidayResponse,
  IncomeOccurrenceResponse,
} from '@/api/contracts'
import { FormAlert } from '@/components/domain/FormAlert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { describePayCyclePending } from '@/features/pay-cycles/rules'
import { errorMessage } from '@/lib/api-errors'
import { formatDate, formatMonth } from '@/lib/format'
import { useOnline } from '@/lib/online'
import { usePreviewHolidayYear, useSaveHolidayYear } from './queries'
import {
  holidayYearDefaults,
  holidayYearSchema,
  toHolidayRequests,
  type HolidayYearFormInput,
  type HolidayYearFormValues,
} from './schema'

interface HolidayYearSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  year: number
  holidays: readonly HolidayResponse[]
  reviewed: boolean
}

/**
 * Reviews one year of the calendar in two steps: edit the COMPLETE list, then see what saving it
 * changes (income dates and cycle boundaries) before writing. A holiday left out is removed.
 */
export function HolidayYearSheet({
  open,
  onOpenChange,
  year,
  holidays,
  reviewed,
}: HolidayYearSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{reviewed ? `Editar feriados de ${year}` : `Revisar ${year}`}</SheetTitle>
          <SheetDescription>
            A lista completa do ano: o que ficar de fora é removido. Ela decide quais dias são úteis
            e, com isso, a data de cada receita. Se não há feriados a considerar, grave a lista
            vazia.
          </SheetDescription>
        </SheetHeader>
        {open && (
          <HolidayYearForm year={year} holidays={holidays} onDone={() => onOpenChange(false)} />
        )}
      </SheetContent>
    </Sheet>
  )
}

function HolidayYearForm({
  year,
  holidays,
  onDone,
}: {
  year: number
  holidays: readonly HolidayResponse[]
  onDone: () => void
}) {
  const online = useOnline()
  const preview = usePreviewHolidayYear()
  const save = useSaveHolidayYear()
  const [step, setStep] = useState<'edit' | 'preview'>('edit')
  const [draft, setDraft] = useState<HolidayRequest[]>([])
  const [result, setResult] = useState<HolidayCalendarPreviewResponse | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const schema = useMemo(() => holidayYearSchema(year), [year])
  const { register, control, handleSubmit, formState } = useForm<
    HolidayYearFormInput,
    unknown,
    HolidayYearFormValues
  >({ resolver: zodResolver(schema), defaultValues: holidayYearDefaults(holidays) })
  const { fields, append, remove } = useFieldArray({ control, name: 'holidays' })

  const onPreview = handleSubmit((values) => {
    setFormError(null)
    const list = toHolidayRequests(values)
    preview.mutate(
      { year, body: { holidays: list } },
      {
        onSuccess: (data) => {
          setDraft(list)
          setResult(data)
          setStep('preview')
        },
        onError: (error) => setFormError(errorMessage(error)),
      },
    )
  })

  const onSave = () => {
    setFormError(null)
    save.mutate(
      { year, body: { holidays: draft } },
      {
        onSuccess: () => {
          toast.success(`Calendário de ${year} revisado.`)
          onDone()
        },
        onError: (error) => setFormError(errorMessage(error)),
      },
    )
  }

  if (step === 'preview' && result) {
    return (
      <>
        <SheetBody>
          <p className="text-sm text-muted-foreground">2 de 2 · O que muda ao gravar</p>
          <PreviewSummary preview={result} count={draft.length} year={year} />
          {formError && <FormAlert message={formError} />}
        </SheetBody>
        <SheetFooter className="sticky bottom-0 border-t bg-background">
          <Button className="h-12 text-base" onClick={onSave} disabled={save.isPending || !online}>
            {save.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
            Gravar revisão
          </Button>
          <Button
            variant="outline"
            className="h-11"
            onClick={() => setStep('edit')}
            disabled={save.isPending}
          >
            Voltar e editar
          </Button>
        </SheetFooter>
      </>
    )
  }

  return (
    <form onSubmit={(event) => void onPreview(event)} className="contents" noValidate>
      <SheetBody>
        <p className="text-sm text-muted-foreground">1 de 2 · Feriados de {year}</p>
        {fields.length === 0 && (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Nenhum feriado na lista. Gravar assim marca {year} como revisado, sem feriados.
          </p>
        )}
        <ul className="flex flex-col gap-3">
          {fields.map((field, index) => {
            const rowErrors = formState.errors.holidays?.[index]
            return (
              <li key={field.id} className="flex flex-col gap-1">
                <div className="flex items-start gap-2">
                  <Input
                    type="date"
                    aria-label={`Data do feriado ${index + 1}`}
                    aria-invalid={Boolean(rowErrors?.date)}
                    min={`${year}-01-01`}
                    max={`${year}-12-31`}
                    className="w-40 shrink-0"
                    {...register(`holidays.${index}.date`)}
                  />
                  <Input
                    aria-label={`Nome do feriado ${index + 1}`}
                    aria-invalid={Boolean(rowErrors?.name)}
                    autoComplete="off"
                    maxLength={100}
                    placeholder="Nome"
                    {...register(`holidays.${index}.name`)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 shrink-0"
                    aria-label={`Remover feriado ${index + 1}`}
                    onClick={() => remove(index)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
                {(rowErrors?.date?.message || rowErrors?.name?.message) && (
                  <p role="alert" className="text-sm text-destructive">
                    {[rowErrors.date?.message, rowErrors.name?.message].filter(Boolean).join(' ')}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
        <Button
          type="button"
          variant="outline"
          className="h-11 self-start"
          onClick={() => append({ date: '', name: '' })}
        >
          <Plus aria-hidden />
          Adicionar feriado
        </Button>
        {formError && <FormAlert message={formError} />}
      </SheetBody>
      <SheetFooter className="sticky bottom-0 border-t bg-background">
        <Button type="submit" className="h-12 text-base" disabled={preview.isPending || !online}>
          {preview.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
          Ver o que muda
        </Button>
      </SheetFooter>
    </form>
  )
}

/** One side of a before/after: the date, or "sem data" when it cannot be calculated. */
function occurrenceSide(occurrence: IncomeOccurrenceResponse): string {
  return occurrence.planned_date ? formatDate(occurrence.planned_date) : 'sem data'
}

function PreviewSummary({
  preview,
  count,
  year,
}: {
  preview: HolidayCalendarPreviewResponse
  count: number
  year: number
}) {
  const nothing =
    preview.income_occurrences.length === 0 &&
    preview.cycle_boundaries.length === 0 &&
    preview.cycle_divergences.length === 0

  return (
    <div className="flex flex-col gap-4">
      <p>
        {count === 0
          ? `Gravar ${year} sem feriados.`
          : `Gravar ${year} com ${count} ${count === 1 ? 'feriado' : 'feriados'}.`}
      </p>
      {nothing && (
        <p className="rounded-lg border bg-card p-4 text-sm">
          Nenhuma data de receita nem virada de ciclo muda.
        </p>
      )}
      {preview.income_occurrences.length > 0 && (
        <section aria-labelledby="preview-income" className="flex flex-col gap-2">
          <h3 id="preview-income" className="font-medium">
            Datas de receita que mudam
          </h3>
          <ul className="divide-y overflow-hidden rounded-lg border bg-card">
            {preview.income_occurrences.map((impact) => (
              <li
                key={`${impact.schedule_code}-${impact.nominal_month}`}
                className="px-4 py-3 text-sm"
              >
                <p className="font-medium">
                  {impact.schedule_description} ·{' '}
                  <span className="first-letter:uppercase">
                    {formatMonth(impact.nominal_month)}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  {occurrenceSide(impact.before)} → {occurrenceSide(impact.after)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {preview.cycle_boundaries.length > 0 && (
        <section aria-labelledby="preview-boundaries" className="flex flex-col gap-2">
          <h3 id="preview-boundaries" className="font-medium">
            Viradas de ciclo que mudam
          </h3>
          <ul className="divide-y overflow-hidden rounded-lg border bg-card">
            {preview.cycle_boundaries.map((boundary) => (
              <li
                key={`${boundary.previous_cycle_code}-${boundary.old_boundary}`}
                className="px-4 py-3 text-sm"
              >
                {formatDate(boundary.old_boundary)} → {formatDate(boundary.new_boundary)}
              </li>
            ))}
          </ul>
        </section>
      )}
      {preview.cycle_divergences.length > 0 && (
        <section aria-labelledby="preview-divergences" className="flex flex-col gap-2">
          <h3 id="preview-divergences" className="font-medium">
            Pendências dos ciclos
          </h3>
          <ul className="divide-y overflow-hidden rounded-lg border bg-card">
            {preview.cycle_divergences.map((pending, index) => (
              <li key={index} className="px-4 py-3 text-sm">
                {describePayCyclePending(pending)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
