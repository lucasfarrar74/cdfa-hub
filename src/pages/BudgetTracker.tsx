import { useState } from 'react';
import { BudgetProvider } from '../features/budget/context/BudgetContext';
import { Dashboard, ActivityList, ReportsView, SettingsView } from '../features/budget/components';

type Tab = 'dashboard' | 'activities' | 'reports' | 'settings';

function BudgetContent() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [cooperatorFilter, setCooperatorFilter] = useState<number | undefined>();

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'activities', label: 'Activities' },
    { id: 'reports', label: 'Reports' },
    { id: 'settings', label: 'Settings' },
  ];

  const handleNavigateToActivities = (cooperatorId?: number) => {
    setCooperatorFilter(cooperatorId);
    setActiveTab('activities');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Budget Tracker</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Track activity expenses and budgets</p>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-4">
          <div className="flex space-x-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id !== 'activities') setCooperatorFilter(undefined);
                }}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 p-4 overflow-auto bg-gray-50 dark:bg-gray-900">
        {activeTab === 'dashboard' && <Dashboard onNavigateToActivities={handleNavigateToActivities} />}
        {activeTab === 'activities' && <ActivityList initialCooperatorFilter={cooperatorFilter} />}
        {activeTab === 'reports' && <ReportsView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}

export function BudgetTracker() {
  return (
    <BudgetProvider>
      <BudgetContent />
    </BudgetProvider>
  );
}
