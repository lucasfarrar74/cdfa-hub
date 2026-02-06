import { useState, useMemo } from 'react';
import { useBudget } from '../context/BudgetContext';
import type { ExpenseCategory } from '../types';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export default function CategoriesPage() {
  const { categories, allExpenses, createCategory, updateCategory, deleteCategory } = useBudget();
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // Compute stats per category
  const categoryStats = useMemo(() => {
    const stats: Record<number, { count: number; projectedTotal: number; actualTotal: number }> = {};
    Object.values(allExpenses).forEach(expenses => {
      expenses.forEach(e => {
        if (!stats[e.category_id]) stats[e.category_id] = { count: 0, projectedTotal: 0, actualTotal: 0 };
        stats[e.category_id].count += 1;
        stats[e.category_id].projectedTotal += e.projected_amount ?? 0;
        stats[e.category_id].actualTotal += e.actual_amount ?? 0;
      });
    });
    return stats;
  }, [allExpenses]);

  function openCreateForm() {
    setFormName('');
    setFormDescription('');
    setEditingCategory(null);
    setShowForm(true);
  }

  function openEditForm(c: ExpenseCategory) {
    setFormName(c.name);
    setFormDescription(c.description || '');
    setEditingCategory(c);
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;

    if (editingCategory) {
      updateCategory(editingCategory.id, {
        name: formName.trim(),
        description: formDescription.trim() || null,
      });
    } else {
      createCategory({
        name: formName.trim(),
        description: formDescription.trim() || null,
      });
    }
    setShowForm(false);
  }

  function handleDelete(id: number) {
    const ok = deleteCategory(id);
    if (!ok) {
      alert('Cannot delete this category because it is used by existing expenses.');
    }
  }

  const totalExpenses = Object.values(categoryStats).reduce((s, v) => s + v.count, 0);
  const totalActual = Object.values(categoryStats).reduce((s, v) => s + v.actualTotal, 0);

  const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Expense Categories</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{categories.length} categories, {totalExpenses} total expenses</p>
        </div>
        <button onClick={openCreateForm} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
          + Add Category
        </button>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {categories.map(cat => {
          const stats = categoryStats[cat.id] || { count: 0, projectedTotal: 0, actualTotal: 0 };
          const pct = totalActual > 0 ? Math.round((stats.actualTotal / totalActual) * 100) : 0;

          return (
            <div key={cat.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{cat.name}</h3>
                  {cat.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{cat.description}</p>
                  )}
                </div>
                <div className="flex gap-1 ml-2">
                  <button onClick={() => openEditForm(cat)} className="px-2 py-0.5 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(cat.id)} className="px-2 py-0.5 text-xs text-red-500 hover:text-red-700 dark:text-red-400">
                    Del
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Expenses</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{stats.count}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Projected</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(stats.projectedTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Actual</p>
                  <p className="text-sm font-semibold text-green-700 dark:text-green-400">{formatCurrency(stats.actualTotal)}</p>
                </div>
              </div>

              {/* Percentage bar */}
              {stats.actualTotal > 0 && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>% of total spend</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {categories.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
          No categories defined. Add a category to get started.
        </div>
      )}

      {/* Summary Table */}
      {categories.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Category Summary</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Category</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300"># Expenses</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Projected</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Actual</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {categories
                  .map(cat => ({ cat, stats: categoryStats[cat.id] || { count: 0, projectedTotal: 0, actualTotal: 0 } }))
                  .sort((a, b) => b.stats.actualTotal - a.stats.actualTotal)
                  .map(({ cat, stats }) => (
                    <tr key={cat.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{cat.name}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600 dark:text-gray-400">{stats.count}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">{formatCurrency(stats.projectedTotal)}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-green-700 dark:text-green-400">{formatCurrency(stats.actualTotal)}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">
                        {totalActual > 0 ? `${Math.round((stats.actualTotal / totalActual) * 100)}%` : '-'}
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Total</td>
                  <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">{totalExpenses}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {formatCurrency(Object.values(categoryStats).reduce((s, v) => s + v.projectedTotal, 0))}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-green-700 dark:text-green-400">
                    {formatCurrency(totalActual)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                  <input type="text" value={formName} onChange={e => setFormName(e.target.value)} required className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={2} className={inputCls} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                    {editingCategory ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
