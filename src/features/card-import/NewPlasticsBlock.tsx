import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import type { CreditCardHolderResponse, CreditCardResponse, UUID } from '@/api/contracts'
import { FormAlert } from '@/components/domain/FormAlert'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreatePlastic } from '@/features/wallet/holderQueries'
import { errorMessage } from '@/lib/api-errors'
import { useOnline } from '@/lib/online'
import { guessHolder, type NewPlastic } from './plastics'

/**
 * Plastics in the file that the card does not know: each one needs a holder before the import, because
 * the API refuses a purchase made with a plastic that does not exist.
 */
export function NewPlasticsBlock({
  card,
  plastics,
  holders,
}: {
  card: CreditCardResponse
  plastics: NewPlastic[]
  holders: CreditCardHolderResponse[]
}) {
  const online = useOnline()
  const create = useCreatePlastic()
  const [chosen, setChosen] = useState<Record<string, UUID>>({})
  const [error, setError] = useState<string | null>(null)

  const holderOf = (plastic: NewPlastic) =>
    chosen[plastic.lastDigits] ?? guessHolder(plastic, holders)

  async function registerAll() {
    setError(null)
    for (const plastic of plastics) {
      const holderCode = holderOf(plastic)
      if (!holderCode) continue
      try {
        await create.mutateAsync({
          cardCode: card.code,
          body: { holder_code: holderCode, last_digits: plastic.lastDigits },
        })
      } catch (mutationError) {
        setError(`Final ${plastic.lastDigits}: ${errorMessage(mutationError)}`)
        return
      }
    }
    toast.success(plastics.length === 1 ? 'Plástico cadastrado.' : 'Plásticos cadastrados.')
  }

  return (
    <section
      aria-labelledby="new-plastics-title"
      className="flex flex-col gap-3 rounded-lg border border-warning/50 bg-warning/10 p-4"
    >
      <div>
        <h2 id="new-plastics-title" className="font-medium">
          Plásticos que o cartão ainda não tem
        </h2>
        <p className="text-sm text-muted-foreground">
          Escolha de quem é cada um. Sem cadastrá-los, a importação não segue.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {plastics.map((plastic) => (
          <li key={plastic.lastDigits} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="min-w-0 flex-1">
              final <strong>{plastic.lastDigits}</strong> · {plastic.count}{' '}
              {plastic.count === 1 ? 'compra' : 'compras'}
              {plastic.names.length > 0 && ` · ${plastic.names.join(', ')}`}
            </span>
            <Select
              value={holderOf(plastic) ?? ''}
              onValueChange={(value) =>
                setChosen((current) => ({ ...current, [plastic.lastDigits]: value }))
              }
            >
              <SelectTrigger
                className="w-48"
                aria-label={`Titular do plástico final ${plastic.lastDigits}`}
              >
                <SelectValue placeholder="Titular" />
              </SelectTrigger>
              <SelectContent>
                {holders.map((holder) => (
                  <SelectItem key={holder.code} value={holder.code}>
                    {holder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </li>
        ))}
      </ul>
      {error && <FormAlert message={error} />}
      <Button
        className="h-11 self-start"
        onClick={() => void registerAll()}
        disabled={!online || create.isPending}
      >
        {create.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
        Cadastrar {plastics.length === 1 ? 'plástico' : 'plásticos'}
      </Button>
    </section>
  )
}
