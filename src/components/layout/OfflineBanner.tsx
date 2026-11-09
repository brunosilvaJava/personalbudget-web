import { WifiOff } from 'lucide-react'

import { useOnline } from '@/lib/online'

/** Notice at the top while the device is offline. Saving is disabled meanwhile. */
export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div
      role="status"
      className="sticky top-0 z-30 flex items-center justify-center gap-2 bg-warning px-4 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-sm font-medium text-background"
    >
      <WifiOff className="size-4" aria-hidden />
      Sem conexão. Nada pode ser gravado até a conexão voltar.
    </div>
  )
}
