import { useMemo } from 'react';
import { useBudget } from '../context/BudgetContext';
import type { Expense } from '../types';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function StatCard({
  label,
  value,
  subValue,
  color = 'blue',
}: {
  label: string;
  value: string | number;
  subValue?: string;
  color?: 'blue' | 'green' | 'amber' | 'red';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    green: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
    amber: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    red: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {subValue && <p className="text-xs mt-1 opacity-70">{subValue}</p>}
    </div>
  );
}

function BudgetStatusBadge({ status }: { status: 'under' | 'near' | 'over' }) {
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

interface DashboardProps {
  onNavigateToActivities?: (cooperatorId?: number) => void;
}

export default function Dashboard({ onNavigateToActivities }: DashboardProps) {
  const {
    dashboardSummary,
    activities,
    allExpenses,
    cooperators,
    loadSampleData,
  } = useBudget();

  const summary = dashboardSummary;

  // Status breakdown
  const statusBreakdown = useMemo(() => {
    const planning = activities.filter(a => a.status === 'planning');
    const active = activities.filter(a => a.status === 'active');
    const completed = activities.filter(a => a.status === 'completed');
    return {
      planning: { count: planning.length, budget: planning.reduce((s, a) => s + a.budget, 0) },
      active: { count: active.length, budget: active.reduce((s, a) => s + a.budget, 0) },
      completed: { count: completed.length, budget: completed.reduce((s, a) => s + a.budget, 0) },
    };
  }, [activities]);

  // Cooperator summary
  const cooperatorSummary = useMemo(() => {
    return cooperators.map(c => {
      const coopActivities = activities.filter(a => a.cooperator_id === c.id);
      return {
        id: c.id,
        name: c.name,
        activityCount: coopActivities.length,
        totalBudget: coopActivities.reduce((s, a) => s + a.budget, 0),
        totalSpent: coopActivities.reduce((s, a) => s + a.total_actual, 0),
      };
    }).filter(c => c.activityCount > 0);
  }, [cooperators, activities]);

  // Recent expenses (last 10 across all activities)
  const recentExpenses = useMemo(() => {
    const all: (Expense & { activityName: string })[] = [];
    for (const activity of activities) {
      const expenses = allExpenses[activity.id] || [];
      for (const e of expenses) {
        all.push({ ...e, activityName: activity.name });
      }
    }
    all.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return all.slice(0, 10);
  }, [activities, allExpenses]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Budget Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Track expenses and budget utilization</p>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Budget"
            value={formatCurrency(summary.total_budget)}
            subValue={`${summary.total_activities} activities`}
            color="blue"
          />
          <StatCard
            label="Spent"
            value={formatCurrency(summary.total_spent)}
            subValue="Actual expenses"
            color="amber"
          />
          <StatCard
            label="Committed"
            value={formatCurrency(summary.total_committed)}
            subValue="Incl. projected"
            color="amber"
          />
          <StatCard
            label="Remaining"
            value={formatCurrency(summary.budget_remaining)}
            subValue={`${summary.active_activities} active`}
            color="green"
          />
        </div>
      )}

      {/* Status Breakdown */}
      {activities.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Planning</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{statusBreakdown.planning.count}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{formatCurrency(statusBreakdown.planning.budget)}</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Active</span>
            </div>
            <p className="text-xl font-bold text-blue-900 dark:text-blue-100">{statusBreakdown.active.count}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400">{formatCurrency(statusBreakdown.active.budget)}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">Completed</span>
            </div>
            <p className="text-xl font-bold text-green-900 dark:text-green-100">{statusBreakdown.completed.count}</p>
            <p className="text-xs text-green-600 dark:text-green-400">{formatCurrency(statusBreakdown.completed.budget)}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activities */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Activities</h2>
          </div>

          {activities.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <p>No budget activities yet.</p>
              <button
                onClick={loadSampleData}
                className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Load sample data to explore
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {activities.slice(0, 10).map(activity => (
                <div
                  key={activity.id}
                  className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {activity.name}
                        </h3>
                        <BudgetStatusBadge status={activity.budget_status} />
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {activity.cooperator_name} &middot; {activity.status}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {formatCurrency(activity.net_committed)}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        of {formatCurrency(activity.budget)}
                      </p>
                    </div>
                  </div>

                  {/* Budget Progress Bar */}
                  <div className="mt-2">
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          activity.budget_status === 'over'
                            ? 'bg-red-500'
                            : activity.budget_status === 'near'
                            ? 'bg-amber-500'
                            : 'bg-green-500'
                        }`}
                        style={{
                          width: `${Math.min(
                            (activity.net_committed / activity.budget) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Cooperator Summary */}
          {cooperatorSummary.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cooperators</h2>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Name</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">#</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Budget</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Spent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {cooperatorSummary.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-2">
                        <button
                          onClick={() => onNavigateToActivities?.(c.id)}
                          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {c.name}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-gray-600 dark:text-gray-400">{c.activityCount}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-900 dark:text-gray-100">{formatCurrency(c.totalBudget)}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-900 dark:text-gray-100">{formatCurrency(c.totalSpent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Recent Expenses */}
          {recentExpenses.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Expenses</h2>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {recentExpenses.map(e => (
                  <div key={e.id} className="px-4 py-2.5 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{e.description}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{e.activityName}</p>
                    </div>
                    <span className={`text-sm font-medium ml-3 whitespace-nowrap ${
                      e.actual_amount != null
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {formatCurrency(e.actual_amount ?? e.projected_amount ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
