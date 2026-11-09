import {
  ArrowLeftRight,
  CalendarClock,
  CalendarRange,
  ChartLine,
  Ellipsis,
  HandCoins,
  House,
  PiggyBank,
  Telescope,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** exact match only (the home route would otherwise match every path) */
  end?: boolean
}

/** The bottom bar on the phone. "Contas" only means bank accounts (inside Carteira). */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Início', icon: House, end: true },
  { to: '/movimentacoes', label: 'Movimentações', icon: ArrowLeftRight },
  { to: '/carteira', label: 'Carteira', icon: Wallet },
  { to: '/mais', label: 'Mais', icon: Ellipsis },
]

/** What "Mais" lists on the phone; the sidebar shows them directly. Each phase adds its own. */
export const MORE_ITEMS: readonly NavItem[] = [
  { to: '/caixa', label: 'Caixa diário', icon: ChartLine },
  { to: '/recorrentes', label: 'Recorrentes', icon: CalendarClock },
  { to: '/receita', label: 'Receita', icon: HandCoins },
  { to: '/ciclos', label: 'Ciclos', icon: CalendarRange },
  { to: '/envelopes', label: 'Envelopes', icon: PiggyBank },
  { to: '/previsao', label: 'Previsão', icon: Telescope },
]
