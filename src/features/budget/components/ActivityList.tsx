import { useEffect, useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { LinkAccountForm } from './LinkAccountForm';
import type { ActivityStatus, BudgetStatus } from '../types';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'No date';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: ActivityStatus }) {
  const styles = {
    planning: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
    active: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200',
    completed: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function BudgetStatusBadge({ status }: { status: BudgetStatus }) {
  const styles = {
    under: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200',
    near: 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200',
    over: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200',
  };

  const labels = {
    under: 'Under Budget',
    near: 'Near Budget',
    over: 'Over Budget',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export default function ActivityList() {
  const { activities, isLoading, isLinked, error, loadActivities, cooperators } = useBudget();
  const [statusFilter, setStatusFilter] = useState<ActivityStatus | ''>('');
  const [cooperatorFilter, setCooperatorFilter] = useState<number | ''>('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isLinked) {
      loadActivities();
    }
  }, [isLinked, loadActivities]);

  if (!isLinked) {
    return <LinkAccountForm />;
  }

  const filteredActivities = activities.filter(activity => {
    if (statusFilter && activity.status !== statusFilter) return false;
    if (cooperatorFilter && activity.cooperator_id !== cooperatorFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        activity.name.toLowerCase().includes(term) ||
        activity.cooperator_name?.toLowerCase().includes(term) ||
        activity.location?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Activities</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage activity budgets and expenses</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search activities..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as ActivityStatus | '')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
          <select
            value={cooperatorFilter}
            onChange={e => setCooperatorFilter(e.target.value ? Number(e.target.value) : '')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Cooperators</option>
            {cooperators.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <p className="text-amber-800 dark:text-amber-200 text-sm">
            Budget Tracker backend is not connected. Start the Flask server to sync activity data.
          </p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && activities.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">Loading activities...</p>
          </div>
        </div>
      )}

      {/* Activity List */}
      {!isLoading && filteredActivities.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">No activities found.</p>
          {error && (
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Activity data will appear here when the Flask backend is running.</p>
          )}
        </div>
      )}

      {filteredActivities.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm dark:shadow-gray-900/50 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Activity</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Cooperator</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Dates</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Budget</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Committed</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300">Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredActivities.map(activity => (
                <tr key={activity.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{activity.name}</p>
                      {activity.location && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{activity.location}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{activity.cooperator_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {formatDate(activity.start_date)}
                    {activity.end_date && activity.end_date !== activity.start_date && (
                      <> - {formatDate(activity.end_date)}</>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={activity.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                    {formatCurrency(activity.budget)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(activity.net_committed)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {activity.budget > 0
                        ? `${Math.round((activity.net_committed / activity.budget) * 100)}%`
                        : '0%'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <BudgetStatusBadge status={activity.budget_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
