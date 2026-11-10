import { CreditCard, Pencil, Plus, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import type {
  CreditCardHolderResponse,
  CreditCardPlasticResponse,
  CreditCardResponse,
} from '@/api/contracts'
import { ErrorState } from '@/components/domain/ErrorState'
import { FormAlert } from '@/components/domain/FormAlert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage } from '@/lib/api-errors'
import { useOnline } from '@/lib/online'
import { HolderSheet } from './HolderSheet'
import { useHolders, usePlastics, useSetHolderActive } from './holderQueries'
import { PLASTIC_KIND_LABEL, PLASTIC_STATUS_LABEL } from './labels'
import { PlasticSheet } from './PlasticSheet'

/**
 * The people who use a card and the plastics (last 4 digits) each one carries. The TITULAR always
 * exists and cannot be inactivated; the additional holders share the card's limit.
 */
export function CardHoldersSection({ card }: { card: CreditCardResponse }) {
  const online = useOnline()
  const holders = useHolders(card.code)
  const plastics = usePlastics(card.code)
  const setActive = useSetHolderActive()
  const [holderSheet, setHolderSheet] = useState<{ holder?: CreditCardHolderResponse } | null>(null)
  const [plasticSheet, setPlasticSheet] = useState<{
    holderCode?: string
    plastic?: CreditCardPlasticResponse
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const active = card.status === 'ACTIVE'
  const activeHolders = (holders.data ?? []).filter((holder) => holder.status === 'ACTIVE')

  return (
    <section aria-labelledby="holders-title" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="holders-title" className="font-medium">
          Titulares e plásticos
        </h2>
        {active && holders.data && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-10"
              disabled={!online}
              onClick={() => setHolderSheet({})}
            >
              <UserPlus aria-hidden />
              Novo titular
            </Button>
            <Button
              variant="outline"
              className="h-10"
              disabled={!online || activeHolders.length === 0}
              onClick={() => setPlasticSheet({})}
            >
              <Plus aria-hidden />
              Novo plástico
            </Button>
          </div>
        )}
      </div>
      {error && <FormAlert message={error} />}
      {holders.isPending ? (
        <Skeleton className="h-20 w-full" />
      ) : holders.isError ? (
        <ErrorState error={holders.error} onRetry={() => void holders.refetch()} />
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {holders.data.map((holder) => {
            const own = (plastics.data ?? []).filter(
              (plastic) => plastic.holder_code === holder.code,
            )
            const titular = holder.kind === 'TITULAR'
            const holderActive = holder.status === 'ACTIVE'
            return (
              <li key={holder.code} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{holder.name}</span>
                  <Badge variant={titular ? 'outline' : 'muted'}>
                    {titular ? 'titular' : 'adicional'}
                  </Badge>
                  {!holderActive && <Badge variant="muted">inativo</Badge>}
                  <span className="ml-auto flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Renomear ${holder.name}`}
                      disabled={!online}
                      onClick={() => setHolderSheet({ holder })}
                    >
                      <Pencil aria-hidden />
                    </Button>
                    {!titular && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`${holderActive ? 'Inativar' : 'Ativar'} ${holder.name}`}
                        disabled={!online || setActive.isPending}
                        onClick={() =>
                          setActive
                            .mutateAsync({
                              cardCode: card.code,
                              holderCode: holder.code,
                              active: !holderActive,
                            })
                            .then(
                              () =>
                                toast.success(
                                  holderActive ? 'Titular inativado.' : 'Titular ativado.',
                                ),
                              (mutationError) => setError(errorMessage(mutationError)),
                            )
                        }
                      >
                        {holderActive ? 'Inativar' : 'Ativar'}
                      </Button>
                    )}
                  </span>
                </div>
                {own.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum plástico cadastrado.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {own.map((plastic) => (
                      <li key={plastic.code}>
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Editar plástico final ${plastic.last_digits}`}
                          disabled={!online}
                          onClick={() => setPlasticSheet({ plastic })}
                        >
                          <CreditCard aria-hidden />
                          final {plastic.last_digits} · {PLASTIC_KIND_LABEL[plastic.kind]}
                          {plastic.status !== 'ACTIVE' && (
                            <span className="text-muted-foreground">
                              {' '}
                              · {PLASTIC_STATUS_LABEL[plastic.status].toLowerCase()}
                            </span>
                          )}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <HolderSheet
        open={holderSheet !== null}
        onOpenChange={(open) => !open && setHolderSheet(null)}
        cardCode={card.code}
        holder={holderSheet?.holder}
      />
      <PlasticSheet
        open={plasticSheet !== null}
        onOpenChange={(open) => !open && setPlasticSheet(null)}
        cardCode={card.code}
        holders={activeHolders}
        holderCode={plasticSheet?.holderCode}
        plastic={plasticSheet?.plastic}
      />
    </section>
  )
}
