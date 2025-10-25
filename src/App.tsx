import { useState } from 'react';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import './App.css';

type View = 'dashboard' | 'transactions';

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');

  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-brand">
          <h2>💰 Personal Budget</h2>
        </div>
        <div className="nav-links">
          <button
            className={currentView === 'dashboard' ? 'active' : ''}
            onClick={() => setCurrentView('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={currentView === 'transactions' ? 'active' : ''}
            onClick={() => setCurrentView('transactions')}
          >
            Transactions
          </button>
        </div>
      </nav>

      <main className="main-content">
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'transactions' && <TransactionList />}
      </main>

      <footer className="footer">
        <p>Personal Budget Web - Built with React, Vite, and TypeScript</p>
      </footer>
    </div>
  );
}

export default App;
