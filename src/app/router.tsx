import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout.tsx';
import { DashboardView } from '../modules/dashboard/DashboardView.tsx';
import { PurchasesView } from '../modules/purchases/PurchasesView.tsx';
import { CollectionsView } from '../modules/collections/CollectionsView.tsx';
import { WeighmentView } from '../modules/weighment/WeighmentView.tsx';
import { InventoryView } from '../modules/inventory/InventoryView.tsx';
import { SalesView } from '../modules/sales/SalesView.tsx';
import { InvoicesView } from '../modules/invoices/InvoicesView.tsx';
import { CommercialDocumentsView } from '../modules/documents/CommercialDocumentsView.tsx';
import { PartiesView } from '../modules/parties/PartiesView.tsx';
import { PaymentsView } from '../modules/payments/PaymentsView.tsx';
import { FinanceView } from '../modules/finance/FinanceView.tsx';
import { VehiclesView } from '../modules/vehicles/VehiclesView.tsx';
import { EmployeesView } from '../modules/employees/EmployeesView.tsx';
import { ReportsView } from '../modules/reports/ReportsView.tsx';
import { SettingsView } from '../modules/settings/SettingsView.tsx';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardView /> },
      { path: 'purchases', element: <PurchasesView /> },
      { path: 'collections', element: <CollectionsView /> },
      { path: 'weighment', element: <WeighmentView /> },
      { path: 'inventory', element: <InventoryView /> },
      { path: 'sales', element: <SalesView /> },
      { path: 'invoices', element: <InvoicesView /> },
      { path: 'documents', element: <CommercialDocumentsView /> },
      { path: 'parties', element: <PartiesView /> },
      { path: 'payments', element: <PaymentsView /> },
      { path: 'finance', element: <FinanceView /> },
      { path: 'accounts', element: <FinanceView /> },
      { path: 'vehicles', element: <VehiclesView /> },
      { path: 'employees', element: <EmployeesView /> },
      { path: 'reports', element: <ReportsView /> },
      { path: 'settings', element: <SettingsView /> },
    ],
  },
]);
