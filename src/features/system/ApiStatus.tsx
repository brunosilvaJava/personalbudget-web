import { CircleAlert, CircleCheck, LoaderCircle, RotateCw } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { useApiHealth } from './queries'

/** Phase 0 check: shows whether the phone reaches the API through the front-end's proxy. */
export function ApiStatus() {
  const { data, error, isPending, isFetching, refetch } = useApiHealth()

  if (isPending) {
    return (
      <StatusRow icon={<LoaderCircle className="size-5 animate-spin text-muted-foreground" />}>
        Verificando a API…
      </StatusRow>
    )
  }

  if (error || data.status !== 'UP') {
    return (
      <StatusRow
        icon={<CircleAlert className="size-5 text-warning" />}
        action={
          <Button
            variant="outline"
            size="sm"
            className="h-10"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <RotateCw className={isFetching ? 'animate-spin' : undefined} aria-hidden />
            Tentar de novo
          </Button>
        }
      >
        <span className="font-medium">API fora do ar</span>
        <span className="block text-muted-foreground">
          {error ? error.message : `A API respondeu com status ${data.status}.`}
        </span>
      </StatusRow>
    )
  }

  return (
    <StatusRow icon={<CircleCheck className="size-5 text-income" />}>
      <span className="font-medium">API conectada</span>
    </StatusRow>
  )
}

function StatusRow({
  icon,
  action,
  children,
}: {
  icon: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-3 rounded-lg border bg-card p-4 text-sm"
    >
      <span aria-hidden className="self-start">
        {icon}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="w-full pl-8 sm:w-auto sm:pl-0">{action}</div>}
    </div>
  )
}
