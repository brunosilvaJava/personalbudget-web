import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import type {
  BusinessWeek,
  DateRuleType,
  IncomeScheduleResponse,
  NonBusinessDayPolicy,
} from '@/api/contracts'
import { FormAlert } from '@/components/domain/FormAlert'
import { MoneyInput } from '@/components/domain/MoneyInput'
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
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CategorySelect } from '@/features/categories/CategorySelect'
import { AnchorLockedNote } from '@/features/pay-cycles/AnchorLockedNote'
import { useFixedBills } from '@/features/recurring/queries'
import { applyApiErrors } from '@/lib/api-errors'
import { formatShortMonth } from '@/lib/format'
import { useOnline } from '@/lib/online'
import { useCreateIncomeSchedule, useUpdateIncomeSchedule } from './queries'
import {
  BUSINESS_WEEK_LABEL,
  DATE_RULE_LABEL,
  POLICY_HELP,
  POLICY_LABEL,
  RULE_VALUE_RANGE,
} from './rules'
import {
  INCOME_SCHEDULE_FIELDS,
  incomeScheduleDefaults,
  incomeScheduleSchema,
  toIncomeScheduleRequest,
  toIncomeScheduleUpdate,
  type IncomeScheduleFormInput,
  type IncomeScheduleFormValues,
} from './schema'

/** Radix Select cannot have an empty value: this one stands for "no fixed bill". */
const NO_BILL = 'none'

interface IncomeScheduleFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** editing this schedule; creating when absent */
  schedule?: IncomeScheduleResponse
  /** called with the saved schedule, e.g. to open it */
  onSaved?: (schedule: IncomeScheduleResponse) => void
}

export function IncomeScheduleFormSheet({
  open,
  onOpenChange,
  schedule,
  onSaved,
}: IncomeScheduleFormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{schedule ? 'Editar receita' : 'Nova receita'}</SheetTitle>
          <SheetDescription>
            A receita que se repete todo mês, como o salário. O app calcula a data de cada mês pela
            regra e pelo calendário de feriados, e lança no dia.
          </SheetDescription>
        </SheetHeader>
        {open && (
          <IncomeScheduleForm
            schedule={schedule}
            onDone={(saved) => {
              onOpenChange(false)
              onSaved?.(saved)
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function IncomeScheduleForm({
  schedule,
  onDone,
}: {
  schedule?: IncomeScheduleResponse
  onDone: (saved: IncomeScheduleResponse) => void
}) {
  const online = useOnline()
  const create = useCreateIncomeSchedule()
  const update = useUpdateIncomeSchedule()
  const pending = create.isPending || update.isPending
  const [formError, setFormError] = useState<string | null>(null)
  const schema = useMemo(() => incomeScheduleSchema(Boolean(schedule)), [schedule])
  const { register, control, handleSubmit, setError, formState } = useForm<
    IncomeScheduleFormInput,
    unknown,
    IncomeScheduleFormValues
  >({ resolver: zodResolver(schema), defaultValues: incomeScheduleDefaults(schedule) })
  const ruleType = useWatch({ control, name: 'rule_type' })
  const policy = useWatch({ control, name: 'non_business_day_policy' })
  const range = RULE_VALUE_RANGE[ruleType]

  const fixedBills = useFixedBills({ operation_type: ['CREDIT'], status: ['ACTIVE'] })
  const creditBills = fixedBills.data?.pages.flatMap((page) => page.content) ?? []

  const onError = (error: unknown) =>
    setFormError(applyApiErrors(error, setError, INCOME_SCHEDULE_FIELDS))

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    if (!schedule) {
      create.mutateAsync(toIncomeScheduleRequest(values)).then((created) => {
        toast.success(`Receita “${created.description}” criada.`)
        onDone(created)
      }, onError)
      return
    }
    const body = toIncomeScheduleUpdate(schedule, values)
    if (Object.keys(body).length === 0) return onDone(schedule)
    update.mutateAsync({ code: schedule.code, body }).then((updated) => {
      toast.success('Receita atualizada. As datas já lançadas não mudam.')
      onDone(updated)
    }, onError)
  })

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="contents" noValidate>
      <SheetBody>
        {schedule && <AnchorLockedNote schedule={schedule} />}
        <Field
          id="income-description"
          label="Descrição"
          error={formState.errors.description?.message}
        >
          {(aria) => (
            <Input
              {...aria}
              {...register('description')}
              autoComplete="off"
              maxLength={50}
              placeholder="Ex.: Salário"
            />
          )}
        </Field>
        <Controller
          control={control}
          name="amount"
          render={({ field, fieldState }) => (
            <Field id="income-amount" label="Valor" error={fieldState.error?.message}>
              {(aria) => (
                <MoneyInput
                  {...aria}
                  ref={field.ref}
                  name={field.name}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="0,00"
                />
              )}
            </Field>
          )}
        />
        <Controller
          control={control}
          name="category_code"
          render={({ field, fieldState }) => (
            <Field id="income-category" label="Categoria" error={fieldState.error?.message}>
              {(aria) => (
                <CategorySelect
                  {...aria}
                  value={field.value}
                  onChange={(code) => field.onChange(code)}
                  operationType="CREDIT"
                  // A category can be replaced, never removed.
                  allowNone={!schedule?.category_code}
                />
              )}
            </Field>
          )}
        />

        <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">Quando cai</legend>
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
            id="income-rule-value"
            label={ruleType === 'FIXED_DAY' ? 'Dia do mês' : 'Qual dia útil'}
            error={formState.errors.rule_value?.message}
            description={
              ruleType === 'FIXED_DAY'
                ? `De ${range.min} a ${range.max}. Em mês sem esse dia, vale o último.`
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
              <Field id="income-business-week" label="Dias úteis">
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
                  id="income-policy"
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
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          {schedule ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm leading-none font-medium">Começa em</span>
              <p className="flex min-h-11 items-center text-sm">
                {formatShortMonth(schedule.start_month)}
              </p>
            </div>
          ) : (
            <Field
              id="income-start"
              label="Começa em"
              error={formState.errors.start_month?.message}
            >
              {(aria) => (
                <Input {...aria} type="month" placeholder="aaaa-mm" {...register('start_month')} />
              )}
            </Field>
          )}
          <Field
            id="income-end"
            label="Termina em"
            error={formState.errors.end_month?.message}
            description="Vazio: sem fim."
          >
            {(aria) => (
              <Input {...aria} type="month" placeholder="aaaa-mm" {...register('end_month')} />
            )}
          </Field>
        </div>

        <Controller
          control={control}
          name="anchor"
          render={({ field }) => (
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Switch
                id="income-anchor"
                checked={field.value}
                onCheckedChange={field.onChange}
                className="mt-0.5"
              />
              <label htmlFor="income-anchor" className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Abre os ciclos financeiros</span>
                <span className="text-muted-foreground">
                  A receita âncora marca o começo de cada ciclo. Só uma receita ativa pode ser
                  âncora.
                </span>
              </label>
            </div>
          )}
        />

        {!schedule && creditBills.length > 0 && (
          <Controller
            control={control}
            name="replaces_fixed_bill_code"
            render={({ field, fieldState }) => (
              <Field
                id="income-replaces"
                label="Substitui uma conta fixa"
                error={fieldState.error?.message}
                description="A conta fixa de receita termina na véspera do início, para o mês não ser lançado duas vezes."
              >
                {(aria) => (
                  <Select
                    value={field.value ?? NO_BILL}
                    onValueChange={(value) => field.onChange(value === NO_BILL ? null : value)}
                  >
                    <SelectTrigger {...aria}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_BILL}>Nenhuma</SelectItem>
                      {creditBills.map((bill) => (
                        <SelectItem key={bill.code} value={bill.code}>
                          {bill.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
            )}
          />
        )}

        {formError && <FormAlert message={formError} />}
      </SheetBody>
      <SheetFooter className="sticky bottom-0 border-t bg-background">
        <Button type="submit" className="h-12 text-base" disabled={pending || !online}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden />}
          {schedule ? 'Salvar' : 'Criar receita'}
        </Button>
      </SheetFooter>
    </form>
  )
}
