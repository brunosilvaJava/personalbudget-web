import { useState, useMemo } from 'react';
import { BookOpen } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BalanceFilters } from '@/components/balance/BalanceFilters';
import { CashBookTable } from '@/components/balance/CashBookTable';
import { useDailyBalance, useDailyBalanceForDate } from '@/hooks/useBalance';
import { getErrorMessage } from '@/api/client';
import { getTodayString, formatDate } from '@/lib/date-utils';
import type { BalanceFilters as Filters, BalanceSummary } from '@/types/balance';

export function CashBook() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const [filters, setFilters] = useState<Filters>({
    initialDate: thirtyDaysAgo.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0],
  });

  const { data, isLoading, error } = useDailyBalance(filters);

  const currentDateStr = getTodayString();

  // Verificar se hoje está no período
  const isCurrentDateInPeriod = useMemo(() => {
    if (!data) return false;
    return data.some(day => day.date === currentDateStr);
  }, [data, currentDateStr]);

  // Buscar saldo de hoje SEMPRE quando não estiver no período
  const shouldFetchCurrentDay = !isCurrentDateInPeriod && !!data && data.length > 0;
  
  const { data: currentDayBalance, isLoading: isLoadingCurrentDay } = useDailyBalanceForDate(
    currentDateStr,
    shouldFetchCurrentDay
  );

  const summary: BalanceSummary = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalDays: 0,
        openingBalance: 0,
        totalRevenue: 0,
        totalExpense: 0,
        closingBalance: 0,
        projectedClosingBalance: 0,
        netChange: 0,
        currentBalance: 0,
        currentProjectedBalance: 0,
        currentDate: currentDateStr,
        isCurrentDateInPeriod: false,
      };
    }

    const totalRevenue = data.reduce((sum, day) => sum + day.balance.totalRevenue, 0);
    const totalExpense = data.reduce((sum, day) => sum + day.balance.totalExpense, 0);
    const openingBalance = data[0]?.balance.opening || 0;
    const closingBalance = data[data.length - 1]?.balance.closing || 0;
    const projectedClosingBalance = data[data.length - 1]?.projected.closing || 0;

    // Buscar saldo atual corretamente
    let currentBalance: number;
    let currentProjectedBalance: number;

    if (isCurrentDateInPeriod) {
      // Hoje está no período, busca dos dados
      const currentDayData = data.find(day => day.date === currentDateStr);
      currentBalance = currentDayData?.balance.closing || 0;
      currentProjectedBalance = currentDayData?.projected.closing || 0;
      
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Hoje no período:', {
          date: currentDateStr,
          currentBalance,
          currentProjectedBalance,
        });
      }
    } else {
      // Hoje NÃO está no período
      if (currentDayBalance) {
        // Tem dados da requisição separada
        currentBalance = currentDayBalance.balance.closing;
        currentProjectedBalance = currentDayBalance.projected.closing;
        
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Hoje fora do período (busca separada):', {
            date: currentDateStr,
            currentBalance,
            currentProjectedBalance,
            source: 'API separada',
          });
        }
      } else {
        // Fallback: Se não conseguiu buscar hoje, tenta inferir
        const todayDate = new Date(currentDateStr);
        const periodEnd = new Date(data[data.length - 1].date);
        
        if (todayDate > periodEnd) {
          // Hoje é DEPOIS do período: usa o saldo final do período
          currentBalance = closingBalance;
          currentProjectedBalance = projectedClosingBalance;
          
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Hoje após período (fallback):', {
              today: currentDateStr,
              periodEnd: data[data.length - 1].date,
              currentBalance,
            });
          }
        } else {
          // Hoje é ANTES do período: assume 0 ou busca do backend
          currentBalance = 0;
          currentProjectedBalance = 0;
          
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Hoje antes do período (fallback zero):', {
              today: currentDateStr,
              periodStart: data[0].date,
            });
          }
        }
      }
    }

    const netChange = closingBalance - openingBalance;

    return {
      totalDays: data.length,
      openingBalance,
      totalRevenue,
      totalExpense,
      closingBalance,
      projectedClosingBalance,
      netChange,
      currentBalance,
      currentProjectedBalance,
      currentDate: currentDateStr,
      isCurrentDateInPeriod,
    };
  }, [data, currentDateStr, isCurrentDateInPeriod, currentDayBalance]);

  const handleExport = () => {
    if (!data) return;

    const headers = [
      'Data',
      'Saldo Inicial',
      'Entradas',
      'Saídas',
      'Saldo Final',
      'Pendente (+)',
      'Pendente (-)',
      'Saldo Projetado',
    ];

    const rows = data.map((day) => [
      formatDate(day.date),
      day.balance.opening.toFixed(2),
      day.balance.totalRevenue.toFixed(2),
      day.balance.totalExpense.toFixed(2),
      day.balance.closing.toFixed(2),
      day.projected.pendingTotalRevenue.toFixed(2),
      day.projected.pendingTotalExpense.toFixed(2),
      day.projected.closing.toFixed(2),
    ]);

    rows.push([
      `TOTAL (${summary.totalDays} dias)`,
      summary.openingBalance.toFixed(2),
      summary.totalRevenue.toFixed(2),
      summary.totalExpense.toFixed(2),
      summary.closingBalance.toFixed(2),
      '',
      '',
      summary.projectedClosingBalance.toFixed(2),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(';')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `livro-caixa-${filters.initialDate}-${filters.endDate}.csv`;
    link.click();
  };

  const isLoadingData = isLoading || (isLoadingCurrentDay && shouldFetchCurrentDay);

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            Livro Caixa
          </h1>
          <p className="text-muted-foreground mt-2">
            Controle detalhado do fluxo de caixa com saldo realizado e projetado
          </p>
        </div>
      </div>

      <BalanceFilters
        filters={filters}
        onFiltersChange={setFilters}
        onExport={handleExport}
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{getErrorMessage(error)}</AlertDescription>
        </Alert>
      )}

      {isLoadingData && (
        <div className="text-center py-10">
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      )}

      {!isLoadingData && data && (
        <CashBookTable data={data} summary={summary} />
      )}
    </div>
  );
}