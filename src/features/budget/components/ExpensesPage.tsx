import { useState, useMemo } from 'react';
import { useBudget } from '../context/BudgetContext';
import ExpenseForm from './ExpenseForm';
import type { ExpenseStatus, Expense } from '../types';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function StatusBadge({ status }: { status: ExpenseStatus }) {
  const styles = {
    projected: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
    actual: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200',
    partial: 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

const PAGE_SIZE = 50;

export default function ExpensesPage() {
  const { activities, allExpenses, categories, deleteExpense, convertExpenseToActual, duplicateExpense } = useBudget();
  const [activityFilter, setActivityFilter] = useState<number | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<number | ''>('');
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | ''>('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'category' | 'activity'>('date');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<{ expense: Expense; activityId: number } | null>(null);

  // Flatten all expenses with activity info
  const allFlat = useMemo(() => {
    const result: (Expense & { activityName: string })[] = [];
    for (const a of activities) {
      for (const e of allExpenses[a.id] || []) {
        result.push({ ...e, activityName: a.name });
      }
    }
    return result;
  }, [activities, allExpenses]);

  const filtered = useMemo(() => {
    let items = allFlat;
    if (activityFilter) items = items.filter(e => e.activity_id === activityFilter);
    if (categoryFilter) items = items.filter(e => e.category_id === categoryFilter);
    if (statusFilter) items = items.filter(e => e.status === statusFilter);

    switch (sortBy) {
      case 'date': items.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')); break;
      case 'amount': items.sort((a, b) => ((b.actual_amount ?? b.projected_amount ?? 0) - (a.actual_amount ?? a.projected_amount ?? 0))); break;
      case 'category': items.sort((a, b) => a.category_name.localeCompare(b.category_name)); break;
      case 'activity': items.sort((a, b) => a.activityName.localeCompare(b.activityName)); break;
    }
    return items;
  }, [allFlat, activityFilter, categoryFilter, statusFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const selectCls = 'px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Expenses</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{filtered.length} expense{filtered.length !== 1 ? 's' : ''} found</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowForm(true)} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
            + Add Expense
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-3">
          <select value={activityFilter} onChange={e => { setActivityFilter(e.target.value ? Number(e.target.value) : ''); setPage(1); }} className={selectCls}>
            <option value="">All Activities</option>
            {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value ? Number(e.target.value) : ''); setPage(1); }} className={selectCls}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as ExpenseStatus | ''); setPage(1); }} className={selectCls}>
            <option value="">All Statuses</option>
            <option value="projected">Projected</option>
            <option value="actual">Actual</option>
            <option value="partial">Partial</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className={selectCls}>
            <option value="date">Sort: Date</option>
            <option value="amount">Sort: Amount</option>
            <option value="category">Sort: Category</option>
            <option value="activity">Sort: Activity</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {paginated.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
          No expenses found.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Description</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Activity</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Category</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Projected</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Actual</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {paginated.map(expense => (
                  <tr key={expense.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{expense.description}</p>
                      {expense.receipt_reference && <p className="text-xs text-gray-500 dark:text-gray-400">Ref: {expense.receipt_reference}</p>}
                      {expense.participants.length > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 mt-0.5">
                          {expense.participants.length} participant{expense.participants.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{expense.activityName}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{expense.category_name}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">
                      {expense.projected_amount != null ? formatCurrency(expense.projected_amount) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-green-700 dark:text-green-400">
                      {expense.actual_amount != null ? formatCurrency(expense.actual_amount) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={expense.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {expense.status === 'projected' && (
                          <button onClick={() => convertExpenseToActual(expense.activity_id, expense.id)} className="px-2 py-0.5 text-xs text-green-600 hover:text-green-700 dark:text-green-400">
                            Confirm
                          </button>
                        )}
                        <button onClick={() => duplicateExpense(expense.activity_id, expense.id)} className="px-2 py-0.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400">
                          Copy
                        </button>
                        <button onClick={() => setEditingExpense({ expense, activityId: expense.activity_id })} className="px-2 py-0.5 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400">
                          Edit
                        </button>
                        <button onClick={() => deleteExpense(expense.activity_id, expense.id)} className="px-2 py-0.5 text-xs text-red-500 hover:text-red-700 dark:text-red-400">
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
                  Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)} className={`px-3 py-1 text-sm border rounded ${p === page ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                    {p}
                  </button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Forms */}
      {showForm && (
        <ExpenseForm activityId={activities[0]?.id || 0} onClose={() => setShowForm(false)} />
      )}
      {editingExpense && (
        <ExpenseForm activityId={editingExpense.activityId} expense={editingExpense.expense} onClose={() => setEditingExpense(null)} />
      )}
    </div>
  );
}
