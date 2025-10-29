import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ArrowRightLeft, 
  Calendar, 
  CreditCard,
  BookOpen,
  ChevronRight,
  Wallet
} from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    description: 'Visão geral das finanças',
  },
  {
    title: 'Movimentações',
    href: '/financial-movements',
    icon: ArrowRightLeft,
    description: 'Receitas e despesas',
  },
  {
    title: 'Contas Fixas',
    href: '/fixed-bills',
    icon: Calendar,
    description: 'Contas recorrentes',
  },
  {
    title: 'Contas Parceladas',
    href: '/installment-bills',
    icon: CreditCard,
    description: 'Compras parceladas',
  },
  {
    title: 'Livro Caixa',
    href: '/cash-book',
    icon: BookOpen,
    description: 'Fluxo de caixa diário',
  },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 border-r bg-card/50 backdrop-blur-sm">
      <div className="flex h-full flex-col">
        {/* Logo/Brand */}
        <div className="flex h-16 items-center border-b px-6">
          <Link to="/dashboard" className="flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">PersonalBudget</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all hover:bg-accent',
                  isActive 
                    ? 'bg-accent text-accent-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className={cn(
                  'h-5 w-5 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                )} />
                <div className="flex-1">
                  <div className="font-medium">{item.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.description}
                  </div>
                </div>
                {isActive && (
                  <ChevronRight className="h-4 w-4 text-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t p-4">
          <div className="text-xs text-muted-foreground">
            <p className="font-medium">Personal Budget</p>
            <p className="mt-1">Versão 1.0.0</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
