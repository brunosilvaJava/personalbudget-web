import { Banknote, Landmark, PiggyBank, Wallet, type LucideIcon } from 'lucide-react'

import type {
  AccountType,
  CardInvoiceState,
  CreditCardPlasticKind,
  CreditCardPlasticStatus,
} from '@/api/contracts'

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

export const INVOICE_STATE_LABEL: Record<CardInvoiceState, string> = {
  OPEN: 'Aberta',
  CLOSED: 'Fechada',
  PAID: 'Paga',
}

export const PLASTIC_KIND_LABEL: Record<CreditCardPlasticKind, string> = {
  PHYSICAL: 'Físico',
  VIRTUAL: 'Virtual',
  UNKNOWN: 'Não informado',
}

export const PLASTIC_STATUS_LABEL: Record<CreditCardPlasticStatus, string> = {
  ACTIVE: 'Ativo',
  REPLACED: 'Substituído',
  INACTIVE: 'Inativo',
}
