import { useState, useMemo } from 'react';
import { useBudget } from '../context/BudgetContext';
import IncomeForm from './IncomeForm';
import type { ExpenseStatus, Income } from '../types';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function StatusBadge({ status }: { status: ExpenseStatus }) {
  const styles = {
    projected: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
    actual: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200',
    partial: 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200',
  };
  const labels = { projected: 'Expected', actual: 'Received', partial: 'Partial' };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

const PAGE_SIZE = 50;

export default function IncomePage() {
  const { activities, allIncome, deleteIncome, markIncomeReceived } = useBudget();
  const [activityFilter, setActivityFilter] = useState<number | ''>('');
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | ''>('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingIncome, setEditingIncome] = useState<{ income: Income; activityId: number } | null>(null);

  const allFlat = useMemo(() => {
    const result: (Income & { activityName: string })[] = [];
    for (const a of activities) {
      for (const i of allIncome[a.id] || []) {
        result.push({ ...i, activityName: a.name });
      }
    }
    result.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return result;
  }, [activities, allIncome]);

  const filtered = useMemo(() => {
    let items = allFlat;
    if (activityFilter) items = items.filter(i => i.activity_id === activityFilter);
    if (statusFilter) items = items.filter(i => i.status === statusFilter);
    return items;
  }, [allFlat, activityFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const selectCls = 'px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Income</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{filtered.length} income item{filtered.length !== 1 ? 's' : ''} found</p>
        </div>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
          + Add Income
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-3">
          <select value={activityFilter} onChange={e => { setActivityFilter(e.target.value ? Number(e.target.value) : ''); setPage(1); }} className={selectCls}>
            <option value="">All Activities</option>
            {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as ExpenseStatus | ''); setPage(1); }} className={selectCls}>
            <option value="">All Statuses</option>
            <option value="projected">Expected</option>
            <option value="actual">Received</option>
            <option value="partial">Partial</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {paginated.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
          No income items found.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Description</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Activity</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Source</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Expected</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Received</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {paginated.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{item.description}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{item.activityName}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{item.source || '-'}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">
                      {item.projected_amount != null ? formatCurrency(item.projected_amount) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-green-700 dark:text-green-400">
                      {item.actual_amount != null ? formatCurrency(item.actual_amount) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={item.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {item.status === 'projected' && (
                          <button onClick={() => markIncomeReceived(item.activity_id, item.id)} className="px-2 py-0.5 text-xs text-green-600 hover:text-green-700 dark:text-green-400">
                            Confirm
                          </button>
                        )}
                        <button onClick={() => setEditingIncome({ income: item, activityId: item.activity_id })} className="px-2 py-0.5 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400">
                          Edit
                        </button>
                        <button onClick={() => deleteIncome(item.activity_id, item.id)} className="px-2 py-0.5 text-xs text-red-500 hover:text-red-700 dark:text-red-400">
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">Prev</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && <IncomeForm activityId={activities[0]?.id || 0} onClose={() => setShowForm(false)} />}
      {editingIncome && <IncomeForm activityId={editingIncome.activityId} income={editingIncome.income} onClose={() => setEditingIncome(null)} />}
    </div>
  );
}
