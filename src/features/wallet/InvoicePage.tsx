import { ArrowLeft, LoaderCircle, Undo2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'

import type {
  CardInvoicePaymentResponse,
  CardInvoiceResponse,
  CreditCardResponse,
  UUID,
} from '@/api/contracts'
import { ConfirmDialog } from '@/components/domain/ConfirmDialog'
import { ErrorState } from '@/components/domain/ErrorState'
import { FormAlert } from '@/components/domain/FormAlert'
import { LoadError } from '@/components/domain/LoadError'
import { StatusBadge } from '@/components/domain/StatusBadge'
import { Badge } from '@/components/ui/badge'
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
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage } from '@/lib/api-errors'
import { dateOf, todayIso } from '@/lib/dates'
import { formatDate, formatMoney, formatShortMonth } from '@/lib/format'
import { fromCents, toCents } from '@/lib/money'
import { useOnline } from '@/lib/online'
import { AccountSelect } from './AccountSelect'
import { InvoiceStateBadge } from './CardPage'
import {
  useCardLookup,
  useInvoice,
  useInvoicePayments,
  usePayInvoice,
  useReverseInvoicePayment,
} from './cardQueries'
import { PurchaseSheet } from './PurchaseSheet'
import { useAccountLookup, useActiveAccounts } from './queries'

/** An invoice: its installments, paying the WHOLE remaining amount and the payment history. */
export function InvoicePage() {
  const { code = '' } = useParams()
  const invoice = useInvoice(code)
  const cards = useCardLookup()
  const card = invoice.data ? cards.get(invoice.data.card_code) : undefined

  return (
    <>
      <Button asChild variant="ghost" className="mb-2 -ml-3 h-11">
        <Link
          to={invoice.data ? `/carteira/cartoes/${invoice.data.card_code}` : '/carteira/cartoes'}
        >
          <ArrowLeft aria-hidden />
          {card?.name ?? 'Cartões'}
        </Link>
      </Button>
      {invoice.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : invoice.isError ? (
        <LoadError error={invoice.error} onRetry={() => void invoice.refetch()} />
      ) : (
        <InvoiceView invoice={invoice.data} card={card} />
      )}
    </>
  )
}

function InvoiceView({
  invoice,
  card,
}: {
  invoice: CardInvoiceResponse
  card: CreditCardResponse | undefined
}) {
  const online = useOnline()
  const [paying, setPaying] = useState(false)
  const [purchaseCode, setPurchaseCode] = useState<UUID | null>(null)
  const remaining = fromCents(toCents(invoice.total_amount) - toCents(invoice.paid_amount))

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Fatura de {formatShortMonth(invoice.reference_month)}
          </h1>
          <InvoiceStateBadge state={invoice.state} />
        </div>
        <p className="text-sm text-muted-foreground">
          Fecha {formatDate(invoice.closing_date)} · vence {formatDate(invoice.due_date)}
        </p>
      </header>

      <dl className="grid grid-cols-3 gap-2 rounded-lg border bg-card p-4 text-sm">
        <Total label="Total">{formatMoney(invoice.total_amount)}</Total>
        <Total label="Pago">{formatMoney(invoice.paid_amount)}</Total>
        <Total label="Falta">{formatMoney(remaining)}</Total>
      </dl>

      {invoice.third_party_total_amount > 0 && (
        <section aria-labelledby="invoice-split" className="flex flex-col gap-2">
          <h2 id="invoice-split" className="sr-only">
            Quanto é seu e quanto é de terceiros
          </h2>
          <dl className="grid grid-cols-2 gap-2 rounded-lg border bg-card p-4 text-sm">
            <Total label="É meu">{formatMoney(invoice.own_total_amount)}</Total>
            <Total label="É de terceiros">{formatMoney(invoice.third_party_total_amount)}</Total>
          </dl>
        </section>
      )}

      {invoice.holder_total_list.length > 1 && (
        <section aria-labelledby="invoice-holders" className="flex flex-col gap-2">
          <h2 id="invoice-holders" className="font-medium">
            Por titular
          </h2>
          <ul className="divide-y overflow-hidden rounded-lg border bg-card">
            {invoice.holder_total_list.map((holder) => (
              <li key={holder.holder_code} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1 truncate">
                  {holder.holder_name}
                  {holder.kind === 'TITULAR' && (
                    <span className="text-muted-foreground"> · titular</span>
                  )}
                </span>
                <span className="tabular-nums">{formatMoney(holder.total_amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {invoice.state !== 'PAID' && remaining > 0 && (
        <Button className="h-12 text-base" onClick={() => setPaying(true)} disabled={!online}>
          Pagar fatura · {formatMoney(remaining)}
        </Button>
      )}

      <section aria-labelledby="invoice-items" className="flex flex-col gap-2">
        <h2 id="invoice-items" className="font-medium">
          Compras na fatura
        </h2>
        {invoice.installments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma parcela nesta fatura.</p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-lg border bg-card">
            {invoice.installments.map((installment) => (
              <li key={installment.movement_code}>
                <button
                  type="button"
                  className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/60"
                  onClick={() => setPurchaseCode(installment.purchase_code)}
                >
                  <span className="min-w-0 flex-1 truncate">{installment.description}</span>
                  <StatusBadge status={installment.status} operationType="DEBIT" />
                  <span className="tabular-nums">{formatMoney(installment.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PaymentHistory invoice={invoice} />

      <PayInvoiceSheet
        open={paying}
        onOpenChange={setPaying}
        invoice={invoice}
        remaining={remaining}
        defaultAccountCode={card?.default_account_code ?? null}
      />
      <PurchaseSheet
        open={purchaseCode !== null}
        onOpenChange={(open) => !open && setPurchaseCode(null)}
        purchaseCode={purchaseCode}
      />
    </div>
  )
}

function Total({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{children}</dd>
    </div>
  )
}

/** Account: the chosen one, else the card's default, else the default account. */
function PayInvoiceSheet({
  open,
  onOpenChange,
  invoice,
  remaining,
  defaultAccountCode,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: CardInvoiceResponse
  remaining: number
  defaultAccountCode: UUID | null
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Pagar fatura de {formatShortMonth(invoice.reference_month)}</SheetTitle>
          <SheetDescription>
            Paga o que falta de todas as parcelas de uma vez, numa conta e numa data. Não há
            pagamento parcial de fatura.
          </SheetDescription>
        </SheetHeader>
        {open && (
          <PayInvoiceForm
            invoice={invoice}
            remaining={remaining}
            defaultAccountCode={defaultAccountCode}
            onDone={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function PayInvoiceForm({
  invoice,
  remaining,
  defaultAccountCode,
  onDone,
}: {
  invoice: CardInvoiceResponse
  remaining: number
  defaultAccountCode: UUID | null
  onDone: () => void
}) {
  const online = useOnline()
  const pay = usePayInvoice()
  const accounts = useActiveAccounts()
  const fallback = accounts.data?.find((account) => account.default)?.code ?? null
  const [chosen, setChosen] = useState<UUID | null>(null)
  const accountCode = chosen ?? defaultAccountCode ?? fallback
  const [date, setDate] = useState(todayIso())
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      className="contents"
      onSubmit={(event) => {
        event.preventDefault()
        setError(null)
        pay
          .mutateAsync({
            code: invoice.code,
            body: { payment_date: date, ...(accountCode ? { account_code: accountCode } : {}) },
          })
          .then(
            (payment) => {
              toast.success(`Fatura paga: ${formatMoney(payment.amount)}.`)
              onDone()
            },
            (payError) => setError(errorMessage(payError)),
          )
      }}
    >
      <SheetBody>
        <div className="rounded-lg bg-muted p-4">
          <p className="text-sm text-muted-foreground">Valor</p>
          <p className="text-2xl font-semibold tabular-nums">{formatMoney(remaining)}</p>
        </div>
        <Field id="invoice-account" label="Pagar com a conta">
          {(aria) => <AccountSelect {...aria} value={accountCode} onChange={setChosen} />}
        </Field>
        <Field id="invoice-date" label="Data do pagamento">
          {(aria) => (
            <Input
              {...aria}
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          )}
        </Field>
        {error && <FormAlert message={error} />}
      </SheetBody>
      <SheetFooter className="sticky bottom-0 border-t bg-background">
        <Button
          type="submit"
          className="h-12 text-base"
          disabled={pay.isPending || !online || !date}
        >
          {pay.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
          Confirmar pagamento
        </Button>
      </SheetFooter>
    </form>
  )
}

function PaymentHistory({ invoice }: { invoice: CardInvoiceResponse }) {
  const online = useOnline()
  const payments = useInvoicePayments(invoice.code)
  const accounts = useAccountLookup()
  const reverse = useReverseInvoicePayment()
  const [toReverse, setToReverse] = useState<CardInvoicePaymentResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (payments.isPending) return <Skeleton className="h-16 w-full" />
  if (payments.isError) {
    return (
      <ErrorState error={payments.error} onRetry={() => void payments.refetch()} className="py-6" />
    )
  }
  if (payments.data.length === 0) return null

  return (
    <section aria-labelledby="invoice-payments" className="flex flex-col gap-2">
      <h2 id="invoice-payments" className="font-medium">
        Pagamentos
      </h2>
      <ul className="divide-y overflow-hidden rounded-lg border bg-card">
        {payments.data.map((payment) => {
          const reversed = payment.reversed_at !== null
          return (
            <li key={payment.code} className="flex min-h-12 items-center gap-3 px-4 py-2 text-sm">
              <div className={reversed ? 'flex-1 text-muted-foreground line-through' : 'flex-1'}>
                <span className="tabular-nums">{formatMoney(payment.amount)}</span>
                <span className="text-muted-foreground">
                  {' '}
                  em {formatDate(payment.payment_date)} ·{' '}
                  {accounts.get(payment.account_code)?.name ?? 'conta'}
                </span>
              </div>
              {reversed ? (
                <Badge variant="muted">
                  estornado em {formatDate(dateOf(payment.reversed_at!))}
                </Badge>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10"
                  onClick={() => setToReverse(payment)}
                  disabled={!online}
                >
                  <Undo2 aria-hidden />
                  Estornar
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      {error && <FormAlert message={error} />}
      <ConfirmDialog
        open={toReverse !== null}
        onOpenChange={(open) => !open && setToReverse(null)}
        title="Estornar pagamento da fatura?"
        description="Todas as parcelas pagas por ele voltam a ficar pendentes, e o valor volta para a conta. O registro fica no histórico."
        confirmLabel="Estornar"
        pending={reverse.isPending}
        onConfirm={() => {
          if (!toReverse) return
          setError(null)
          reverse.mutateAsync({ invoiceCode: invoice.code, paymentCode: toReverse.code }).then(
            () => {
              setToReverse(null)
              toast.success('Pagamento da fatura estornado.')
            },
            (reverseError) => {
              setToReverse(null)
              setError(errorMessage(reverseError))
            },
          )
        }}
      />
    </section>
  )
}
