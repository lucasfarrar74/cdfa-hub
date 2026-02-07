import { useState, useMemo, Fragment } from 'react';
import { useBudget } from '../context/BudgetContext';
import type { ActivitySummary, Expense, Income, ActivityFinancials, Participant } from '../types';
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

const CATEGORY_COLORS = ['#0d6efd', '#6610f2', '#6f42c1', '#d63384', '#dc3545', '#fd7e14', '#ffc107', '#20c997', '#198754', '#0dcaf0'];

type DetailTab = 'overview' | 'expenses' | 'income' | 'participants';

interface ActivityDetailPageProps {
  activityId: number;
  onBack: () => void;
}

export default function ActivityDetailPage({ activityId, onBack }: ActivityDetailPageProps) {
  const {
    activities, cooperators, allExpenses, allIncome, categories, participants,
    updateActivity, deleteActivity, deleteExpense, convertExpenseToActual,
    duplicateExpense, deleteIncome, markIncomeReceived, createExpense,
    computeActivityFinancials, createParticipant, updateParticipant,
    archiveParticipant, unarchiveParticipant, deleteParticipant,
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

  // Participants scoped to this activity + global participants used in this activity's expenses
  const activityParticipants = useMemo(() => {
    const activityScoped = participants.filter(p => p.activity_id === activityId);
    const expenseParticipantIds = new Set<number>();
    expenses.forEach(e => e.participants.forEach(p => expenseParticipantIds.add(p.id)));
    const globalUsed = participants.filter(p => p.activity_id === null && expenseParticipantIds.has(p.id));
    const ids = new Set(activityScoped.map(p => p.id));
    globalUsed.forEach(p => { if (!ids.has(p.id)) activityScoped.push(p); });
    return activityScoped;
  }, [participants, activityId, expenses]);

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
    return Array.from(map.entries()).sort((a, b) => (b[1].actual + b[1].projected) - (a[1].actual + a[1].projected));
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
    onBack();
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

  const confirmedCount = expenses.filter(e => e.status === 'actual').length;
  const pendingCount = expenses.filter(e => e.status === 'projected').length;
  const uniqueCategories = new Set(expenses.map(e => e.category_id)).size;

  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'expenses', label: `Expenses (${expenses.length})` },
    { id: 'income', label: `Income (${income.length})` },
    { id: 'participants', label: `Participants (${activityParticipants.length})` },
  ];

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <button
                onClick={onBack}
                className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Activities
              </button>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
                  {activity.name}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3 ml-4 shrink-0">
              <select
                value={activity.status}
                onChange={e => handleStatusChange(e.target.value as 'planning' | 'active' | 'completed')}
                className="text-sm px-3 py-1.5 rounded-lg border-0 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 cursor-pointer focus:ring-1 focus:ring-blue-500"
              >
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
              <button onClick={() => setShowEditForm(true)} className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Edit">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button onClick={() => setShowDeleteConfirm(true)} className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Delete">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6">
          <div className="flex space-x-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
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
      </div>

      {/* Content */}
      <div className="mt-4">
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

        {activeTab === 'participants' && (
          <ParticipantsTab
            activityId={activityId}
            activityParticipants={activityParticipants}
            allExpenses={allExpenses}
            createParticipant={createParticipant}
            updateParticipant={updateParticipant}
            archiveParticipant={archiveParticipant}
            unarchiveParticipant={unarchiveParticipant}
            deleteParticipant={deleteParticipant}
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

// --- Overview Sub-tab ---

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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left Column */}
      <div className="space-y-4">
        {/* Quick Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Total', value: expenses.length },
              { label: 'Confirmed', value: confirmedCount },
              { label: 'Pending', value: pendingCount },
              { label: 'Categories', value: uniqueCategories },
              { label: 'Utilization', value: `${financials.committed_percent}%` },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{s.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2">
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
      </div>

      {/* Right Column */}
      <div className="space-y-4">
        {/* Budget Progress */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Net Budget Progress</h3>
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
        {categoryBreakdown.length > 0 && (() => {
          const totalCommitted = categoryBreakdown.reduce((s, [, c]) => s + c.actual + c.projected, 0);
          const totalActual = categoryBreakdown.reduce((s, [, c]) => s + c.actual, 0);
          const totalProjected = categoryBreakdown.reduce((s, [, c]) => s + c.projected, 0);
          const totalExpenses = categoryBreakdown.reduce((s, [, c]) => s + c.count, 0);
          const availableBudget = Math.max(0, activity.budget - totalCommitted);
          const availablePct = activity.budget > 0 ? (availableBudget / activity.budget) * 100 : 0;

          return (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Budget by Category</h3>

              {/* Stacked Bar - 32px */}
              <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded-lg overflow-hidden mb-3 flex">
                {categoryBreakdown.map(([catId, cat], i) => {
                  const total = cat.actual + cat.projected;
                  const pct = activity.budget > 0 ? (total / activity.budget) * 100 : 0;
                  return (
                    <div
                      key={catId}
                      className="h-full flex items-center justify-center overflow-hidden transition-all"
                      style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                      title={`${cat.name}: ${formatCurrency(total)}`}
                    >
                      {pct > 8 && (
                        <span className="text-white text-xs font-medium truncate px-1">{cat.name}</span>
                      )}
                    </div>
                  );
                })}
                {availablePct > 0 && (
                  <div
                    className="h-full flex items-center justify-center overflow-hidden bg-gray-400 dark:bg-gray-500"
                    style={{ width: `${availablePct}%` }}
                    title={`Available: ${formatCurrency(availableBudget)}`}
                  >
                    {availablePct > 8 && (
                      <span className="text-white text-xs font-medium truncate px-1">Available</span>
                    )}
                  </div>
                )}
              </div>

              {/* Color Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4">
                {categoryBreakdown.map(([catId, cat], i) => (
                  <div key={catId} className="flex items-center gap-1.5">
                    <span
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-400">{cat.name}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm shrink-0 bg-gray-400 dark:bg-gray-500" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">Available</span>
                </div>
              </div>

              {/* Category Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-600">
                      <th className="py-2 pr-2 text-left font-medium text-gray-700 dark:text-gray-300">Category</th>
                      <th className="py-2 px-2 text-right font-medium text-gray-700 dark:text-gray-300">Expenses</th>
                      <th className="py-2 px-2 text-right font-medium text-gray-700 dark:text-gray-300">Actual</th>
                      <th className="py-2 px-2 text-right font-medium text-gray-700 dark:text-gray-300">Projected</th>
                      <th className="py-2 px-2 text-right font-medium text-gray-700 dark:text-gray-300">Committed</th>
                      <th className="py-2 pl-2 text-right font-medium text-gray-700 dark:text-gray-300">% of Budget</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryBreakdown.map(([catId, cat], i) => {
                      const committed = cat.actual + cat.projected;
                      const pct = activity.budget > 0 ? (committed / activity.budget) * 100 : 0;
                      const isExpanded = expandedCategory === catId;

                      return (
                        <Fragment key={catId}>
                          <tr
                            onClick={() => setExpandedCategory(isExpanded ? null : catId)}
                            className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700"
                          >
                            <td className="py-2 pr-2">
                              <div className="flex items-center gap-2">
                                <svg
                                  className={`w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                                />
                                <span className="text-gray-900 dark:text-gray-100">{cat.name}</span>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-right text-gray-600 dark:text-gray-400">{cat.count}</td>
                            <td className="py-2 px-2 text-right text-gray-600 dark:text-gray-400">{formatCurrency(cat.actual)}</td>
                            <td className="py-2 px-2 text-right text-gray-600 dark:text-gray-400">{formatCurrency(cat.projected)}</td>
                            <td className="py-2 px-2 text-right font-medium text-gray-900 dark:text-gray-100">{formatCurrency(committed)}</td>
                            <td className="py-2 pl-2 text-right text-gray-600 dark:text-gray-400">{pct.toFixed(1)}%</td>
                          </tr>

                          {/* Expanded expenses */}
                          {isExpanded && cat.expenses.map(e => (
                            <tr key={e.id} className="bg-gray-50 dark:bg-gray-700/30">
                              <td colSpan={4} className="py-1.5 pl-10 pr-2">
                                <span className="text-xs text-gray-700 dark:text-gray-300">{e.description}</span>
                              </td>
                              <td className="py-1.5 px-2 text-right">
                                <span className={`text-xs ${e.actual_amount ? 'text-green-600 dark:text-green-400 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                                  {formatCurrency(e.actual_amount ?? e.projected_amount ?? 0)}
                                </span>
                              </td>
                              <td className="py-1.5 pl-2 text-right">
                                <StatusBadge status={e.status} />
                              </td>
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 dark:border-gray-500 font-semibold">
                      <td className="py-2 pr-2 text-left text-gray-900 dark:text-gray-100">Total</td>
                      <td className="py-2 px-2 text-right text-gray-900 dark:text-gray-100">{totalExpenses}</td>
                      <td className="py-2 px-2 text-right text-gray-900 dark:text-gray-100">{formatCurrency(totalActual)}</td>
                      <td className="py-2 px-2 text-right text-gray-900 dark:text-gray-100">{formatCurrency(totalProjected)}</td>
                      <td className="py-2 px-2 text-right text-gray-900 dark:text-gray-100">{formatCurrency(totalCommitted)}</td>
                      <td className="py-2 pl-2 text-right text-gray-900 dark:text-gray-100">
                        {activity.budget > 0 ? ((totalCommitted / activity.budget) * 100).toFixed(1) : '0.0'}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// --- Expenses Sub-tab (full table layout) ---

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 dark:text-gray-400">Sort:</label>
          <select
            value={expenseSort}
            onChange={e => setExpenseSort(e.target.value as 'date' | 'category' | 'amount' | 'status')}
            className="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Bulk Add
          </button>
          <button
            onClick={onAddExpense}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            + Add Expense
          </button>
        </div>
      </div>

      {/* Bulk Add Form */}
      {showBulkAdd && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
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
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              + Add Row
            </button>
            <div className="flex gap-2">
              <button onClick={() => setShowBulkAdd(false)} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                Cancel
              </button>
              <button onClick={onBulkSubmit} className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                Add All
              </button>
            </div>
          </div>
        </div>
      )}

      {expenses.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
          No expenses yet. Click "Add Expense" to get started.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Description</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Category</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Projected</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Actual</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {expenses.map(expense => (
                  <tr key={expense.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{expense.description}</p>
                      {expense.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-xs">{expense.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{expense.category_name}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">
                      {expense.projected_amount != null ? formatCurrency(expense.projected_amount) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-green-600 dark:text-green-400">
                      {expense.actual_amount != null ? formatCurrency(expense.actual_amount) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={expense.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
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
          </div>
        </div>
      )}
    </div>
  );
}

// --- Income Sub-tab (full table layout) ---

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
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button
          onClick={onAddIncome}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          + Add Income
        </button>
      </div>

      {income.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
          No income recorded. Click "Add Income" to get started.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Description</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Source</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Expected</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Received</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {income.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.description}</p>
                      {item.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-xs">{item.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{item.source || '-'}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">
                      {item.projected_amount != null ? formatCurrency(item.projected_amount) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-green-600 dark:text-green-400">
                      {item.actual_amount != null ? formatCurrency(item.actual_amount) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Participants Sub-tab ---

function ParticipantsTab({
  activityId,
  activityParticipants,
  allExpenses,
  createParticipant,
  updateParticipant,
  archiveParticipant,
  unarchiveParticipant,
  deleteParticipant,
}: {
  activityId: number;
  activityParticipants: Participant[];
  allExpenses: Record<number, Expense[]>;
  createParticipant: (data: { name: string; email?: string; organization?: string; activity_id?: number | null }) => Participant;
  updateParticipant: (id: number, updates: Partial<Participant>) => void;
  archiveParticipant: (id: number) => void;
  unarchiveParticipant: (id: number) => void;
  deleteParticipant: (id: number) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formOrg, setFormOrg] = useState('');
  const [formScope, setFormScope] = useState<'activity' | 'global'>('activity');

  // Count expenses per participant within this activity
  const expenseCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    const expenses = allExpenses[activityId] || [];
    expenses.forEach(e => {
      e.participants.forEach(p => {
        counts[p.id] = (counts[p.id] || 0) + 1;
      });
    });
    return counts;
  }, [allExpenses, activityId]);

  function openCreateForm() {
    setFormName(''); setFormEmail(''); setFormOrg(''); setFormScope('activity');
    setEditingParticipant(null);
    setShowForm(true);
  }

  function openEditForm(p: Participant) {
    setFormName(p.name);
    setFormEmail(p.email || '');
    setFormOrg(p.organization || '');
    setFormScope(p.activity_id === activityId ? 'activity' : 'global');
    setEditingParticipant(p);
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;

    if (editingParticipant) {
      updateParticipant(editingParticipant.id, {
        name: formName.trim(),
        email: formEmail.trim() || null,
        organization: formOrg.trim() || null,
        activity_id: formScope === 'activity' ? activityId : null,
      });
    } else {
      createParticipant({
        name: formName.trim(),
        email: formEmail.trim() || undefined,
        organization: formOrg.trim() || undefined,
        activity_id: formScope === 'activity' ? activityId : null,
      });
    }
    setShowForm(false);
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {activityParticipants.length} participant{activityParticipants.length !== 1 ? 's' : ''} associated with this activity
        </p>
        <button onClick={openCreateForm} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
          + Add Participant
        </button>
      </div>

      {activityParticipants.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
          No participants yet. Add a participant to track who is involved in this activity's expenses.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Organization</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300">Scope</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300">Expenses</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {activityParticipants.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{p.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{p.email || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{p.organization || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.activity_id === activityId
                          ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                      }`}>
                        {p.activity_id === activityId ? 'Activity' : 'Global'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600 dark:text-gray-400">
                      {expenseCounts[p.id] || 0}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEditForm(p)} className="px-2 py-0.5 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400">
                          Edit
                        </button>
                        {p.is_archived ? (
                          <button onClick={() => unarchiveParticipant(p.id)} className="px-2 py-0.5 text-xs text-green-600 hover:text-green-700 dark:text-green-400">
                            Restore
                          </button>
                        ) : (
                          <button onClick={() => archiveParticipant(p.id)} className="px-2 py-0.5 text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400">
                            Archive
                          </button>
                        )}
                        <button onClick={() => deleteParticipant(p.id)} className="px-2 py-0.5 text-xs text-red-500 hover:text-red-700 dark:text-red-400">
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
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
                {editingParticipant ? 'Edit Participant' : 'Add Participant'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                  <input type="text" value={formName} onChange={e => setFormName(e.target.value)} required className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Organization</label>
                  <input type="text" value={formOrg} onChange={e => setFormOrg(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scope</label>
                  <select value={formScope} onChange={e => setFormScope(e.target.value as 'activity' | 'global')} className={inputCls}>
                    <option value="activity">This Activity Only</option>
                    <option value="global">Global (all activities)</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                    {editingParticipant ? 'Update' : 'Create'}
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
