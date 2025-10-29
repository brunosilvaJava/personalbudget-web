export interface DailyBalance {
  date: string;
  balance: Balance;
  projected: Projected;
}

export interface Balance {
  opening: number;
  totalRevenue: number;
  totalExpense: number;
  closing: number;
}

export interface Projected {
  opening: number;
  pendingTotalRevenue: number;
  pendingTotalExpense: number;
  closing: number;
}

export interface BalanceFilters {
  initialDate: string;
  endDate: string;
}

export interface BalanceSummary {
  totalDays: number;
  openingBalance: number;
  totalRevenue: number;
  totalExpense: number;
  closingBalance: number;
  projectedClosingBalance: number;
  netChange: number;
  currentBalance: number;
  currentProjectedBalance: number;
  currentDate: string;
  isCurrentDateInPeriod: boolean;
}