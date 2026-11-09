import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'

import type { PayCycleActivationPreviewResponse, PayCycleConfigResponse } from '@/api/contracts'
import { FormAlert } from '@/components/domain/FormAlert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useIncomeSchedules } from '@/features/income/queries'
import { describeRule } from '@/features/income/rules'
import { applyApiErrors, errorMessage } from '@/lib/api-errors'
import { todayIso } from '@/lib/dates'
import { formatDate } from '@/lib/format'
import { useOnline } from '@/lib/online'
import { CycleLines } from './CycleLines'
import { PendingList } from './PendingList'
import { useActivatePayCycles, usePreviewActivation } from './queries'
import {
  ACTIVATION_FIELDS,
  activationSchema,
  activationWindow,
  type ActivationFormInput,
  type ActivationFormValues,
} from './schema'

interface ActivationSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: PayCycleConfigResponse
}

/** Turns the cycles on in two steps: the first day (see the first cycles), then confirm. */
export function ActivationSheet({ open, onOpenChange, config }: ActivationSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Ativar os ciclos</SheetTitle>
          <SheetDescription>
            O mês financeiro passa a começar no dia em que a receita âncora cai, e os relatórios por
            competência seguem esses ciclos. Nada antes do primeiro dia é refeito.
          </SheetDescription>
        </SheetHeader>
        {open && <ActivationForm config={config} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

function ActivationForm({
  config,
  onDone,
}: {
  config: PayCycleConfigResponse
  onDone: () => void
}) {
  const online = useOnline()
  const schedules = useIncomeSchedules('ACTIVE')
  const preview = usePreviewActivation()
  const activate = useActivatePayCycles()
  const [step, setStep] = useState<'choose' | 'preview'>('choose')
  const [initialDate, setInitialDate] = useState('')
  const [result, setResult] = useState<PayCycleActivationPreviewResponse | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const anchor = schedules.data?.find((schedule) => schedule.anchor)
  const [today] = useState(todayIso)
  const limits = activationWindow(today)
  const schema = useMemo(() => activationSchema(today), [today])
  const { register, handleSubmit, setError, formState } = useForm<
    ActivationFormInput,
    unknown,
    ActivationFormValues
  >({ resolver: zodResolver(schema), defaultValues: { initial_date: today } })

  const onPreview = handleSubmit((values) => {
    setFormError(null)
    preview.mutate(
      { initial_date: values.initial_date },
      {
        onSuccess: (data) => {
          setInitialDate(values.initial_date)
          setResult(data)
          setStep('preview')
        },
        onError: (error) => setFormError(applyApiErrors(error, setError, ACTIVATION_FIELDS)),
      },
    )
  })

  const onActivate = () => {
    if (!result) return
    setFormError(null)
    // mutateAsync, not mutate: the refreshed data can take this sheet off the screen before the
    // answer is handled, and the sheet still has to be closed.
    void activate
      .mutateAsync({ initial_date: initialDate, expected_version: result.expected_version })
      .then(onDone, (error: unknown) => setFormError(errorMessage(error)))
  }

  if (step === 'preview' && result) {
    const empty = result.cycles.length === 0
    return (
      <>
        <SheetBody>
          <p className="text-sm text-muted-foreground">2 de 2 · Os primeiros ciclos</p>
          {empty ? (
            <p className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
              Ainda não dá para calcular o primeiro ciclo a partir de {formatDate(initialDate)}.
              Resolva o que está pendente e tente de novo.
            </p>
          ) : (
            <p>
              Os ciclos começam em <strong>{formatDate(initialDate)}</strong>.
            </p>
          )}
          <CycleLines cycles={result.cycles} />
          {result.pending.length > 0 && (
            <section aria-labelledby="activation-pending" className="flex flex-col gap-2">
              <h3 id="activation-pending" className="font-medium">
                Pendências
              </h3>
              <PendingList pending={result.pending} />
            </section>
          )}
          {formError && <FormAlert message={formError} />}
        </SheetBody>
        <SheetFooter className="sticky bottom-0 border-t bg-background">
          <Button
            className="h-12 text-base"
            onClick={onActivate}
            disabled={empty || activate.isPending || !online}
          >
            {activate.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
            Ativar os ciclos
          </Button>
          <Button
            variant="outline"
            className="h-11"
            onClick={() => setStep('choose')}
            disabled={activate.isPending}
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
        <p className="text-sm text-muted-foreground">1 de 2 · Primeiro dia</p>
        {schedules.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : anchor ? (
          <div className="rounded-lg border bg-card p-4 text-sm">
            <p className="text-muted-foreground">Receita âncora</p>
            <p className="font-medium">{anchor.description}</p>
            <p>{describeRule(anchor)}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
            <p>
              {schedules.isError
                ? 'Não deu para ver as receitas agora.'
                : 'Nenhuma receita ativa abre os ciclos.'}{' '}
              Marque uma receita como âncora em{' '}
              <Link
                to="/receita/agenda"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Receita › Agenda
              </Link>{' '}
              e volte aqui.
            </p>
          </div>
        )}
        <Field
          id="activation-date"
          label="Primeiro dia do primeiro ciclo"
          error={formState.errors.initial_date?.message}
          description={`De ${formatDate(limits.earliest)} a ${formatDate(limits.latest)}. O comum é o dia em que a receita âncora caiu neste ciclo.`}
        >
          {(aria) => (
            <Input
              {...aria}
              type="date"
              min={limits.earliest}
              max={limits.latest}
              {...register('initial_date')}
            />
          )}
        </Field>
        {config.pending.length > 0 && <PendingList pending={config.pending} />}
        {formError && <FormAlert message={formError} />}
      </SheetBody>
      <SheetFooter className="sticky bottom-0 border-t bg-background">
        <Button
          type="submit"
          className="h-12 text-base"
          disabled={preview.isPending || !online || !anchor}
        >
          {preview.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
          Ver os primeiros ciclos
        </Button>
      </SheetFooter>
    </form>
  )
}
