import { useEffect, useState } from 'react';
import { transactionService } from '../services/api';
import type { Transaction } from '../types/api';
import './TransactionList.css';

const TransactionList = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        setError(null);

        let response;
        if (filterType === 'ALL') {
          response = await transactionService.getAll(page, 10);
        } else {
          response = await transactionService.getByType(filterType, page, 10);
        }

        setTransactions(response.data);
        setTotalPages(response.totalPages);
      } catch (err) {
        setError('Failed to load transactions. Please check your API connection.');
        console.error('Error fetching transactions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [page, filterType]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  const handleFilterChange = (type: 'ALL' | 'INCOME' | 'EXPENSE') => {
    setFilterType(type);
    setPage(1); // Reset to first page when filter changes
  };

  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage(page + 1);
    }
  };

  if (loading) {
    return (
      <div className="transaction-list">
        <h1>Transactions</h1>
        <div className="loading">Loading transactions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="transaction-list">
        <h1>Transactions</h1>
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="transaction-list">
      <h1>Transaction History</h1>

      <div className="filters">
        <button
          className={filterType === 'ALL' ? 'active' : ''}
          onClick={() => handleFilterChange('ALL')}
        >
          All
        </button>
        <button
          className={filterType === 'INCOME' ? 'active income-btn' : 'income-btn'}
          onClick={() => handleFilterChange('INCOME')}
        >
          Income
        </button>
        <button
          className={filterType === 'EXPENSE' ? 'active expense-btn' : 'expense-btn'}
          onClick={() => handleFilterChange('EXPENSE')}
        >
          Expenses
        </button>
      </div>

      {transactions.length === 0 ? (
        <div className="info">No transactions found</div>
      ) : (
        <>
          <div className="transactions-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th className="amount-column">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{formatDate(transaction.date)}</td>
                    <td>{transaction.description}</td>
                    <td>
                      <span className="category-badge">{transaction.category}</span>
                    </td>
                    <td>
                      <span className={`type-badge ${transaction.type.toLowerCase()}`}>
                        {transaction.type}
                      </span>
                    </td>
                    <td
                      className={`amount-column ${transaction.type === 'INCOME' ? 'income-amount' : 'expense-amount'}`}
                    >
                      {transaction.type === 'INCOME' ? '+' : '-'}
                      {formatCurrency(Math.abs(transaction.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <button onClick={handlePreviousPage} disabled={page === 1}>
              Previous
            </button>
            <span className="page-info">
              Page {page} of {totalPages}
            </span>
            <button onClick={handleNextPage} disabled={page === totalPages}>
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default TransactionList;
