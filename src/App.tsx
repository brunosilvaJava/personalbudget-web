import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
//import { Dashboard } from '@/pages/Dashboard';
import { FinancialMovements } from '@/pages/FinancialMovements';
import { FixedBills } from '@/pages/FixedBills';
import { InstallmentBills } from '@/pages/InstallmentBills';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="financial-movements" element={<FinancialMovements />} />
            <Route path="fixed-bills" element={<FixedBills />} />
            <Route path="installment-bills" element={<InstallmentBills />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
