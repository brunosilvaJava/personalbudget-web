import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { FinancialMovements } from '@/pages/FinancialMovements';
import { FixedBills } from '@/pages/FixedBills';
import { cn } from '@/lib/utils';

function Navigation() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="flex gap-4">
      <Link 
        to="/" 
        className={cn(
          "text-sm font-medium transition-colors",
          isActive('/') 
            ? "text-primary" 
            : "text-muted-foreground hover:text-primary"
        )}
      >
        Movimentações
      </Link>
      <Link 
        to="/fixed-bills" 
        className={cn(
          "text-sm font-medium transition-colors",
          isActive('/fixed-bills') 
            ? "text-primary" 
            : "text-muted-foreground hover:text-primary"
        )}
      >
        Contas Fixas
      </Link>
      <a 
        href="#" 
        className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
      >
        Dashboard
      </a>
      <a 
        href="#" 
        className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
      >
        Parceladas
      </a>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background">
        {/* Header Simples */}
        <header className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2">
                <span className="text-2xl">💰</span>
                <h1 className="text-xl font-bold">PersonalBudget</h1>
              </Link>
              <Navigation />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main>
          <Routes>
            <Route path="/" element={<FinancialMovements />} />
            <Route path="/fixed-bills" element={<FixedBills />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="border-t mt-16">
          <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
            PersonalBudget - Gestão Financeira Pessoal © 2025
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
