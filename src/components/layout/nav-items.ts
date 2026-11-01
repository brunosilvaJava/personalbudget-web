import { ArrowLeftRight, CalendarClock, ChartLine, House, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** exact match only (the home route would otherwise match every path) */
  end?: boolean
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Início', icon: House, end: true },
  { to: '/caixa', label: 'Caixa', icon: ChartLine },
  { to: '/movimentacoes', label: 'Movimentações', icon: ArrowLeftRight },
  { to: '/contas', label: 'Contas', icon: CalendarClock },
]

/** Where "Lançar" goes. Phase 1 opens the quick entry sheet there. */
export const LAUNCH_PATH = '/movimentacoes?lancar=1'
