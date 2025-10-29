import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Wallet, Bell, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const menuItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: '📊',
    description: 'Visão geral',
  },
  {
    title: 'Movimentações',
    href: '/financial-movements',
    icon: '💸',
    description: 'Receitas e despesas',
  },
  {
    title: 'Contas Fixas',
    href: '/fixed-bills',
    icon: '📅',
    description: 'Recorrentes',
  },
  {
    title: 'Contas Parceladas',
    href: '/installment-bills',
    icon: '💳',
    description: 'Parcelamentos',
  },
];

const pageTitle: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/financial-movements': 'Movimentações',
  '/fixed-bills': 'Contas Fixas',
  '/installment-bills': 'Parceladas',
};

export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const currentTitle = pageTitle[location.pathname] || 'Personal Budget';

  return (
    <>
      {/* Header Bar */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
        {/* Menu Button */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0">
            <div className="flex h-full flex-col">
              {/* Logo */}
              <div className="flex h-14 items-center justify-between border-b px-4">
                <Link 
                  to="/dashboard" 
                  className="flex items-center gap-2"
                  onClick={() => setOpen(false)}
                >
                  <Wallet className="h-5 w-5 text-primary" />
                  <span className="text-lg font-bold">PersonalBudget</span>
                </Link>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Navigation */}
              <nav className="flex-1 space-y-1 p-3">
                {menuItems.map((item) => {
                  const isActive = location.pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all',
                        isActive 
                          ? 'bg-primary text-primary-foreground shadow-sm' 
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      <span className="text-2xl">{item.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium">{item.title}</div>
                        <div className="text-xs opacity-70">
                          {item.description}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </nav>

              {/* Footer */}
              <div className="border-t p-4">
                <div className="flex items-center gap-3 px-3 py-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Usuário</p>
                    <p className="text-xs text-muted-foreground">Versão 1.0.0</p>
                  </div>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Page Title */}
        <h1 className="text-lg font-semibold">{currentTitle}</h1>

        {/* Actions */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-600" />
        </Button>
      </header>
    </>
  );
}
