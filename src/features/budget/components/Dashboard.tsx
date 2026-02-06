import { useBudget } from '../context/BudgetContext';

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

export default function Dashboard() {
  const {
    dashboardSummary,
    activities,
    loadSampleData,
  } = useBudget();

  const summary = dashboardSummary;

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

      {/* Recent Activities */}
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
    </div>
  );
}
