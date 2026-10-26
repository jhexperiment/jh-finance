import { createBrowserRouter } from 'react-router-dom'
import { WorkspaceLayout } from '@/layouts/WorkspaceLayout'
import { OverviewPage } from '@/pages/overview/OverviewPage'
import { CardsPage } from '@/pages/cards/CardsPage'
import { CardDetailPage } from '@/pages/cards/CardDetailPage'
import { StatementsPage } from '@/pages/statements/StatementsPage'
import { BankDetailPage } from '@/pages/statements/BankDetailPage'
import { InvestmentsPage } from '@/pages/investments/InvestmentsPage'
import { InvestmentDetailPage } from '@/pages/investments/InvestmentDetailPage'
import { BillsPage } from '@/pages/bills/BillsPage'
import { UtilityDetailPage } from '@/pages/bills/UtilityDetailPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <WorkspaceLayout />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'cards', element: <CardsPage /> },
      { path: 'cards/:id', element: <CardDetailPage /> },
      { path: 'statements', element: <StatementsPage /> },
      { path: 'statements/:id', element: <BankDetailPage /> },
      { path: 'investments', element: <InvestmentsPage /> },
      { path: 'investments/:id', element: <InvestmentDetailPage /> },
      { path: 'bills', element: <BillsPage /> },
      { path: 'bills/:id', element: <UtilityDetailPage /> },
    ],
  },
])
