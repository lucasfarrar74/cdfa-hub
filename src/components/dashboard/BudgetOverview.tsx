import { CurrencyDollarIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline';

interface BudgetCategory {
  id: string;
  name: string;
  allocated: number;
  spent: number;
  committed: number;
}

// Mock data - would be fetched from Budget Tracker API
const mockBudgetData = {
  fiscalYear: 'FY 2025-26',
  totalBudget: 850000,
  totalSpent: 425000,
  totalCommitted: 125000,
  categories: [
    { id: '1', name: 'Trade Missions', allocated: 350000, spent: 180000, committed: 75000 },
    { id: '2', name: 'Educational Events', allocated: 200000, spent: 95000, committed: 25000 },
    { id: '3', name: 'Consultations', allocated: 150000, spent: 85000, committed: 15000 },
    { id: '4', name: 'Marketing', allocated: 100000, spent: 45000, committed: 10000 },
    { id: '5', name: 'Operations', allocated: 50000, spent: 20000, committed: 0 },
  ] as BudgetCategory[],
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getProgressColor(percentage: number): string {
  if (percentage >= 90) return 'bg-red-500';
  if (percentage >= 75) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function getProgressBg(percentage: number): string {
  if (percentage >= 90) return 'bg-red-100 dark:bg-red-900/30';
  if (percentage >= 75) return 'bg-amber-100 dark:bg-amber-900/30';
  return 'bg-emerald-100 dark:bg-emerald-900/30';
}

export function BudgetOverview() {
  const { totalBudget, totalSpent, totalCommitted, categories, fiscalYear } = mockBudgetData;
  const totalUtilized = totalSpent + totalCommitted;
  const utilizationPercent = Math.round((totalUtilized / totalBudget) * 100);
  const spentPercent = Math.round((totalSpent / totalBudget) * 100);
  const remaining = totalBudget - totalUtilized;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow dark:shadow-gray-900/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
            <CurrencyDollarIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Budget Overview</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{fiscalYear}</p>
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${getProgressBg(utilizationPercent)} ${utilizationPercent >= 90 ? 'text-red-700 dark:text-red-300' : utilizationPercent >= 75 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
          {utilizationPercent}% utilized
        </div>
      </div>

      {/* Main stats */}
      <div className="px-5 py-4 grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(totalBudget)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Budget</p>
        </div>
        <div className="text-center border-x border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalSpent)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Actual Spent</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(remaining)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Available</p>
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="px-5 pb-4">
        <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
          <div
            className="bg-emerald-500 transition-all duration-500"
            style={{ width: `${spentPercent}%` }}
            title={`Spent: ${formatCurrency(totalSpent)}`}
          />
          <div
            className="bg-blue-400 transition-all duration-500"
            style={{ width: `${Math.round((totalCommitted / totalBudget) * 100)}%` }}
            title={`Committed: ${formatCurrency(totalCommitted)}`}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Spent ({spentPercent}%)
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            Committed ({Math.round((totalCommitted / totalBudget) * 100)}%)
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"></span>
            Remaining
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="border-t border-gray-200 dark:border-gray-700">
        <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/50">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">By Category</p>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {categories.map((cat) => {
            const catUtilized = cat.spent + cat.committed;
            const catPercent = Math.round((catUtilized / cat.allocated) * 100);
            return (
              <div key={cat.id} className="px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{cat.name}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {formatCurrency(catUtilized)} / {formatCurrency(cat.allocated)}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getProgressColor(catPercent)}`}
                    style={{ width: `${Math.min(catPercent, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <a
          href="/budget-tracker"
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
        >
          View full budget details →
        </a>
      </div>
    </div>
  );
}
