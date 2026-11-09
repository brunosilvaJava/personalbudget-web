import { Navigate, type RouteObject } from 'react-router'

import { DailyBalancePage } from '@/features/daily-balance/DailyBalancePage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { FixedBillsPage } from '@/features/fixed-bills/FixedBillsPage'
import { HolidayCalendarPage } from '@/features/income/HolidayCalendarPage'
import { IncomeLayout } from '@/features/income/IncomeLayout'
import { IncomeSchedulePage } from '@/features/income/IncomeSchedulePage'
import { IncomeSchedulesPage } from '@/features/income/IncomeSchedulesPage'
import { InstallmentBillsPage } from '@/features/installment-bills/InstallmentBillsPage'
import { MorePage } from '@/features/more/MorePage'
import { MovementsPage } from '@/features/movements/MovementsPage'
import { RecurringLayout } from '@/features/recurring/RecurringLayout'
import { NotFoundPage } from '@/features/system/NotFoundPage'
import { AccountsPage } from '@/features/wallet/AccountsPage'
import { AccountStatementPage } from '@/features/wallet/AccountStatementPage'
import { CardPage } from '@/features/wallet/CardPage'
import { CardsPage } from '@/features/wallet/CardsPage'
import { InvoicePage } from '@/features/wallet/InvoicePage'
import { TransfersPage } from '@/features/wallet/TransfersPage'
import { WalletLayout } from '@/features/wallet/WalletLayout'
import { AppLayout } from './AppLayout'
import { LegacyRecurringRedirect } from './LegacyRecurringRedirect'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'caixa', element: <DailyBalancePage /> },
      { path: 'movimentacoes', element: <MovementsPage /> },
      {
        path: 'carteira',
        element: <WalletLayout />,
        children: [
          { index: true, element: <Navigate to="contas" replace /> },
          { path: 'contas', element: <AccountsPage /> },
          { path: 'cartoes', element: <CardsPage /> },
          { path: 'transferencias', element: <TransfersPage /> },
        ],
      },
      { path: 'carteira/contas/:code', element: <AccountStatementPage /> },
      { path: 'carteira/cartoes/:code', element: <CardPage /> },
      { path: 'carteira/faturas/:code', element: <InvoicePage /> },
      {
        path: 'recorrentes',
        element: <RecurringLayout />,
        children: [
          { index: true, element: <Navigate to="fixas" replace /> },
          { path: 'fixas', element: <FixedBillsPage /> },
          { path: 'parceladas', element: <InstallmentBillsPage /> },
        ],
      },
      {
        path: 'receita',
        element: <IncomeLayout />,
        children: [
          { index: true, element: <Navigate to="agenda" replace /> },
          { path: 'agenda', element: <IncomeSchedulesPage /> },
          { path: 'calendario', element: <HolidayCalendarPage /> },
        ],
      },
      { path: 'receita/agenda/:code', element: <IncomeSchedulePage /> },
      { path: 'contas/*', element: <LegacyRecurringRedirect /> },
      { path: 'mais', element: <MorePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
