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
import { AccountFormPage } from '@/pages/accounts/AccountFormPage'
import { BillFormPage } from '@/pages/bills/BillFormPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <WorkspaceLayout />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'cards', element: <CardsPage /> },
      { path: 'cards/new', element: <AccountFormPage section="cards" /> },
      { path: 'cards/:id/edit', element: <AccountFormPage section="cards" /> },
      { path: 'cards/:id', element: <CardDetailPage /> },
      { path: 'statements', element: <StatementsPage /> },
      { path: 'statements/new', element: <AccountFormPage section="statements" /> },
      { path: 'statements/:id/edit', element: <AccountFormPage section="statements" /> },
      { path: 'statements/:id', element: <BankDetailPage /> },
      { path: 'investments', element: <InvestmentsPage /> },
      { path: 'investments/new', element: <AccountFormPage section="investments" /> },
      { path: 'investments/:id/edit', element: <AccountFormPage section="investments" /> },
      { path: 'investments/:id', element: <InvestmentDetailPage /> },
      { path: 'bills', element: <BillsPage /> },
      { path: 'bills/new', element: <BillFormPage /> },
      { path: 'bills/:id/edit', element: <BillFormPage /> },
      { path: 'bills/:id', element: <UtilityDetailPage /> },
    ],
  },
])
