import { MapPinOff } from 'lucide-react'
import { Link } from 'react-router'

import { EmptyState } from '@/components/domain/EmptyState'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <EmptyState
      icon={MapPinOff}
      title="Página não encontrada"
      description="O endereço não existe neste app."
      action={
        <Button asChild variant="outline" className="h-11">
          <Link to="/">Voltar ao início</Link>
        </Button>
      }
    />
  )
}
