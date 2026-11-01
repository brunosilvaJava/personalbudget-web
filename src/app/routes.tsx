import { Navigate, type RouteObject } from 'react-router'

import { AppShell } from '@/components/layout/AppShell'
import { AccountsLayout } from '@/features/accounts/AccountsLayout'
import { DailyBalancePage } from '@/features/daily-balance/DailyBalancePage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { FixedBillsPage } from '@/features/fixed-bills/FixedBillsPage'
import { InstallmentBillsPage } from '@/features/installment-bills/InstallmentBillsPage'
import { MovementsPage } from '@/features/movements/MovementsPage'
import { NotFoundPage } from '@/features/system/NotFoundPage'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'caixa', element: <DailyBalancePage /> },
      { path: 'movimentacoes', element: <MovementsPage /> },
      {
        path: 'contas',
        element: <AccountsLayout />,
        children: [
          { index: true, element: <Navigate to="fixas" replace /> },
          { path: 'fixas', element: <FixedBillsPage /> },
          { path: 'parceladas', element: <InstallmentBillsPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
