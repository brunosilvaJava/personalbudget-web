import { Banknote, Landmark, PiggyBank, Wallet, type LucideIcon } from 'lucide-react'

import type { AccountType } from '@/api/contracts'

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  CHECKING: 'Conta corrente',
  CASH: 'Dinheiro',
  SAVINGS: 'Poupança',
  OTHER: 'Outra',
}

export const ACCOUNT_TYPE_ICON: Record<AccountType, LucideIcon> = {
  CHECKING: Landmark,
  CASH: Banknote,
  SAVINGS: PiggyBank,
  OTHER: Wallet,
}
