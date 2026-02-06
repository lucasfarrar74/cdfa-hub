import { useState, useMemo } from 'react';
import { useBudget } from '../context/BudgetContext';
import type { ActivitySummary, Expense, Income, ActivityFinancials } from '../types';
import ExpenseForm from './ExpenseForm';
import IncomeForm from './IncomeForm';
import ActivityForm from './ActivityForm';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    projected: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
    actual: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200',
    partial: 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200',
    planning: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
    active: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200',
    completed: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.projected}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

type DetailTab = 'overview' | 'expenses' | 'income';

interface ActivityDetailProps {
  activityId: number;
  onClose: () => void;
}

export default function ActivityDetail({ activityId, onClose }: ActivityDetailProps) {
  const {
    activities, cooperators, allExpenses, allIncome, categories,
    updateActivity, deleteActivity, deleteExpense, convertExpenseToActual,
    duplicateExpense, deleteIncome, markIncomeReceived, createExpense,
    computeActivityFinancials,
  } = useBudget();

  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [showEditForm, setShowEditForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);
  const [expenseSort, setExpenseSort] = useState<'date' | 'category' | 'amount' | 'status'>('date');
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkRows, setBulkRows] = useState<Array<{ categoryId: string; description: string; amount: string; date: string }>>([
    { categoryId: '', description: '', amount: '', date: '' },
  ]);

  const activity = activities.find(a => a.id === activityId);
  const expenses = allExpenses[activityId] || [];
  const income = allIncome[activityId] || [];
  const cooperator = cooperators.find(c => c.id === activity?.cooperator_id);
  const financials = computeActivityFinancials(activityId);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<number, { name: string; count: number; projected: number; actual: number; expenses: Expense[] }>();
    for (const e of expenses) {
      const existing = map.get(e.category_id) || { name: e.category_name, count: 0, projected: 0, actual: 0, expenses: [] };
      existing.count++;
      existing.projected += e.projected_amount ?? 0;
      existing.actual += e.actual_amount ?? 0;
      existing.expenses.push(e);
      map.set(e.category_id, existing);
    }
    return Array.from(map.entries());
  }, [expenses]);

  const sortedExpenses = useMemo(() => {
    const sorted = [...expenses];
    switch (expenseSort) {
      case 'date':
        sorted.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        break;
      case 'category':
        sorted.sort((a, b) => a.category_name.localeCompare(b.category_name));
        break;
      case 'amount':
        sorted.sort((a, b) => ((b.actual_amount ?? b.projected_amount ?? 0) - (a.actual_amount ?? a.projected_amount ?? 0)));
        break;
      case 'status':
        sorted.sort((a, b) => a.status.localeCompare(b.status));
        break;
    }
    return sorted;
  }, [expenses, expenseSort]);

  if (!activity || !financials) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        Activity not found.
      </div>
    );
  }

  const handleDelete = () => {
    deleteActivity(activityId);
    onClose();
  };

  const handleStatusChange = (newStatus: 'planning' | 'active' | 'completed') => {
    updateActivity(activityId, { status: newStatus });
  };

  const handleBulkSubmit = async () => {
    for (const row of bulkRows) {
      if (row.categoryId && row.description.trim()) {
        await createExpense(activityId, {
          category_id: Number(row.categoryId),
          description: row.description.trim(),
          projected_amount: row.amount ? Number(row.amount.replace(/[^0-9.-]/g, '')) : undefined,
          projected_date: row.date || undefined,
        });
      }
    }
    setShowBulkAdd(false);
    setBulkRows([{ categoryId: '', description: '', amount: '', date: '' }]);
  };

  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'expenses', label: `Expenses (${expenses.length})` },
    { id: 'income', label: `Income (${income.length})` },
  ];

  const confirmedCount = expenses.filter(e => e.status === 'actual').length;
  const pendingCount = expenses.filter(e => e.status === 'projected').length;
  const uniqueCategories = new Set(expenses.map(e => e.category_id)).size;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              {activity.name}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <select
                value={activity.status}
                onChange={e => handleStatusChange(e.target.value as 'planning' | 'active' | 'completed')}
                className="text-xs px-2 py-0.5 rounded-full border-0 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 cursor-pointer focus:ring-1 focus:ring-blue-500"
              >
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <button onClick={() => setShowEditForm(true)} className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors" title="Edit">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button onClick={() => setShowDeleteConfirm(true)} className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors" title="Delete">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors" title="Close">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-4">
        <div className="flex space-x-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'overview' && (
          <OverviewTab
            activity={activity}
            financials={financials}
            cooperator={cooperator}
            expenses={expenses}
            confirmedCount={confirmedCount}
            pendingCount={pendingCount}
            uniqueCategories={uniqueCategories}
            categoryBreakdown={categoryBreakdown}
            expandedCategory={expandedCategory}
            setExpandedCategory={setExpandedCategory}
          />
        )}

        {activeTab === 'expenses' && (
          <ExpensesTab
            expenses={sortedExpenses}
            expenseSort={expenseSort}
            setExpenseSort={setExpenseSort}
            onAddExpense={() => { setEditingExpense(null); setShowExpenseForm(true); }}
            onEditExpense={(e) => { setEditingExpense(e); setShowExpenseForm(true); }}
            onDeleteExpense={(id) => deleteExpense(activityId, id)}
            onConvertExpense={(id) => convertExpenseToActual(activityId, id)}
            onDuplicateExpense={(id) => duplicateExpense(activityId, id)}
            showBulkAdd={showBulkAdd}
            setShowBulkAdd={setShowBulkAdd}
            bulkRows={bulkRows}
            setBulkRows={setBulkRows}
            onBulkSubmit={handleBulkSubmit}
            categories={categories}
          />
        )}

        {activeTab === 'income' && (
          <IncomeTab
            income={income}
            onAddIncome={() => { setEditingIncome(null); setShowIncomeForm(true); }}
            onEditIncome={(i) => { setEditingIncome(i); setShowIncomeForm(true); }}
            onDeleteIncome={(id) => deleteIncome(activityId, id)}
            onMarkReceived={(id) => markIncomeReceived(activityId, id)}
          />
        )}
      </div>

      {/* Modals */}
      {showEditForm && (
        <ActivityForm activity={activity} onClose={() => setShowEditForm(false)} />
      )}
      {showExpenseForm && (
        <ExpenseForm
          activityId={activityId}
          expense={editingExpense}
          onClose={() => { setShowExpenseForm(false); setEditingExpense(null); }}
        />
      )}
      {showIncomeForm && (
        <IncomeForm
          activityId={activityId}
          income={editingIncome}
          onClose={() => { setShowIncomeForm(false); setEditingIncome(null); }}
        />
      )}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 mx-4 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Delete Activity</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Are you sure you want to delete "{activity.name}"? This will also delete all associated expenses and income. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function OverviewTab({
  activity, financials, cooperator, expenses,
  confirmedCount, pendingCount, uniqueCategories,
  categoryBreakdown, expandedCategory, setExpandedCategory,
}: {
  activity: ActivitySummary;
  financials: ActivityFinancials;
  cooperator: { name: string; full_name: string | null; contact_name?: string; email?: string } | undefined;
  expenses: Expense[];
  confirmedCount: number;
  pendingCount: number;
  uniqueCategories: number;
  categoryBreakdown: [number, { name: string; count: number; projected: number; actual: number; expenses: Expense[] }][];
  expandedCategory: number | null;
  setExpandedCategory: (id: number | null) => void;
}) {
  return (
    <>
      {/* Quick Stats */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: 'Total', value: expenses.length },
          { label: 'Confirmed', value: confirmedCount },
          { label: 'Pending', value: pendingCount },
          { label: 'Categories', value: uniqueCategories },
          { label: 'Utilization', value: `${financials.committed_percent}%` },
        ].map(s => (
          <div key={s.label} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{s.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Info Card */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Activity Info</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Cooperator:</span>
            <span className="ml-1 text-gray-900 dark:text-gray-100">{cooperator?.name || '-'}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Location:</span>
            <span className="ml-1 text-gray-900 dark:text-gray-100">{activity.location || '-'}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Start:</span>
            <span className="ml-1 text-gray-900 dark:text-gray-100">{formatDate(activity.start_date)}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">End:</span>
            <span className="ml-1 text-gray-900 dark:text-gray-100">{formatDate(activity.end_date)}</span>
          </div>
          {activity.cdfa_activity_id && (
            <div className="col-span-2">
              <span className="text-gray-500 dark:text-gray-400">CDFA ID:</span>
              <span className="ml-1 text-gray-900 dark:text-gray-100">{activity.cdfa_activity_id}</span>
            </div>
          )}
        </div>
        {activity.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
            {activity.description}
          </p>
        )}
      </div>

      {/* Budget Progress */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Net Budget Progress</h3>
        {/* Progress bar */}
        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden mb-3">
          <div className="h-full flex">
            <div
              className="bg-green-500 transition-all"
              style={{ width: `${Math.min(financials.utilization_percent, 100)}%` }}
            />
            <div
              className="bg-blue-300 dark:bg-blue-600 transition-all"
              style={{
                width: `${Math.max(0, Math.min(financials.committed_percent - financials.utilization_percent, 100 - financials.utilization_percent))}%`,
              }}
            />
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Actual
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-300 dark:bg-blue-600 inline-block" /> Projected
          </span>
        </div>

        {/* Breakdown table */}
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
            {[
              { label: 'Budget', value: activity.budget, cls: '' },
              { label: 'Expenses Committed', value: financials.total_committed, cls: '' },
              { label: 'Income', value: financials.total_income_committed, cls: 'text-green-600 dark:text-green-400' },
              { label: 'Net Committed', value: financials.net_committed, cls: 'font-semibold' },
              { label: 'Available', value: financials.net_available_budget, cls: financials.net_available_budget < 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-green-600 dark:text-green-400 font-semibold' },
            ].map(row => (
              <tr key={row.label}>
                <td className="py-1.5 text-gray-600 dark:text-gray-400">{row.label}</td>
                <td className={`py-1.5 text-right ${row.cls}`}>{formatCurrency(row.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Category Breakdown */}
      {categoryBreakdown.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Budget by Category</h3>
          {/* Stacked bar */}
          <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden mb-3 flex">
            {categoryBreakdown.map(([catId, cat], i) => {
              const total = cat.actual + cat.projected;
              const pct = activity.budget > 0 ? (total / activity.budget) * 100 : 0;
              const colors = ['bg-blue-500', 'bg-green-500', 'bg-amber-500', 'bg-purple-500', 'bg-red-500', 'bg-cyan-500'];
              return (
                <div
                  key={catId}
                  className={`${colors[i % colors.length]} transition-all`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                  title={`${cat.name}: ${formatCurrency(total)}`}
                />
              );
            })}
          </div>

          <div className="space-y-1">
            {categoryBreakdown.map(([catId, cat]) => (
              <div key={catId}>
                <button
                  onClick={() => setExpandedCategory(expandedCategory === catId ? null : catId)}
                  className="w-full flex items-center justify-between py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-600/50 rounded px-2 transition-colors"
                >
                  <span className="text-gray-700 dark:text-gray-300">
                    {cat.name} <span className="text-gray-400">({cat.count})</span>
                  </span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                    {formatCurrency(cat.actual + cat.projected)}
                  </span>
                </button>
                {expandedCategory === catId && (
                  <div className="ml-4 mb-2 space-y-1">
                    {cat.expenses.map(e => (
                      <div key={e.id} className="flex justify-between text-xs text-gray-500 dark:text-gray-400 py-0.5">
                        <span className="truncate mr-2">{e.description}</span>
                        <span className={e.actual_amount ? 'text-green-600 dark:text-green-400' : ''}>
                          {formatCurrency(e.actual_amount ?? e.projected_amount ?? 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function ExpensesTab({
  expenses, expenseSort, setExpenseSort,
  onAddExpense, onEditExpense, onDeleteExpense, onConvertExpense, onDuplicateExpense,
  showBulkAdd, setShowBulkAdd, bulkRows, setBulkRows, onBulkSubmit, categories,
}: {
  expenses: Expense[];
  expenseSort: string;
  setExpenseSort: (s: 'date' | 'category' | 'amount' | 'status') => void;
  onAddExpense: () => void;
  onEditExpense: (e: Expense) => void;
  onDeleteExpense: (id: number) => void;
  onConvertExpense: (id: number) => void;
  onDuplicateExpense: (id: number) => void;
  showBulkAdd: boolean;
  setShowBulkAdd: (v: boolean) => void;
  bulkRows: Array<{ categoryId: string; description: string; amount: string; date: string }>;
  setBulkRows: (rows: Array<{ categoryId: string; description: string; amount: string; date: string }>) => void;
  onBulkSubmit: () => void;
  categories: { id: number; name: string }[];
}) {
  const inputCls = 'w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100';

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 dark:text-gray-400">Sort:</label>
          <select
            value={expenseSort}
            onChange={e => setExpenseSort(e.target.value as 'date' | 'category' | 'amount' | 'status')}
            className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="date">Date</option>
            <option value="category">Category</option>
            <option value="amount">Amount</option>
            <option value="status">Status</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulkAdd(!showBulkAdd)}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Bulk Add
          </button>
          <button
            onClick={onAddExpense}
            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            + Add Expense
          </button>
        </div>
      </div>

      {/* Bulk Add Form */}
      {showBulkAdd && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Bulk Add Expenses</h4>
          {bulkRows.map((row, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <select
                value={row.categoryId}
                onChange={e => {
                  const newRows = [...bulkRows];
                  newRows[i] = { ...row, categoryId: e.target.value };
                  setBulkRows(newRows);
                }}
                className={`col-span-3 ${inputCls}`}
              >
                <option value="">Category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input
                value={row.description}
                onChange={e => {
                  const newRows = [...bulkRows];
                  newRows[i] = { ...row, description: e.target.value };
                  setBulkRows(newRows);
                }}
                placeholder="Description"
                className={`col-span-4 ${inputCls}`}
              />
              <input
                value={row.amount}
                onChange={e => {
                  const newRows = [...bulkRows];
                  newRows[i] = { ...row, amount: e.target.value };
                  setBulkRows(newRows);
                }}
                placeholder="$0"
                className={`col-span-2 ${inputCls}`}
              />
              <input
                type="date"
                value={row.date}
                onChange={e => {
                  const newRows = [...bulkRows];
                  newRows[i] = { ...row, date: e.target.value };
                  setBulkRows(newRows);
                }}
                className={`col-span-2 ${inputCls}`}
              />
              <button
                onClick={() => setBulkRows(bulkRows.filter((_, j) => j !== i))}
                className="col-span-1 text-gray-400 hover:text-red-500 text-sm"
              >
                x
              </button>
            </div>
          ))}
          <div className="flex justify-between">
            <button
              onClick={() => setBulkRows([...bulkRows, { categoryId: '', description: '', amount: '', date: '' }])}
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              + Add Row
            </button>
            <div className="flex gap-2">
              <button onClick={() => setShowBulkAdd(false)} className="px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                Cancel
              </button>
              <button onClick={onBulkSubmit} className="px-3 py-1 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors">
                Add All
              </button>
            </div>
          </div>
        </div>
      )}

      {expenses.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
          No expenses yet. Click "Add Expense" to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map(expense => (
            <div key={expense.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{expense.description}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{expense.category_name}</p>
                </div>
                <StatusBadge status={expense.status} />
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex gap-4 text-xs text-gray-600 dark:text-gray-400">
                  {expense.projected_amount != null && (
                    <span>Proj: {formatCurrency(expense.projected_amount)}</span>
                  )}
                  {expense.actual_amount != null && (
                    <span className="text-green-600 dark:text-green-400">Act: {formatCurrency(expense.actual_amount)}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {expense.status === 'projected' && (
                    <button
                      onClick={() => onConvertExpense(expense.id)}
                      className="px-2 py-0.5 text-xs text-green-600 hover:text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors"
                      title="Convert to Actual"
                    >
                      Confirm
                    </button>
                  )}
                  <button
                    onClick={() => onDuplicateExpense(expense.id)}
                    className="px-2 py-0.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                    title="Duplicate"
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
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function IncomeTab({
  income,
  onAddIncome, onEditIncome, onDeleteIncome, onMarkReceived,
}: {
  income: Income[];
  onAddIncome: () => void;
  onEditIncome: (i: Income) => void;
  onDeleteIncome: (id: number) => void;
  onMarkReceived: (id: number) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-end">
        <button
          onClick={onAddIncome}
          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          + Add Income
        </button>
      </div>

      {income.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
          No income recorded. Click "Add Income" to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {income.map(item => (
            <div key={item.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.description}</p>
                  {item.source && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.source}</p>}
                </div>
                <StatusBadge status={item.status} />
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex gap-4 text-xs text-gray-600 dark:text-gray-400">
                  {item.projected_amount != null && (
                    <span>Expected: {formatCurrency(item.projected_amount)}</span>
                  )}
                  {item.actual_amount != null && (
                    <span className="text-green-600 dark:text-green-400">Received: {formatCurrency(item.actual_amount)}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {item.status === 'projected' && (
                    <button
                      onClick={() => onMarkReceived(item.id)}
                      className="px-2 py-0.5 text-xs text-green-600 hover:text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors"
                    >
                      Mark Received
                    </button>
                  )}
                  <button
                    onClick={() => onEditIncome(item)}
                    className="px-2 py-0.5 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDeleteIncome(item.id)}
                    className="px-2 py-0.5 text-xs text-red-500 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                  >
                    Del
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
