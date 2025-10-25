import { useEffect, useState } from 'react';
import { dashboardService } from '../services/api';
import type { DashboardStats } from '../types/api';
import './Dashboard.css';

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await dashboardService.getStats();
        setStats(response.data);
      } catch (err) {
        setError('Failed to load dashboard statistics. Please check your API connection.');
        console.error('Error fetching dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="dashboard">
        <h1>Dashboard</h1>
        <div className="loading">Loading statistics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <h1>Dashboard</h1>
        <div className="error">{error}</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="dashboard">
        <h1>Dashboard</h1>
        <div className="info">No data available</div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <h1>Personal Budget Dashboard</h1>

      <div className="stats-grid">
        <div className="stat-card balance">
          <h3>Current Balance</h3>
          <p className="stat-value">{formatCurrency(stats.balance)}</p>
          <span className="stat-label">Total Income - Total Expenses</span>
        </div>

        <div className="stat-card income">
          <h3>Total Income</h3>
          <p className="stat-value">{formatCurrency(stats.totalIncome)}</p>
          <span className="stat-label">All time</span>
        </div>

        <div className="stat-card expense">
          <h3>Total Expenses</h3>
          <p className="stat-value">{formatCurrency(stats.totalExpenses)}</p>
          <span className="stat-label">All time</span>
        </div>

        <div className="stat-card monthly-income">
          <h3>Monthly Income</h3>
          <p className="stat-value">{formatCurrency(stats.monthlyIncome)}</p>
          <span className="stat-label">Current month</span>
        </div>

        <div className="stat-card monthly-expense">
          <h3>Monthly Expenses</h3>
          <p className="stat-value">{formatCurrency(stats.monthlyExpenses)}</p>
          <span className="stat-label">Current month</span>
        </div>

        <div className="stat-card transactions">
          <h3>Total Transactions</h3>
          <p className="stat-value">{stats.transactionCount}</p>
          <span className="stat-label">All time</span>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
