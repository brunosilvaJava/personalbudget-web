import { CircleCheck, LoaderCircle, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router'

import type { PayCycleClosurePreviewResponse, PayCycleResponse, UUID } from '@/api/contracts'
import { ErrorState } from '@/components/domain/ErrorState'
import { FormAlert } from '@/components/domain/FormAlert'
import { Button } from '@/components/ui/button'
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
import { useCategoryLookup } from '@/features/categories/queries'
import { MovementRow } from '@/features/movements/MovementRow'
import { useOnline } from '@/lib/online'
import {
  blockedMovementsLink,
  canPreviewClosure,
  closureErrorMessage,
  describeBlocker,
  LATE_LISTED,
} from './closure'
import { CycleSummaryView } from './CycleSummaryView'
import { useCloseCycle, useClosurePreview, useMovementsByCode } from './queries'
import { describeSummaryPending } from './rules'

interface ClosureSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cycle: PayCycleResponse
}

/**
 * The review before closing a cycle: what would be frozen, what blocks it and, when nothing does,
 * the button that closes it. For a cycle that has not ended it only says what is missing.
 */
export function ClosureSheet({ open, onOpenChange, cycle }: ClosureSheetProps) {
  const ended = cycle.status === 'PENDING_CLOSE'
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {ended ? `Fechar ${cycle.label}` : `Fechamento de ${cycle.label}`}
          </SheetTitle>
          <SheetDescription>
            Fechar congela o relatório por competência deste ciclo num registro e protege as
            movimentações dele de alterações. Dá para reabrir depois.
          </SheetDescription>
        </SheetHeader>
        {open && <ClosureReview cycle={cycle} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

function ClosureReview({ cycle, onDone }: { cycle: PayCycleResponse; onDone: () => void }) {
  const online = useOnline()
  const preview = useClosurePreview(cycle.code, canPreviewClosure(cycle))
  const close = useCloseCycle()

  if (preview.isPending) {
    return (
      <SheetBody>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </SheetBody>
    )
  }
  if (preview.isError) {
    return (
      <SheetBody>
        <ErrorState error={preview.error} onRetry={() => void preview.refetch()} />
      </SheetBody>
    )
  }

  const data = preview.data

  return (
    <>
      <SheetBody>
        <Verdict cycle={cycle} data={data} />

        <section aria-labelledby="closure-frozen" className="flex flex-col gap-2">
          <h3 id="closure-frozen" className="font-medium">
            O que fica registrado
          </h3>
          <CycleSummaryView
            summary={data.summary}
            caption="Totais que o fechamento registra"
            showIncompleteNote={false}
          />
        </section>

        {close.isError && <FormAlert message={closureErrorMessage(close.error)} />}
      </SheetBody>
      {cycle.status === 'PENDING_CLOSE' && (
        <SheetFooter className="sticky bottom-0 border-t bg-background">
          <Button
            className="h-12 text-base"
            disabled={!data.can_close || close.isPending || preview.isFetching || !online}
            onClick={() =>
              // mutateAsync, not mutate: the closed cycle changes the page under this sheet before the
              // answer is handled, and a callback given to `mutate` would not run. The error shows
              // from `close.error`.
              void close
                .mutateAsync({ code: cycle.code, expectedVersion: data.expected_version })
                .then(onDone, () => undefined)
            }
          >
            {close.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
            Fechar o ciclo
          </Button>
        </SheetFooter>
      )}
    </>
  )
}

/** "Tudo certo" or, for each blocker, what it is and where to fix it. */
function Verdict({
  cycle,
  data,
}: {
  cycle: PayCycleResponse
  data: PayCycleClosurePreviewResponse
}) {
  if (data.can_close) {
    return (
      <div
        role="note"
        className="flex gap-3 rounded-lg border border-income/40 bg-income/10 p-4 text-sm"
      >
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-income" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="font-medium">Nada impede o fechamento</p>
          <p>Confira os totais abaixo. Depois de fechar, o relatório deste ciclo não muda mais.</p>
        </div>
      </div>
    )
  }

  return (
    <section aria-labelledby="closure-blockers" className="flex flex-col gap-2">
      <h3 id="closure-blockers" className="font-medium">
        O que impede de fechar
      </h3>
      <ul className="divide-y overflow-hidden rounded-lg border border-warning/40 bg-warning/10">
        {data.blockers.map((blocker) => {
          const text = describeBlocker(blocker, cycle)
          return (
            <li key={blocker} className="flex flex-col gap-2 px-4 py-3 text-sm">
              <div className="flex gap-2">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <div className="flex flex-col gap-1">
                  <p className="font-medium">{text.title}</p>
                  <p>{text.detail}</p>
                </div>
              </div>
              <BlockerExtra blocker={blocker} cycle={cycle} data={data} />
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function BlockerExtra({
  blocker,
  cycle,
  data,
}: {
  blocker: string
  cycle: PayCycleResponse
  data: PayCycleClosurePreviewResponse
}) {
  switch (blocker) {
    case 'LATE_MOVEMENTS':
      return <LateMovements codes={data.late_movement_codes} cycle={cycle} />
    case 'OVERDUE_PENDING_MOVEMENTS':
      return (
        <Link
          to={blockedMovementsLink(cycle, 'pendente')}
          className="min-h-6 w-fit font-medium text-primary underline-offset-4 hover:underline"
        >
          Ver as pendentes do ciclo
        </Link>
      )
    case 'PROJECTION_INCOMPLETE':
      return data.summary.pending.length > 0 ? (
        <ul className="list-disc pl-5">
          {data.summary.pending.map((item, index) => (
            <li key={index}>{describeSummaryPending(item)}</li>
          ))}
        </ul>
      ) : null
    default:
      return null
  }
}

/** The late movements the preview names (it only sends their codes), up to a few, and the way to the rest. */
function LateMovements({ codes, cycle }: { codes: readonly UUID[]; cycle: PayCycleResponse }) {
  const results = useMovementsByCode(codes, LATE_LISTED)
  const categories = useCategoryLookup()

  return (
    <div className="flex flex-col gap-2">
      {codes.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {results.map((result, index) => (
            <li key={codes[index]}>
              {result.isPending ? (
                <Skeleton className="h-16 w-full rounded-none" />
              ) : result.data ? (
                <MovementRow
                  movement={result.data}
                  category={
                    result.data.category_code
                      ? categories.get(result.data.category_code)
                      : undefined
                  }
                />
              ) : (
                <p className="px-4 py-3 text-muted-foreground">
                  Não foi possível carregar esta movimentação.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {codes.length > LATE_LISTED && (
        <p className="text-muted-foreground">e mais {codes.length - LATE_LISTED}</p>
      )}
      <Link
        to={blockedMovementsLink(cycle, 'atrasada')}
        className="min-h-6 w-fit font-medium text-primary underline-offset-4 hover:underline"
      >
        Ver as atrasadas do ciclo
      </Link>
    </div>
  )
}
