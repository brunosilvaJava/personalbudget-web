import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'

import type {
  BusinessWeek,
  DateRuleType,
  IncomeScheduleResponse,
  NonBusinessDayPolicy,
  PayCycleAnchorTransitionPreviewRequest,
  PayCycleAnchorTransitionPreviewResponse,
  PayCycleTransitionShape,
} from '@/api/contracts'
import { PAY_CYCLE_TRANSITION_SHAPES } from '@/api/contracts'
import { FormAlert } from '@/components/domain/FormAlert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  BUSINESS_WEEK_LABEL,
  DATE_RULE_LABEL,
  describeRule,
  POLICY_HELP,
  POLICY_LABEL,
  RULE_VALUE_RANGE,
} from '@/features/income/rules'
import { applyApiErrors, validationsOf } from '@/lib/api-errors'
import { formatDate } from '@/lib/format'
import { useOnline } from '@/lib/online'
import { CycleLines } from './CycleLines'
import { JustifiedConfirm } from './JustifiedConfirm'
import { PendingList } from './PendingList'
import { usePreviewAnchorTransition, useTransitionAnchor } from './queries'
import { SHAPE_HELP, SHAPE_LABEL } from './rules'
import {
  anchorTransitionDefaults,
  anchorTransitionSchema,
  ANCHOR_TRANSITION_FIELDS,
  toAnchorTransitionRequest,
  type AnchorTransitionFormInput,
  type AnchorTransitionFormValues,
  type AnchorTransitionMode,
} from './schema'

interface AnchorTransitionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** the schedule that opens the cycles today */
  anchor: IncomeScheduleResponse
  /** other ACTIVE schedules that could become the anchor */
  candidates: readonly IncomeScheduleResponse[]
}

/**
 * Changes what opens the cycles: another income schedule, or the rule of the current one. Two
 * steps: pick the change and see the chain it leaves; then say why and write it.
 */
export function AnchorTransitionSheet({
  open,
  onOpenChange,
  anchor,
  candidates,
}: AnchorTransitionSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Mudar a receita âncora</SheetTitle>
          <SheetDescription>
            Os ciclos que já começaram ficam como estão. A partir da última virada fixa, a sequência
            é refeita pela nova receita ou pela nova regra.
          </SheetDescription>
        </SheetHeader>
        {open && (
          <AnchorTransitionForm
            anchor={anchor}
            candidates={candidates}
            onDone={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function AnchorTransitionForm({
  anchor,
  candidates,
  onDone,
}: {
  anchor: IncomeScheduleResponse
  candidates: readonly IncomeScheduleResponse[]
  onDone: () => void
}) {
  const online = useOnline()
  const preview = usePreviewAnchorTransition()
  const transition = useTransitionAnchor()
  const [step, setStep] = useState<'choose' | 'review'>('choose')
  const [request, setRequest] = useState<PayCycleAnchorTransitionPreviewRequest>({})
  const [result, setResult] = useState<PayCycleAnchorTransitionPreviewResponse | null>(null)
  const [needsShape, setNeedsShape] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const canSwitch = candidates.length > 0
  const schema = useMemo(() => anchorTransitionSchema(anchor), [anchor])
  const { register, control, handleSubmit, setError, formState } = useForm<
    AnchorTransitionFormInput,
    unknown,
    AnchorTransitionFormValues
  >({ resolver: zodResolver(schema), defaultValues: anchorTransitionDefaults(anchor, canSwitch) })
  const mode = useWatch({ control, name: 'mode' })
  const ruleType = useWatch({ control, name: 'rule_type' })
  const policy = useWatch({ control, name: 'non_business_day_policy' })
  const shape = useWatch({ control, name: 'transition_shape' })
  const range = RULE_VALUE_RANGE[ruleType]

  const onPreview = handleSubmit((values) => {
    setFormError(null)
    const body = toAnchorTransitionRequest(values, anchor)
    preview.mutate(body, {
      onSuccess: (data) => {
        setRequest(body)
        setResult(data)
        setStep('review')
      },
      onError: (error) => {
        // The back asks for the shape only when it matters: show the choice and try again.
        if (validationsOf(error).transition_shape) {
          setNeedsShape(true)
        }
        setFormError(applyApiErrors(error, setError, ANCHOR_TRANSITION_FIELDS))
      },
    })
  })

  if (step === 'review' && result) {
    const next = candidates.find((schedule) => schedule.code === result.anchor_schedule_code)
    return (
      <JustifiedConfirm
        confirmLabel="Mudar a âncora"
        pending={transition.isPending}
        error={transition.error}
        onBack={() => {
          transition.reset()
          setStep('choose')
        }}
        onConfirm={(justification) =>
          // mutateAsync, not mutate: the refreshed schedules and cycles can take this sheet off the
          // screen before the answer is handled. The error shows from `transition.error`.
          void transition
            .mutateAsync({ ...request, justification, expected_version: result.expected_version })
            .then(onDone, () => undefined)
        }
      >
        <TransitionReview preview={result} anchor={anchor} next={next} />
      </JustifiedConfirm>
    )
  }

  return (
    <form onSubmit={(event) => void onPreview(event)} className="contents" noValidate>
      <SheetBody>
        <p className="text-sm text-muted-foreground">1 de 2 · O que muda</p>
        <div className="rounded-lg border bg-card p-4 text-sm">
          <p className="text-muted-foreground">Receita âncora hoje</p>
          <p className="font-medium">{anchor.description}</p>
          <p>{describeRule(anchor)}</p>
        </div>

        <Controller
          control={control}
          name="mode"
          render={({ field }) => (
            <ToggleGroup
              type="single"
              aria-label="O que mudar"
              value={field.value}
              onValueChange={(value) => value && field.onChange(value as AnchorTransitionMode)}
            >
              <ToggleGroupItem value="switch" disabled={!canSwitch}>
                Trocar de receita
              </ToggleGroupItem>
              <ToggleGroupItem value="rule">Mudar a regra</ToggleGroupItem>
            </ToggleGroup>
          )}
        />
        {!canSwitch && (
          <p className="-mt-2 text-sm text-muted-foreground">
            Para trocar de receita, cadastre outra receita ativa em Receita › Agenda.
          </p>
        )}

        {mode === 'switch' ? (
          <Controller
            control={control}
            name="anchor_schedule_code"
            render={({ field, fieldState }) => (
              <Field id="anchor-next" label="Nova receita âncora" error={fieldState.error?.message}>
                {(aria) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger {...aria}>
                      <SelectValue placeholder="Escolha a receita" />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.map((schedule) => (
                        <SelectItem key={schedule.code} value={schedule.code}>
                          {schedule.description} · {describeRule(schedule)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
            )}
          />
        ) : (
          <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Nova regra</legend>
            <Controller
              control={control}
              name="rule_type"
              render={({ field }) => (
                <ToggleGroup
                  type="single"
                  aria-label="Regra da data"
                  value={field.value}
                  onValueChange={(value) => value && field.onChange(value as DateRuleType)}
                >
                  <ToggleGroupItem value="FIXED_DAY">{DATE_RULE_LABEL.FIXED_DAY}</ToggleGroupItem>
                  <ToggleGroupItem value="NTH_BUSINESS_DAY">
                    {DATE_RULE_LABEL.NTH_BUSINESS_DAY}
                  </ToggleGroupItem>
                </ToggleGroup>
              )}
            />
            <Field
              id="anchor-rule-value"
              label={ruleType === 'FIXED_DAY' ? 'Dia do mês' : 'Qual dia útil'}
              error={formState.errors.rule_value?.message}
              description={
                ruleType === 'FIXED_DAY'
                  ? `De ${range.min} a ${range.max}.`
                  : `Do ${range.min}º ao ${range.max}º dia útil do mês.`
              }
            >
              {(aria) => (
                <Input
                  {...aria}
                  type="number"
                  inputMode="numeric"
                  min={range.min}
                  max={range.max}
                  {...register('rule_value', { valueAsNumber: true })}
                />
              )}
            </Field>
            <Controller
              control={control}
              name="business_week"
              render={({ field }) => (
                <Field id="anchor-business-week" label="Dias úteis">
                  {(aria) => (
                    <ToggleGroup
                      type="single"
                      aria-label="Dias úteis"
                      id={aria.id}
                      value={field.value}
                      onValueChange={(value) => value && field.onChange(value as BusinessWeek)}
                    >
                      <ToggleGroupItem value="MONDAY_TO_FRIDAY">
                        {BUSINESS_WEEK_LABEL.MONDAY_TO_FRIDAY}
                      </ToggleGroupItem>
                      <ToggleGroupItem value="MONDAY_TO_SATURDAY">
                        {BUSINESS_WEEK_LABEL.MONDAY_TO_SATURDAY}
                      </ToggleGroupItem>
                    </ToggleGroup>
                  )}
                </Field>
              )}
            />
            {ruleType === 'FIXED_DAY' && (
              <Controller
                control={control}
                name="non_business_day_policy"
                render={({ field }) => (
                  <Field
                    id="anchor-policy"
                    label="Se não for dia útil"
                    description={POLICY_HELP[policy]}
                  >
                    {(aria) => (
                      <ToggleGroup
                        type="single"
                        aria-label="Se não for dia útil"
                        id={aria.id}
                        value={field.value}
                        onValueChange={(value) =>
                          value && field.onChange(value as NonBusinessDayPolicy)
                        }
                      >
                        {(Object.keys(POLICY_LABEL) as NonBusinessDayPolicy[]).map((key) => (
                          <ToggleGroupItem key={key} value={key}>
                            {POLICY_LABEL[key]}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    )}
                  </Field>
                )}
              />
            )}
            <Field
              id="anchor-end"
              label="Termina em"
              error={formState.errors.end_month?.message}
              description="Vazio: sem fim."
            >
              {(aria) => (
                <Input {...aria} type="month" placeholder="aaaa-mm" {...register('end_month')} />
              )}
            </Field>
          </fieldset>
        )}

        {needsShape && (
          <Controller
            control={control}
            name="transition_shape"
            render={({ field, fieldState }) => (
              <Field
                id="anchor-shape"
                label="Formato do ciclo de transição"
                error={fieldState.error?.message}
                description={
                  shape
                    ? SHAPE_HELP[shape]
                    : 'A nova data cai depois da virada atual: escolha como fechar o ciclo no meio.'
                }
              >
                {(aria) => (
                  <ToggleGroup
                    type="single"
                    aria-label="Formato do ciclo de transição"
                    id={aria.id}
                    value={field.value ?? ''}
                    onValueChange={(value) =>
                      field.onChange(value ? (value as PayCycleTransitionShape) : null)
                    }
                  >
                    {PAY_CYCLE_TRANSITION_SHAPES.map((key) => (
                      <ToggleGroupItem key={key} value={key}>
                        {SHAPE_LABEL[key]}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                )}
              </Field>
            )}
          />
        )}
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

function TransitionReview({
  preview,
  anchor,
  next,
}: {
  preview: PayCycleAnchorTransitionPreviewResponse
  anchor: IncomeScheduleResponse
  /** the schedule that becomes the anchor; absent when only the rule of the current one changes */
  next: IncomeScheduleResponse | undefined
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">2 de 2 · O que muda</p>
      <p>
        {next ? (
          <>
            A receita âncora passa de <strong>{anchor.description}</strong> para{' '}
            <strong>{next.description}</strong>.
          </>
        ) : (
          <>
            A regra de <strong>{anchor.description}</strong> muda.
          </>
        )}
      </p>
      {preview.frozen_boundary && (
        <p className="text-sm">
          Os ciclos até <strong>{formatDate(preview.frozen_boundary)}</strong> e as viradas
          ajustadas à mão ficam como estão. {preview.preserved_cycles.length}{' '}
          {preview.preserved_cycles.length === 1 ? 'ciclo continua' : 'ciclos continuam'} como{' '}
          {preview.preserved_cycles.length === 1 ? 'está' : 'estão'}.
        </p>
      )}
      {preview.old_boundary && preview.new_boundary && (
        <p className="text-sm">
          A próxima virada passa de <strong>{formatDate(preview.old_boundary)}</strong> para{' '}
          <strong>{formatDate(preview.new_boundary)}</strong>.
        </p>
      )}
      {preview.transition_shape && (
        <p className="text-sm">
          Ciclo de transição <strong>{SHAPE_LABEL[preview.transition_shape].toLowerCase()}</strong>:{' '}
          {SHAPE_HELP[preview.transition_shape]}
        </p>
      )}

      {preview.cancelled_cycles.length > 0 && (
        <section aria-labelledby="transition-cancelled" className="flex flex-col gap-2">
          <h3 id="transition-cancelled" className="font-medium">
            Ciclos que serão cancelados ({preview.cancelled_cycles.length})
          </h3>
          <CycleLines cycles={preview.cancelled_cycles} />
        </section>
      )}
      {preview.new_cycles.length > 0 && (
        <section aria-labelledby="transition-new" className="flex flex-col gap-2">
          <h3 id="transition-new" className="font-medium">
            Ciclos novos ({preview.new_cycles.length})
          </h3>
          <CycleLines cycles={preview.new_cycles} />
        </section>
      )}
      {preview.pending.length > 0 && (
        <section aria-labelledby="transition-pending" className="flex flex-col gap-2">
          <h3 id="transition-pending" className="font-medium">
            Pendências
          </h3>
          <PendingList pending={preview.pending} />
        </section>
      )}
    </div>
  )
}
