import type { PayCycleConfigResponse } from '@/api/contracts'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { JustifiedConfirm } from './JustifiedConfirm'
import { useDeactivatePayCycles } from './queries'

interface DeactivationSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: PayCycleConfigResponse
}

/** Turns the cycles off. It asks why, because the reason goes to the history of the cycles. */
export function DeactivationSheet({ open, onOpenChange, config }: DeactivationSheetProps) {
  const deactivate = useDeactivatePayCycles()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Desligar os ciclos</SheetTitle>
          <SheetDescription>Os relatórios voltam a seguir o mês do calendário.</SheetDescription>
        </SheetHeader>
        {open && (
          <JustifiedConfirm
            confirmLabel="Desligar os ciclos"
            destructive
            pending={deactivate.isPending}
            error={deactivate.error}
            onConfirm={(justification) =>
              // mutateAsync, not mutate: turning the cycles off takes this sheet off the screen
              // before the answer is handled. The error shows from `deactivate.error`.
              void deactivate.mutateAsync({ expected_version: config.version, justification }).then(
                () => onOpenChange(false),
                () => undefined,
              )
            }
          >
            <ul className="list-disc pl-5 text-sm">
              <li>Os ciclos que ainda não começaram são cancelados.</li>
              <li>Os que já começaram ficam como histórico.</li>
              <li>Dá para ligar de novo, a partir do fim do último ciclo que existir.</li>
            </ul>
          </JustifiedConfirm>
        )}
      </SheetContent>
    </Sheet>
  )
}
