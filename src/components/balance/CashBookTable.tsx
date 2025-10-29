import { Calendar, TrendingUp, TrendingDown, DollarSign, Wallet, Clock, AlertTriangle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatDateWithWeekday, formatDate } from '@/lib/date-utils';
import type { DailyBalance, BalanceSummary } from '@/types/balance';

interface Props {
  data: DailyBalance[];
  summary: BalanceSummary;
}

export function CashBookTable({ data, summary }: Props) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getBalanceColor = (value: number) => {
    if (value > 0) return 'text-green-600 dark:text-green-400';
    if (value < 0) return 'text-red-600 dark:text-red-400';
    return 'text-muted-foreground';
  };

  const getBgBalanceColor = (value: number) => {
    if (value > 0) return 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900';
    if (value < 0) return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900';
    return 'bg-muted/20';
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p>Nenhum dado encontrado para o período selecionado.</p>
      </div>
    );
  }

  const percentageChange = summary.openingBalance !== 0 
    ? ((summary.netChange / summary.openingBalance) * 100) 
    : 0;

  const currentChange = summary.currentBalance - summary.openingBalance;
  const currentPercentageChange = summary.openingBalance !== 0 
    ? ((currentChange / Math.abs(summary.openingBalance)) * 100) 
    : (summary.currentBalance !== 0 ? Infinity : 0);

  // Verificar se saldo projetado é negativo
  const isProjectedNegative = summary.projectedClosingBalance < 0;
  const projectedDeficit = Math.abs(summary.projectedClosingBalance);

  // Calcular quanto falta para zerar (se negativo)
  const amountToRecover = isProjectedNegative 
    ? projectedDeficit + Math.abs(summary.closingBalance)
    : 0;

  return (
    <div className="space-y-4">

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        
        {/* Card de Saldo Atual */}
        <div className={cn(
          "rounded-lg border p-6 md:col-span-2",
          getBgBalanceColor(summary.currentBalance)
        )}>
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                <p className="text-sm font-medium">Saldo Atual</p>
                <Badge variant="outline" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  Hoje
                </Badge>
              </div>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <p className={cn(
                        "text-4xl font-bold",
                        getBalanceColor(summary.currentBalance)
                      )}>
                        {formatCurrency(summary.currentBalance)}
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <div className="space-y-2">
                      <p className="font-semibold text-sm border-b pb-1">
                        Saldo de Hoje ({formatDate(summary.currentDate)})
                      </p>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Saldo inicial do período:</span>
                          <span className="font-medium">{formatCurrency(summary.openingBalance)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Variação até hoje:</span>
                          <span className={cn("font-medium", getBalanceColor(currentChange))}>
                            {currentChange >= 0 ? '+' : ''}{formatCurrency(currentChange)}
                          </span>
                        </div>
                        <div className="flex justify-between border-t pt-1 mt-1">
                          <span className="font-semibold">Saldo atual:</span>
                          <span className={cn("font-bold", getBalanceColor(summary.currentBalance))}>
                            {formatCurrency(summary.currentBalance)}
                          </span>
                        </div>
                        {!summary.isCurrentDateInPeriod && (
                          <p className="text-yellow-600 text-xs mt-1">
                            ⚠️ Data atual fora do período filtrado
                          </p>
                        )}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <div className="flex items-center gap-2 mt-2">
                <Badge 
                  variant={currentChange >= 0 ? "default" : "destructive"}
                  className="text-xs"
                >
                  {currentChange >= 0 ? '+' : ''}
                  {formatCurrency(currentChange)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {currentPercentageChange >= 0 ? '+' : ''}
                  {currentPercentageChange.toFixed(2)}% desde início
                </span>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">Projetado</p>
              
              {/* Destaque se negativo */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <p className={cn(
                        "text-xl font-semibold",
                        getBalanceColor(summary.currentProjectedBalance),
                        summary.currentProjectedBalance < 0 && "animate-pulse"
                      )}>
                        {formatCurrency(summary.currentProjectedBalance)}
                        {summary.currentProjectedBalance < 0 && (
                          <AlertTriangle className="inline-block h-4 w-4 ml-1" />
                        )}
                      </p>
                    </div>
                  </TooltipTrigger>
                  {summary.currentProjectedBalance < 0 && (
                    <TooltipContent side="left" className="bg-red-100 dark:bg-red-950 border-red-300">
                      <p className="text-sm font-semibold text-red-900 dark:text-red-100">
                        ⚠️ Saldo projetado negativo!
                      </p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
              
              {summary.currentProjectedBalance !== summary.currentBalance && (
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.currentProjectedBalance > summary.currentBalance ? '+' : ''}
                  {formatCurrency(summary.currentProjectedBalance - summary.currentBalance)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Card de Saldo Final do Período - DESTAQUE SE NEGATIVO */}
        <div className={cn(
          "rounded-lg border p-4",
          isProjectedNegative && "border-red-500 border-2 shadow-lg"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-muted-foreground">Saldo Final do Período</p>
              {isProjectedNegative && (
                <AlertTriangle className="h-4 w-4 text-red-600 animate-pulse" />
              )}
            </div>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className={cn("text-2xl font-bold mt-2", getBalanceColor(summary.closingBalance))}>
            {formatCurrency(summary.closingBalance)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDate(data[data.length - 1]?.date)}
          </p>
          
          {/* Projetado com destaque */}
          <div className={cn(
            "mt-2 p-2 rounded",
            isProjectedNegative ? "bg-red-100 dark:bg-red-950/30" : "bg-muted/50"
          )}>
            <p className="text-xs font-medium">Projetado:</p>
            <p className={cn(
              "text-lg font-bold",
              getBalanceColor(summary.projectedClosingBalance)
            )}>
              {formatCurrency(summary.projectedClosingBalance)}
              {isProjectedNegative && (
                <span className="text-xs ml-2 text-red-600">DÉFICIT</span>
              )}
            </p>
          </div>
        </div>

        {/* Saldo Inicial */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Saldo Inicial</p>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold mt-2">{formatCurrency(summary.openingBalance)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDate(data[0]?.date)}
          </p>
        </div>

        {/* Total Receitas */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Total Receitas</p>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </div>
          <p className="text-2xl font-bold mt-2 text-green-600">
            {formatCurrency(summary.totalRevenue)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {summary.totalDays} {summary.totalDays === 1 ? 'dia' : 'dias'}
          </p>
        </div>

        {/* Total Despesas */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Total Despesas</p>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </div>
          <p className="text-2xl font-bold mt-2 text-red-600">
            {formatCurrency(summary.totalExpense)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Média: {formatCurrency(summary.totalExpense / summary.totalDays)}/dia
          </p>
        </div>
      </div>

      {/* Tabela Principal */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[150px]">Data</TableHead>
              <TableHead className="text-right">Saldo Inicial</TableHead>
              <TableHead className="text-right">Entradas</TableHead>
              <TableHead className="text-right">Saídas</TableHead>
              <TableHead className="text-right">Saldo Final</TableHead>
              <TableHead className="text-right">Pendente (+)</TableHead>
              <TableHead className="text-right">Pendente (-)</TableHead>
              <TableHead className="text-right">Saldo Projetado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((day, index) => {
              const isToday = day.date === summary.currentDate;
              const isDayProjectedNegative = day.projected.closing < 0;
              
              return (
                <TableRow 
                  key={day.date} 
                  className={cn(
                    index % 2 === 0 ? 'bg-muted/20' : '',
                    isToday && 'bg-primary/10 font-semibold',
                    isDayProjectedNegative && 'bg-red-50 dark:bg-red-950/20'
                  )}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {formatDateWithWeekday(day.date)}
                      {isToday && (
                        <Badge variant="default" className="text-xs">
                          HOJE
                        </Badge>
                      )}
                      {isDayProjectedNegative && (
                        <AlertTriangle className="h-3 w-3 text-red-600" />
                      )}
                    </div>
                  </TableCell>

                  <TableCell className={cn('text-right font-medium', getBalanceColor(day.balance.opening))}>
                    {formatCurrency(day.balance.opening)}
                  </TableCell>

                  <TableCell className="text-right text-green-600 dark:text-green-400 font-medium">
                    {day.balance.totalRevenue !== 0 && formatCurrency(day.balance.totalRevenue)}
                    {day.balance.totalRevenue === 0 && '-'}
                  </TableCell>

                  <TableCell className="text-right text-red-600 dark:text-red-400 font-medium">
                    {day.balance.totalExpense !== 0 && formatCurrency(day.balance.totalExpense)}
                    {day.balance.totalExpense === 0 && '-'}
                  </TableCell>

                  <TableCell className={cn('text-right font-bold', getBalanceColor(day.balance.closing))}>
                    {formatCurrency(day.balance.closing)}
                  </TableCell>

                  <TableCell className="text-right text-green-600 dark:text-green-400 text-sm">
                    {day.projected.pendingTotalRevenue !== 0 && formatCurrency(day.projected.pendingTotalRevenue)}
                    {day.projected.pendingTotalRevenue === 0 && '-'}
                  </TableCell>

                  <TableCell className="text-right text-red-600 dark:text-red-400 text-sm">
                    {day.projected.pendingTotalExpense !== 0 && formatCurrency(day.projected.pendingTotalExpense)}
                    {day.projected.pendingTotalExpense === 0 && '-'}
                  </TableCell>

                  {/* Saldo Projetado com destaque se negativo */}
                  <TableCell className={cn(
                    'text-right font-bold',
                    getBalanceColor(day.projected.closing),
                    isDayProjectedNegative && 'animate-pulse'
                  )}>
                    {formatCurrency(day.projected.closing)}
                    {isDayProjectedNegative && (
                      <AlertTriangle className="inline-block h-3 w-3 ml-1" />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow className={cn(
              "font-bold",
              isProjectedNegative ? "bg-red-100 dark:bg-red-950/30" : "bg-primary/5"
            )}>
              <TableCell>
                <div className="flex items-center gap-2">
                  TOTAL ({summary.totalDays} dias)
                  {isProjectedNegative && (
                    <Badge variant="destructive" className="animate-pulse">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      DÉFICIT
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(summary.openingBalance)}
              </TableCell>
              <TableCell className="text-right text-green-600 dark:text-green-400">
                {formatCurrency(summary.totalRevenue)}
              </TableCell>
              <TableCell className="text-right text-red-600 dark:text-red-400">
                {formatCurrency(summary.totalExpense)}
              </TableCell>
              <TableCell className={cn('text-right', getBalanceColor(summary.closingBalance))}>
                {formatCurrency(summary.closingBalance)}
              </TableCell>
              <TableCell colSpan={2} className="text-right text-muted-foreground text-sm">
                Variação: {formatCurrency(summary.netChange)}
              </TableCell>
              <TableCell className={cn(
                'text-right text-xl',
                getBalanceColor(summary.projectedClosingBalance),
                isProjectedNegative && 'animate-pulse'
              )}>
                {formatCurrency(summary.projectedClosingBalance)}
                {isProjectedNegative && (
                  <AlertTriangle className="inline-block h-4 w-4 ml-2" />
                )}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}