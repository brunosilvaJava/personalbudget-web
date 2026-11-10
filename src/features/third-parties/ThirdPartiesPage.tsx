import { Pencil, Plus, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import type { ThirdPartyResponse } from '@/api/contracts'
import { EmptyState } from '@/components/domain/EmptyState'
import { FormAlert } from '@/components/domain/FormAlert'
import { LoadError } from '@/components/domain/LoadError'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage } from '@/lib/api-errors'
import { formatMoney } from '@/lib/format'
import { useOnline } from '@/lib/online'
import { useAllThirdParties, useSetThirdPartyActive } from './queries'
import { ThirdPartySheet } from './ThirdPartySheet'

/** People who use the card and owe what they spent. The amounts are what is still to receive. */
export function ThirdPartiesPage() {
  const online = useOnline()
  const parties = useAllThirdParties()
  const setActive = useSetThirdPartyActive()
  const [sheet, setSheet] = useState<{ thirdParty?: ThirdPartyResponse } | null>(null)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button className="h-11" onClick={() => setSheet({})} disabled={!online}>
          <Plus aria-hidden />
          Novo terceiro
        </Button>
      </div>
      {error && <FormAlert message={error} />}
      {parties.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : parties.isError ? (
        <LoadError error={parties.error} onRetry={() => void parties.refetch()} />
      ) : parties.data.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum terceiro ainda"
          description="Cadastre quem usa o seu cartão para separar o que é dele do que é seu."
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {parties.data.map((party) => {
            const active = party.status === 'ACTIVE'
            return (
              <li key={party.code} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Link
                  to={`/carteira/terceiros/${party.code}`}
                  className="min-w-0 flex-1 rounded-md transition-colors hover:bg-accent/60"
                >
                  <p className="flex items-center gap-2 font-medium">
                    {party.name}
                    {!active && <Badge variant="muted">inativo</Badge>}
                  </p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {party.open_count === 0
                      ? 'Nada a receber'
                      : `A receber ${formatMoney(party.open_amount)}`}
                    {party.late_amount > 0 && ` · ${formatMoney(party.late_amount)} atrasado`}
                  </p>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Renomear ${party.name}`}
                  disabled={!online}
                  onClick={() => setSheet({ thirdParty: party })}
                >
                  <Pencil aria-hidden />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`${active ? 'Inativar' : 'Ativar'} ${party.name}`}
                  disabled={!online || setActive.isPending}
                  onClick={() =>
                    setActive.mutateAsync({ code: party.code, active: !active }).then(
                      () => {
                        setError(null)
                        toast.success(active ? 'Terceiro inativado.' : 'Terceiro ativado.')
                      },
                      (mutationError) => setError(errorMessage(mutationError)),
                    )
                  }
                >
                  {active ? 'Inativar' : 'Ativar'}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      <ThirdPartySheet
        open={sheet !== null}
        onOpenChange={(open) => !open && setSheet(null)}
        thirdParty={sheet?.thirdParty}
      />
    </div>
  )
}
