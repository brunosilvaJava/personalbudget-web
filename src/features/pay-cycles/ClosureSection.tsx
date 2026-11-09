import { Lock, LockOpen } from 'lucide-react'
import { useState } from 'react'

import type { PayCycleResponse } from '@/api/contracts'
import { ConfirmDialog } from '@/components/domain/ConfirmDialog'
import { FormAlert } from '@/components/domain/FormAlert'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'
import { useOnline } from '@/lib/online'
import { closureErrorMessage, closureOffer } from './closure'
import { ClosureSheet } from './ClosureSheet'
import { usePayCycleConfig, useReopenCycle } from './queries'
import { SnapshotHistory } from './SnapshotHistory'

/**
 * Closing a cycle and what it leaves behind: the review (before it ends, to see what is missing;
 * after, to close it), the frozen report once closed, and the way back. The sheet and the dialog
 * live here, above the parts that change shape when the status does.
 */
export function ClosureSection({ cycle }: { cycle: PayCycleResponse }) {
  const config = usePayCycleConfig()
  const online = useOnline()
  const reopen = useReopenCycle()
  const [reviewing, setReviewing] = useState(false)
  const [reopening, setReopening] = useState(false)
  const offer = closureOffer(cycle)
  const cyclesOn = config.data?.mode === 'PAY_CYCLE'

  return (
    <section aria-labelledby="closure-title" className="flex flex-col gap-3">
      <h2 id="closure-title" className="font-medium">
        Fechamento
      </h2>

      {offer === 'none' && (
        <p className="text-sm text-muted-foreground">
          {cycle.status === 'CANCELLED'
            ? 'Este ciclo foi cancelado e não é fechado.'
            : 'Este ciclo ainda não começou.'}
        </p>
      )}

      {offer === 'review' && (
        <>
          <p className="text-sm text-muted-foreground">
            O ciclo vai até {formatDate(cycle.last_day)}. Só dá para fechá-lo depois disso. Antes,
            dá para ver o que ainda falta.
          </p>
          {cyclesOn && (
            <Button
              variant="outline"
              className="h-11 self-start"
              onClick={() => setReviewing(true)}
            >
              <Lock aria-hidden />
              Ver o que falta para fechar
            </Button>
          )}
        </>
      )}

      {offer === 'close' && (
        <>
          <p className="text-sm text-muted-foreground">
            O ciclo terminou e espera o fechamento. Fechar congela o relatório por competência e
            protege as movimentações dele de alterações.
          </p>
          {cyclesOn && (
            <Button className="h-11 self-start" onClick={() => setReviewing(true)}>
              <Lock aria-hidden />
              Fechar o ciclo
            </Button>
          )}
        </>
      )}

      {offer === 'closed' && (
        <>
          <p className="text-sm text-muted-foreground">
            Este ciclo está fechado. Enquanto ele estiver assim, as movimentações dele não podem ser
            criadas nem excluídas, e valor, categoria e competência ficam travados. Pagar e estornar
            continuam livres.
          </p>
          {reopen.isError && <FormAlert message={closureErrorMessage(reopen.error)} />}
          {cyclesOn && (
            <Button
              variant="outline"
              className="h-11 self-start"
              onClick={() => {
                reopen.reset()
                setReopening(true)
              }}
            >
              <LockOpen aria-hidden />
              Reabrir o ciclo
            </Button>
          )}
        </>
      )}

      {offer !== 'none' && <SnapshotHistory cycle={cycle} />}

      <ClosureSheet open={reviewing} onOpenChange={setReviewing} cycle={cycle} />
      <ConfirmDialog
        open={reopening}
        onOpenChange={setReopening}
        title={`Reabrir ${cycle.label}?`}
        description="As movimentações do ciclo voltam a poder ser alteradas. O fechamento atual fica guardado no histórico, e fechar de novo cria uma nova versão."
        confirmLabel="Reabrir"
        pending={reopen.isPending}
        // The version is only null in a preview, never in a cycle read from the back.
        disabled={!online || cycle.version === null}
        onConfirm={() => {
          if (cycle.version === null) return
          // mutateAsync, not mutate: the reopened cycle changes this section before the answer is
          // handled. The error shows from `reopen.error`, above the button.
          void reopen.mutateAsync({ code: cycle.code, expectedVersion: cycle.version }).then(
            () => setReopening(false),
            () => setReopening(false),
          )
        }}
      />
    </section>
  )
}
