import { useState } from 'react';
import type { Expense, ExpenseCategory, CategoryBudget } from '../types';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

const CATEGORY_COLORS = ['#0d6efd', '#6610f2', '#6f42c1', '#d63384', '#dc3545', '#fd7e14', '#ffc107', '#20c997', '#198754', '#0dcaf0'];

interface CategoryGroup {
  categoryId: number;
  categoryName: string;
  expenses: Expense[];
  totalProjected: number;
  totalActual: number;
  totalCommitted: number;
  allocation: number | null;
}

interface CategoryExpenseListProps {
  expenses: Expense[];
  categories: ExpenseCategory[];
  categoryBudgets: CategoryBudget[];
  activityBudget: number;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (id: number) => void;
  onConvertExpense: (id: number) => void;
  onDuplicateExpense: (id: number) => void;
  onAddExpense: (categoryId?: number) => void;
  onEditAllocation: (categoryId: number, currentAmount: number | null) => void;
}

export default function CategoryExpenseList({
  expenses,
  categories,
  categoryBudgets,
  activityBudget,
  onEditExpense,
  onDeleteExpense,
  onConvertExpense,
  onDuplicateExpense,
  onAddExpense,
  onEditAllocation,
}: CategoryExpenseListProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());

  // Build category groups
  const groups: CategoryGroup[] = [];
  const expensesByCategory = new Map<number, Expense[]>();

  for (const e of expenses) {
    const list = expensesByCategory.get(e.category_id) || [];
    list.push(e);
    expensesByCategory.set(e.category_id, list);
  }

  // Include categories that have expenses or allocations
  const relevantCategoryIds = new Set([
    ...expensesByCategory.keys(),
    ...categoryBudgets.map(cb => cb.category_id),
  ]);

  for (const catId of relevantCategoryIds) {
    const cat = categories.find(c => c.id === catId);
    const catExpenses = expensesByCategory.get(catId) || [];
    const allocation = categoryBudgets.find(cb => cb.category_id === catId);

    let totalProjected = 0;
    let totalActual = 0;
    for (const e of catExpenses) {
      totalProjected += e.projected_amount ?? 0;
      totalActual += e.actual_amount ?? 0;
    }

    groups.push({
      categoryId: catId,
      categoryName: cat?.name || catExpenses[0]?.category_name || 'Unknown',
      expenses: catExpenses,
      totalProjected,
      totalActual,
      totalCommitted: totalActual + catExpenses.filter(e => e.status === 'projected').reduce((s, e) => s + (e.projected_amount ?? 0), 0),
      allocation: allocation?.allocated_amount ?? null,
    });
  }

  // Sort by committed amount descending
  groups.sort((a, b) => b.totalCommitted - a.totalCommitted);

  const totalAllocated = categoryBudgets.reduce((s, cb) => s + cb.allocated_amount, 0);
  const unallocated = activityBudget - totalAllocated;

  const toggleCategory = (catId: number) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const allExpanded = groups.length > 0 && groups.every(g => expandedCategories.has(g.categoryId));

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedCategories(new Set());
    } else {
      setExpandedCategories(new Set(groups.map(g => g.categoryId)));
    }
  };

  if (groups.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
        No expenses yet. Click "+ Add Expense" to get started.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Summary bar */}
      {categoryBudgets.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            Budget: <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(activityBudget)}</span>
            {' · '}Allocated: <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(totalAllocated)}</span>
          </span>
          <span className={`font-medium ${unallocated < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
            {unallocated >= 0 ? `${formatCurrency(unallocated)} unallocated` : `${formatCurrency(Math.abs(unallocated))} over-allocated`}
          </span>
        </div>
      )}

      {/* Expand/Collapse all */}
      <div className="flex justify-end">
        <button
          onClick={toggleAll}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      {/* Category accordion list */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden divide-y divide-gray-200 dark:divide-gray-700">
        {groups.map((group, idx) => {
          const isExpanded = expandedCategories.has(group.categoryId);
          const colorIdx = categories.findIndex(c => c.id === group.categoryId);
          const color = CATEGORY_COLORS[colorIdx >= 0 ? colorIdx % CATEGORY_COLORS.length : idx % CATEGORY_COLORS.length];

          const pctUsed = group.allocation
            ? Math.round((group.totalCommitted / group.allocation) * 100)
            : null;
          const isOverBudget = pctUsed !== null && pctUsed > 100;
          const isNearBudget = pctUsed !== null && pctUsed >= 85 && pctUsed <= 100;

          return (
            <div key={group.categoryId}>
              {/* Category header row */}
              <button
                onClick={() => toggleCategory(group.categoryId)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
              >
                {/* Expand/collapse indicator */}
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>

                {/* Color dot */}
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />

                {/* Category name + count */}
                <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                  {group.categoryName}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  ({group.expenses.length})
                </span>

                {/* Spacer */}
                <span className="flex-1" />

                {/* Progress bar (if allocation set) */}
                {group.allocation !== null && (
                  <div className="w-24 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden shrink-0">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isOverBudget ? 'bg-red-500' : isNearBudget ? 'bg-amber-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(pctUsed ?? 0, 100)}%` }}
                    />
                  </div>
                )}

                {/* Amount display */}
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 tabular-nums text-right min-w-[80px] shrink-0">
                  {formatCurrency(group.totalCommitted)}
                </span>
                {group.allocation !== null ? (
                  <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums text-right min-w-[100px] shrink-0">
                    / {formatCurrency(group.allocation)}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400 dark:text-gray-500 text-right min-w-[100px] shrink-0">
                    projected
                  </span>
                )}

                {/* Remaining */}
                {group.allocation !== null && (
                  <span className={`text-xs tabular-nums min-w-[80px] text-right shrink-0 ${
                    isOverBudget
                      ? 'text-red-600 dark:text-red-400 font-medium'
                      : isNearBudget
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {group.allocation - group.totalCommitted >= 0
                      ? `${formatCurrency(group.allocation - group.totalCommitted)} left`
                      : `${formatCurrency(Math.abs(group.allocation - group.totalCommitted))} over`
                    }
                  </span>
                )}
              </button>

              {/* Expanded: expense rows */}
              {isExpanded && (
                <div className="bg-gray-50/50 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-700/50">
                  {group.expenses.length > 0 ? (
                    <table className="w-full table-fixed">
                      <colgroup>
                        <col />
                        <col style={{ width: '100px' }} />
                        <col style={{ width: '90px' }} />
                        <col style={{ width: '90px' }} />
                        <col style={{ width: '160px' }} />
                      </colgroup>
                      <thead>
                        <tr className="text-xs text-gray-500 dark:text-gray-400">
                          <th className="pl-12 pr-4 py-2 text-left font-medium">Description</th>
                          <th className="px-4 py-2 text-right font-medium">Amount</th>
                          <th className="px-4 py-2 text-center font-medium">Status</th>
                          <th className="px-4 py-2 text-left font-medium">Date</th>
                          <th className="px-4 py-2 text-right font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {group.expenses.map(expense => (
                          <tr key={expense.id} className="hover:bg-gray-100/50 dark:hover:bg-gray-800/50">
                            <td className="pl-12 pr-4 py-2.5">
                              <p className="text-sm text-gray-900 dark:text-gray-100">{expense.description}</p>
                              {expense.notes && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-xs">{expense.notes}</p>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right text-sm tabular-nums">
                              {expense.status === 'actual' ? (
                                <span className="text-green-600 dark:text-green-400 font-medium">
                                  {formatCurrency(expense.actual_amount ?? 0)}
                                </span>
                              ) : (
                                <span className="text-gray-700 dark:text-gray-300">
                                  {formatCurrency(expense.projected_amount ?? 0)}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                expense.status === 'actual'
                                  ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200'
                                  : expense.status === 'partial'
                                    ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                              }`}>
                                {expense.status === 'projected' ? 'Projected' : expense.status === 'actual' ? 'Actual' : 'Partial'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400">
                              {formatDate(expense.projected_date || expense.actual_date)}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex justify-end gap-1">
                                {expense.status === 'projected' && (
                                  <button
                                    onClick={() => onConvertExpense(expense.id)}
                                    className="px-2 py-0.5 text-xs text-green-600 hover:text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors"
                                  >
                                    Confirm
                                  </button>
                                )}
                                <button
                                  onClick={() => onDuplicateExpense(expense.id)}
                                  className="px-2 py-0.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                                >
                                  Copy
                                </button>
                                <button
                                  onClick={() => onEditExpense(expense)}
                                  className="px-2 py-0.5 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => onDeleteExpense(expense.id)}
                                  className="px-2 py-0.5 text-xs text-red-500 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                                >
                                  Del
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="pl-12 py-3 text-sm text-gray-500 dark:text-gray-400">
                      No expenses in this category yet.
                    </p>
                  )}

                  {/* Actions row within expanded category */}
                  <div className="pl-12 py-2 flex items-center gap-3 border-t border-gray-100 dark:border-gray-700/50">
                    <button
                      onClick={() => onAddExpense(group.categoryId)}
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
                    >
                      + Add Expense
                    </button>
                    <button
                      onClick={() => onEditAllocation(group.categoryId, group.allocation)}
                      className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      {group.allocation !== null ? 'Edit Allocation' : 'Set Allocation'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
