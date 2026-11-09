import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import type {
  PayCycleEndAdjustmentPreviewResponse,
  PayCycleIncomeImpactResponse,
  PayCycleMovementImpactResponse,
  PayCycleResponse,
} from '@/api/contracts'
import { FormAlert } from '@/components/domain/FormAlert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
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
import { OCCURRENCE_STATE_LABEL } from '@/features/income/rules'
import { applyApiErrors } from '@/lib/api-errors'
import { shiftDate } from '@/lib/dates'
import { formatDate, formatSignedMoney } from '@/lib/format'
import { useOnline } from '@/lib/online'
import { CycleLines } from './CycleLines'
import { JustifiedConfirm } from './JustifiedConfirm'
import { PendingList } from './PendingList'
import { useAdjustCycleEnd, usePreviewEndAdjustment } from './queries'
import {
  endAdjustmentSchema,
  END_ADJUSTMENT_FIELDS,
  type EndAdjustmentFormInput,
  type EndAdjustmentFormValues,
} from './schema'

/** How many moved movements the review lists before "e mais N". */
const LISTED = 10

interface EndAdjustmentSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cycle: PayCycleResponse
  /** the cycle that opens where this one ends */
  next: PayCycleResponse
}

/**
 * Moves the boundary between a cycle and the next one, in two steps: pick the day and see what
 * moves from one cycle to the other; then say why and write it. There is no undo: going back is
 * another adjustment.
 */
export function EndAdjustmentSheet({ open, onOpenChange, cycle, next }: EndAdjustmentSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Ajustar a virada</SheetTitle>
          <SheetDescription>
            Muda o dia em que {next.label} começa, e com ele o último dia de {cycle.label}. A virada
            ajustada à mão deixa de ser recalculada pela receita âncora.
          </SheetDescription>
        </SheetHeader>
        {open && <EndAdjustmentForm cycle={cycle} next={next} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

function EndAdjustmentForm({
  cycle,
  next,
  onDone,
}: {
  cycle: PayCycleResponse
  next: PayCycleResponse
  onDone: () => void
}) {
  const online = useOnline()
  const preview = usePreviewEndAdjustment()
  const adjust = useAdjustCycleEnd()
  const [step, setStep] = useState<'choose' | 'review'>('choose')
  const [newEnd, setNewEnd] = useState('')
  const [result, setResult] = useState<PayCycleEndAdjustmentPreviewResponse | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const schema = useMemo(() => endAdjustmentSchema(cycle, next.end_date_exclusive), [cycle, next])
  const earliest = shiftDate(cycle.start_date, 1)
  const latest = shiftDate(next.end_date_exclusive, -1)
  const { register, handleSubmit, setError, formState } = useForm<
    EndAdjustmentFormInput,
    unknown,
    EndAdjustmentFormValues
  >({ resolver: zodResolver(schema), defaultValues: { new_end_date: '' } })

  const onPreview = handleSubmit((values) => {
    setFormError(null)
    preview.mutate(
      { code: cycle.code, body: { new_end_date: values.new_end_date } },
      {
        onSuccess: (data) => {
          setNewEnd(values.new_end_date)
          setResult(data)
          setStep('review')
        },
        onError: (error) => setFormError(applyApiErrors(error, setError, END_ADJUSTMENT_FIELDS)),
      },
    )
  })

  if (step === 'review' && result) {
    return (
      <JustifiedConfirm
        confirmLabel="Ajustar a virada"
        pending={adjust.isPending}
        error={adjust.error}
        onBack={() => {
          adjust.reset()
          setStep('choose')
        }}
        onConfirm={(justification) =>
          adjust.mutate(
            {
              code: cycle.code,
              body: {
                new_end_date: newEnd,
                justification,
                expected_version: result.expected_version,
                expected_next_version: result.expected_next_version,
              },
            },
            {
              onSuccess: () => {
                toast.success('Virada ajustada.')
                onDone()
              },
            },
          )
        }
      >
        <EndAdjustmentReview preview={result} />
      </JustifiedConfirm>
    )
  }

  return (
    <form onSubmit={(event) => void onPreview(event)} className="contents" noValidate>
      <SheetBody>
        <p className="text-sm text-muted-foreground">1 de 2 · Nova virada</p>
        <Field
          id="adjust-end-date"
          label={`Novo primeiro dia de ${next.label}`}
          error={formState.errors.new_end_date?.message}
          description={`Hoje é ${formatDate(cycle.end_date_exclusive)}. Pode ser de ${formatDate(earliest)} a ${formatDate(latest)}, para nenhum dos dois ciclos ficar vazio.`}
        >
          {(aria) => (
            <Input
              {...aria}
              type="date"
              min={earliest}
              max={latest}
              {...register('new_end_date')}
            />
          )}
        </Field>
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

function EndAdjustmentReview({ preview }: { preview: PayCycleEndAdjustmentPreviewResponse }) {
  const labelOf = (code: string) =>
    [...preview.cycles_before, ...preview.cycles_after].find((item) => item.code === code)?.label ??
    'outro ciclo'
  const movesLater = preview.new_end_date > preview.old_end_date
  // The days between the two boundaries change cycle.
  const firstMoved = movesLater ? preview.old_end_date : preview.new_end_date
  const lastMoved = shiftDate(movesLater ? preview.new_end_date : preview.old_end_date, -1)
  const pending = preview.cycles_after.flatMap((item) => item.pending)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">2 de 2 · O que muda</p>
      <p>
        A virada passa de <strong>{formatDate(preview.old_end_date)}</strong> para{' '}
        <strong>{formatDate(preview.new_end_date)}</strong>. Os dias{' '}
        {firstMoved === lastMoved
          ? formatDate(firstMoved)
          : `${formatDate(firstMoved)} a ${formatDate(lastMoved)}`}{' '}
        saem de {labelOf(preview.leaving_cycle_code)} e entram em{' '}
        {labelOf(preview.receiving_cycle_code)}.
      </p>

      <section aria-labelledby="adjust-after" className="flex flex-col gap-2">
        <h3 id="adjust-after" className="font-medium">
          Depois do ajuste
        </h3>
        <CycleLines cycles={preview.cycles_after} />
      </section>

      <section aria-labelledby="adjust-movements" className="flex flex-col gap-2">
        <h3 id="adjust-movements" className="font-medium">
          Movimentações que mudam de ciclo
        </h3>
        {preview.movements.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma movimentação tem competência nesses dias.
          </p>
        ) : (
          <MovementImpacts movements={preview.movements} />
        )}
      </section>

      <section aria-labelledby="adjust-income" className="flex flex-col gap-2">
        <h3 id="adjust-income" className="font-medium">
          Receitas previstas para esses dias
        </h3>
        {preview.income_occurrences.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma receita cai nesses dias.</p>
        ) : (
          <IncomeImpacts occurrences={preview.income_occurrences} />
        )}
      </section>

      {pending.length > 0 && (
        <section aria-labelledby="adjust-pending" className="flex flex-col gap-2">
          <h3 id="adjust-pending" className="font-medium">
            Pendências depois do ajuste
          </h3>
          <PendingList pending={pending} />
        </section>
      )}
    </div>
  )
}

function MovementImpacts({ movements }: { movements: readonly PayCycleMovementImpactResponse[] }) {
  const shown = movements.slice(0, LISTED)
  return (
    <>
      <ul className="divide-y overflow-hidden rounded-lg border bg-card">
        {shown.map((movement) => (
          <li
            key={movement.code}
            className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{movement.description}</span>
              <span className="text-muted-foreground">{formatDate(movement.competence_date)}</span>
            </span>
            <span className="whitespace-nowrap tabular-nums">
              {formatSignedMoney(movement.operation_type, movement.amount)}
            </span>
          </li>
        ))}
      </ul>
      {movements.length > LISTED && (
        <p className="text-sm text-muted-foreground">e mais {movements.length - LISTED}</p>
      )}
    </>
  )
}

function IncomeImpacts({ occurrences }: { occurrences: readonly PayCycleIncomeImpactResponse[] }) {
  return (
    <ul className="divide-y overflow-hidden rounded-lg border bg-card">
      {occurrences.map((occurrence) => (
        <li
          key={`${occurrence.schedule_code}-${occurrence.nominal_month}`}
          className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm"
        >
          <span className="min-w-0">
            <span className="block truncate font-medium">{occurrence.schedule_description}</span>
            <span className="text-muted-foreground">
              {formatDate(occurrence.planned_date)} · {OCCURRENCE_STATE_LABEL[occurrence.state]}
            </span>
          </span>
          <span className="whitespace-nowrap tabular-nums">
            {formatSignedMoney('CREDIT', occurrence.amount)}
          </span>
        </li>
      ))}
    </ul>
  )
}
