import type { CardPurchaseBatchLineResponse, YearMonth } from '@/api/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { formatMoney, formatShortDate, formatShortMonth } from '@/lib/format'
import { effectiveDate, INITIAL_LINE_STATE, type LineState } from './importRequest'
import type { ImportLine, ParsedStatement, SkippedLine } from './parsers'

const SKIP_LABEL = {
  PAYMENT: 'Pagamento de fatura: não é compra',
  CREDIT: 'Crédito ou estorno: lance à mão se quiser',
  ZERO: 'Valor zerado',
  INVALID: 'Linha que não consegui ler',
} as const

interface ImportLinesListProps {
  statement: ParsedStatement
  states: Record<number, LineState>
  /** the dry run's answer per selected line; undefined while it is not back */
  results: Map<number, CardPurchaseBatchLineResponse | undefined>
  /** fees the same statement refunds, by line id */
  pairs: Map<number, SkippedLine>
  /** the invoice the file is of; a line that falls elsewhere gets a warning */
  invoiceMonth: YearMonth | ''
  onChange: (id: number, change: Partial<LineState>) => void
}

export function ImportLinesList({
  statement,
  states,
  results,
  pairs,
  invoiceMonth,
  onChange,
}: ImportLinesListProps) {
  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="import-lines" className="flex flex-col gap-2">
        <h2 id="import-lines" className="font-medium">
          Compras do arquivo
        </h2>
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {statement.lines.map((line) => (
            <li key={line.id}>
              <LineRow
                line={line}
                state={states[line.id] ?? INITIAL_LINE_STATE}
                result={results.get(line.id)}
                pairedWith={pairs.get(line.id)}
                invoiceMonth={invoiceMonth}
                onChange={(change) => onChange(line.id, change)}
              />
            </li>
          ))}
        </ul>
      </section>

      {statement.skipped.length > 0 && (
        <section aria-labelledby="import-skipped" className="flex flex-col gap-2">
          <h2 id="import-skipped" className="font-medium">
            Linhas que não entram
          </h2>
          <ul className="divide-y overflow-hidden rounded-lg border bg-card">
            {statement.skipped.map((line) => (
              <li key={line.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{line.description || 'Sem descrição'}</p>
                  <p className="text-muted-foreground">{SKIP_LABEL[line.reason]}</p>
                </div>
                {line.amount !== null && (
                  <span className="tabular-nums">{formatMoney(line.amount)}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function LineRow({
  line,
  state,
  result,
  pairedWith,
  invoiceMonth,
  onChange,
}: {
  line: ImportLine
  state: LineState
  result: CardPurchaseBatchLineResponse | undefined
  pairedWith: SkippedLine | undefined
  invoiceMonth: YearMonth | ''
  onChange: (change: Partial<LineState>) => void
}) {
  const id = `import-line-${line.id}`
  const falls = result?.invoice_reference_month ?? null
  const divergent =
    state.selected && falls !== null && invoiceMonth !== '' && falls !== invoiceMonth
  const canAdjust = line.firstInstallment > 1 && (divergent || state.adjusted)

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Checkbox
        id={id}
        className="mt-1"
        checked={state.selected}
        aria-label={`Importar ${line.description}`}
        onCheckedChange={(checked) => onChange({ selected: checked === true })}
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium break-words">{line.description}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <span>{formatShortDate(effectiveDate(line, state))}</span>
          {line.installments > 1 && (
            <Badge variant="secondary">
              {line.firstInstallment}/{line.installments}
            </Badge>
          )}
          {line.lastDigits && <Badge variant="outline">final {line.lastDigits}</Badge>}
          {line.international && <Badge variant="warning">internacional</Badge>}
          {state.selected && result && <StatusBadge result={result} />}
          {state.selected && falls && <span>fatura {formatShortMonth(falls)}</span>}
        </p>
        {pairedWith && (
          <p className="mt-1 text-sm text-muted-foreground">
            Estornada no mesmo arquivo ({formatMoney(-(pairedWith.amount ?? 0))}): vem desmarcada.
          </p>
        )}
        {state.selected && result?.status === 'ERROR' && (
          <p role="alert" className="mt-1 text-sm text-destructive">
            {Object.values(result.errors).join(' · ') || 'A compra tem um erro.'}
          </p>
        )}
        {state.selected && result?.status === 'POSSIBLE_DUPLICATE' && (
          <div className="mt-1 flex items-center gap-2 text-sm">
            <Checkbox
              id={`${id}-accept`}
              checked={state.acceptDuplicate}
              aria-label={`Importar mesmo assim ${line.description}`}
              onCheckedChange={(checked) => onChange({ acceptDuplicate: checked === true })}
            />
            <label htmlFor={`${id}-accept`}>
              Parece uma compra já lançada neste cartão. Importar mesmo assim
            </label>
          </div>
        )}
        {divergent && (
          <div className="text-warning-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span>
              Cai na fatura de {formatShortMonth(falls)}, não na de {formatShortMonth(invoiceMonth)}
              .
            </span>
            {canAdjust && (
              <Button variant="outline" size="sm" onClick={() => onChange({ adjusted: true })}>
                Tratar a data como a da parcela
              </Button>
            )}
          </div>
        )}
        {state.adjusted && (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              Data movida {line.firstInstallment - 1}{' '}
              {line.firstInstallment - 1 === 1 ? 'mês' : 'meses'} para trás.
            </span>
            <Button variant="ghost" size="sm" onClick={() => onChange({ adjusted: false })}>
              Desfazer
            </Button>
          </div>
        )}
      </div>
      <span className="shrink-0 font-medium tabular-nums">
        {formatMoney(line.installmentAmount)}
      </span>
    </div>
  )
}

function StatusBadge({ result }: { result: CardPurchaseBatchLineResponse }) {
  switch (result.status) {
    case 'NEW':
      return <Badge variant="outline">nova</Badge>
    case 'DUPLICATE':
      return <Badge variant="muted">já importada</Badge>
    case 'POSSIBLE_DUPLICATE':
      return <Badge variant="warning">parece repetida</Badge>
    case 'ERROR':
      return <Badge variant="destructive">erro</Badge>
  }
}
