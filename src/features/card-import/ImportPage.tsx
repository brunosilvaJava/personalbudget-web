import { ArrowLeft, FileUp } from 'lucide-react'
import { useEffect, useEffectEvent, useMemo, useState, type ChangeEvent } from 'react'
import { Link, useParams } from 'react-router'

import type { CardPurchaseBatchLineResponse, CreditCardResponse, YearMonth } from '@/api/contracts'
import { FormAlert } from '@/components/domain/FormAlert'
import { LoadError } from '@/components/domain/LoadError'
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
import { Skeleton } from '@/components/ui/skeleton'
import { useActiveThirdParties } from '@/features/third-parties/queries'
import { useCard } from '@/features/wallet/cardQueries'
import { OWNER_DEFAULT, OWNER_OWN } from '@/features/wallet/cardSchema'
import { useHolders, usePlastics } from '@/features/wallet/holderQueries'
import { errorMessage } from '@/lib/api-errors'
import { formatMoney, formatShortMonth } from '@/lib/format'
import { fromCents, toCents } from '@/lib/money'
import { useOnline } from '@/lib/online'
import { ImportLinesList } from './ImportLinesList'
import {
  INITIAL_LINE_STATE,
  MAX_IMPORT_LINES,
  selectedLines,
  toBatchRequest,
  type LineState,
} from './importRequest'
import { NewPlasticsBlock } from './NewPlasticsBlock'
import { findNewPlastics } from './plastics'
import {
  pairRefundedFees,
  parseStatement,
  StatementParseError,
  type ParsedStatement,
} from './parsers'
import { useImportPurchases, usePreviewImport } from './queries'

/** The statement of a card, checked line by line before anything is written. */
export function ImportPage() {
  const { code = '' } = useParams()
  const card = useCard(code)
  return (
    <>
      <Button asChild variant="ghost" className="mb-2 -ml-3 h-11">
        <Link to={`/carteira/cartoes/${code}`}>
          <ArrowLeft aria-hidden />
          Cartão
        </Link>
      </Button>
      {card.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : card.isError ? (
        <LoadError error={card.error} onRetry={() => void card.refetch()} />
      ) : (
        <ImportWorkspace card={card.data} />
      )}
    </>
  )
}

const BANK_LABEL = { NUBANK: 'Nubank', C6: 'C6' } as const

/** The invoice most single-payment lines fall in: the one the file is of. */
function commonInvoice(
  results: CardPurchaseBatchLineResponse[] | null,
  single: boolean[],
): YearMonth | '' {
  const counts = new Map<YearMonth, number>()
  results?.forEach((result, index) => {
    if (single[index] && result.invoice_reference_month) {
      counts.set(
        result.invoice_reference_month,
        (counts.get(result.invoice_reference_month) ?? 0) + 1,
      )
    }
  })
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
}

function ImportWorkspace({ card }: { card: CreditCardResponse }) {
  const online = useOnline()
  const holders = useHolders(card.code)
  const plastics = usePlastics(card.code)
  const thirdParties = useActiveThirdParties()
  const preview = usePreviewImport()
  const importer = useImportPurchases()

  const [statement, setStatement] = useState<ParsedStatement | null>(null)
  const [fileName, setFileName] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const [states, setStates] = useState<Record<number, LineState>>({})
  const [owner, setOwner] = useState<string>(OWNER_DEFAULT)
  const [chosenMonth, setChosenMonth] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [done, setDone] = useState<CardPurchaseBatchLineResponse[] | null>(null)

  const lines = useMemo(() => statement?.lines ?? [], [statement])
  const pairs = useMemo(
    () => (statement ? pairRefundedFees(statement.lines, statement.skipped) : new Map()),
    [statement],
  )
  const sent = selectedLines(lines, states)
  const request = sent.length > 0 ? toBatchRequest(card.code, lines, states, owner, true) : null
  const requestKey = JSON.stringify(request)
  const runPreview = useEffectEvent((next: typeof request) => {
    if (next) preview.mutate(next)
  })
  useEffect(() => {
    runPreview(JSON.parse(requestKey) as typeof request)
  }, [requestKey])

  // The answer belongs to the lines on the screen only while nothing changed since it was asked.
  const results =
    preview.data && JSON.stringify(preview.variables) === requestKey ? preview.data : null
  const resultOf = new Map(sent.map((line, index) => [line.id, results?.[index]]))
  const invoiceMonth =
    chosenMonth ||
    commonInvoice(
      results,
      sent.map((line) => line.installments === 1),
    )

  const known = new Set(
    (plastics.data ?? []).filter((p) => p.status === 'ACTIVE').map((p) => p.last_digits),
  )
  const newPlastics = plastics.data ? findNewPlastics(sent, known) : []

  const stateOf = (id: number) => states[id] ?? INITIAL_LINE_STATE
  const update = (id: number, change: Partial<LineState>) =>
    setStates((current) => ({
      ...current,
      [id]: { ...(current[id] ?? INITIAL_LINE_STATE), ...change },
    }))

  function load(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setFileError(null)
    setSubmitError(null)
    setDone(null)
    void file.text().then(
      (text) => {
        try {
          const parsed = parseStatement(text)
          const paired = pairRefundedFees(parsed.lines, parsed.skipped)
          setStatement(parsed)
          setFileName(file.name)
          setStates(
            Object.fromEntries(
              [...paired.keys()].map((id) => [id, { ...INITIAL_LINE_STATE, selected: false }]),
            ),
          )
          setChosenMonth('')
          preview.reset()
        } catch (error) {
          setStatement(null)
          setFileError(
            error instanceof StatementParseError ? error.message : 'Não consegui ler o arquivo.',
          )
        }
      },
      () => setFileError('Não consegui ler o arquivo.'),
    )
    event.target.value = ''
  }

  const errors = sent.filter((line) => resultOf.get(line.id)?.status === 'ERROR').length
  const unresolved = sent.filter(
    (line) =>
      resultOf.get(line.id)?.status === 'POSSIBLE_DUPLICATE' && !stateOf(line.id).acceptDuplicate,
  ).length
  const total = fromCents(sent.reduce((sum, line) => sum + toCents(line.installmentAmount), 0))
  const blocker =
    sent.length === 0
      ? 'Marque ao menos uma compra.'
      : sent.length > MAX_IMPORT_LINES
        ? `No máximo ${MAX_IMPORT_LINES} compras por importação: desmarque ${sent.length - MAX_IMPORT_LINES}.`
        : newPlastics.length > 0
          ? 'Cadastre os plásticos novos antes de importar.'
          : !results
            ? 'Conferindo as compras…'
            : errors > 0
              ? `${errors} ${errors === 1 ? 'compra com erro' : 'compras com erro'}: corrija ou desmarque.`
              : unresolved > 0
                ? `${unresolved} ${unresolved === 1 ? 'compra parecida com outra já lançada' : 'compras parecidas com outras já lançadas'}: desmarque ou aceite.`
                : null

  function submit() {
    setSubmitError(null)
    importer
      .mutateAsync(toBatchRequest(card.code, lines, states, owner, false))
      .then(setDone, (error) => setSubmitError(errorMessage(error)))
  }

  if (done) return <ImportDone card={card} lines={done} />

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Importar fatura</h1>
        <p className="text-sm text-muted-foreground">
          {card.name}. Nada é lançado antes de você conferir a lista e confirmar.
        </p>
      </header>

      <Field
        id="import-file"
        label="Arquivo da fatura (CSV do Nubank ou do C6)"
        error={fileError ?? undefined}
        description={statement ? `Lido: ${fileName}` : undefined}
      >
        {(aria) => (
          <Input {...aria} type="file" accept=".csv,text/csv" onChange={load} disabled={!online} />
        )}
      </Field>

      {statement && (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {BANK_LABEL[statement.bank]} · {statement.lines.length}{' '}
            {statement.lines.length === 1 ? 'compra' : 'compras'}
            {statement.skipped.length > 0 &&
              ` · ${statement.skipped.length} ${statement.skipped.length === 1 ? 'linha não entra' : 'linhas não entram'}`}
          </p>

          {newPlastics.length > 0 && holders.data && (
            <NewPlasticsBlock card={card} plastics={newPlastics} holders={holders.data} />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id="import-month"
              label="Fatura do arquivo"
              description="Compras que caem em outra fatura vêm com aviso."
            >
              {(aria) => (
                <Input
                  {...aria}
                  type="month"
                  value={invoiceMonth}
                  onChange={(event) => setChosenMonth(event.target.value)}
                />
              )}
            </Field>
            {(thirdParties.data ?? []).length > 0 && (
              <Field
                id="import-owner"
                label="De quem são as compras"
                description="Vale para o arquivo todo."
              >
                {(aria) => (
                  <Select value={owner} onValueChange={setOwner}>
                    <SelectTrigger {...aria}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={OWNER_DEFAULT}>Padrão do plástico e do cartão</SelectItem>
                      <SelectItem value={OWNER_OWN}>Minhas</SelectItem>
                      {(thirdParties.data ?? []).map((party) => (
                        <SelectItem key={party.code} value={party.code}>
                          {party.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
            )}
          </div>

          <ImportLinesList
            statement={statement}
            states={states}
            results={resultOf}
            pairs={pairs}
            invoiceMonth={invoiceMonth}
            onChange={update}
          />

          {submitError && <FormAlert message={submitError} />}
          <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t bg-background px-4 py-3">
            <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
              {sent.length} {sent.length === 1 ? 'compra marcada' : 'compras marcadas'} · soma{' '}
              {formatMoney(total)}
              {invoiceMonth && ` · fatura ${formatShortMonth(invoiceMonth)}`}
            </p>
            {blocker && <p className="text-warning-foreground text-sm">{blocker}</p>}
            <Button
              className="h-12 text-base"
              disabled={blocker !== null || !online || importer.isPending}
              onClick={submit}
            >
              <FileUp aria-hidden />
              Importar {sent.length} {sent.length === 1 ? 'compra' : 'compras'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function ImportDone({
  card,
  lines,
}: {
  card: CreditCardResponse
  lines: CardPurchaseBatchLineResponse[]
}) {
  const created = lines.filter((line) => line.status === 'NEW').length
  const skipped = lines.filter((line) => line.status === 'DUPLICATE').length
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">Fatura importada</h1>
      <p role="status">
        {created} {created === 1 ? 'compra lançada' : 'compras lançadas'} em {card.name}
        {skipped > 0 &&
          `; ${skipped} ${skipped === 1 ? 'já estava lançada e foi pulada' : 'já estavam lançadas e foram puladas'}`}
        .
      </p>
      <Button asChild className="h-11 self-start">
        <Link to={`/carteira/cartoes/${card.code}`}>Ver o cartão</Link>
      </Button>
    </div>
  )
}
