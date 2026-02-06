import { useState, useMemo } from 'react';
import { useBudget } from '../context/BudgetContext';
import { downloadCSV } from '../utils/exportCsv';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

type ReportType = 'budget-summary' | 'category-breakdown' | 'expected-charges' | 'cooperator-billing';

export default function ReportsView() {
  const { activities, allExpenses, cooperators, categories } = useBudget();
  const [activeReport, setActiveReport] = useState<ReportType>('budget-summary');
  const [billingCooperator, setBillingCooperator] = useState<number | ''>('');
  const [billingActivity, setBillingActivity] = useState<number | ''>('');
  const [expectedFilter, setExpectedFilter] = useState<'all' | number>('all');

  const reports: { id: ReportType; label: string; description: string }[] = [
    { id: 'budget-summary', label: 'Budget Summary', description: 'Overview by cooperator' },
    { id: 'category-breakdown', label: 'Category Breakdown', description: 'Spending by category' },
    { id: 'expected-charges', label: 'Expected Charges', description: 'Projected expenses' },
    { id: 'cooperator-billing', label: 'Cooperator Billing', description: 'Billing detail' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reports</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Generate and export budget reports</p>
      </div>

      {/* Report Selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {reports.map(r => (
          <button
            key={r.id}
            onClick={() => setActiveReport(r.id)}
            className={`p-3 rounded-lg border text-left transition-colors ${
              activeReport === r.id
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <p className={`text-sm font-medium ${activeReport === r.id ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'}`}>
              {r.label}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{r.description}</p>
          </button>
        ))}
      </div>

      {/* Report Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        {activeReport === 'budget-summary' && (
          <BudgetSummaryReport activities={activities} allExpenses={allExpenses} cooperators={cooperators} />
        )}
        {activeReport === 'category-breakdown' && (
          <CategoryBreakdownReport activities={activities} allExpenses={allExpenses} categories={categories} />
        )}
        {activeReport === 'expected-charges' && (
          <ExpectedChargesReport
            activities={activities}
            allExpenses={allExpenses}
            cooperators={cooperators}
            filter={expectedFilter}
            setFilter={setExpectedFilter}
          />
        )}
        {activeReport === 'cooperator-billing' && (
          <CooperatorBillingReport
            activities={activities}
            allExpenses={allExpenses}
            cooperators={cooperators}
            selectedCooperator={billingCooperator}
            setSelectedCooperator={setBillingCooperator}
            selectedActivity={billingActivity}
            setSelectedActivity={setBillingActivity}
          />
        )}
      </div>
    </div>
  );
}

// --- Budget Summary Report ---
function BudgetSummaryReport({
  activities, allExpenses, cooperators,
}: {
  activities: { id: number; name: string; cooperator_id: number; budget: number; total_actual: number; total_committed: number }[];
  allExpenses: Record<number, { projected_amount: number | null }[]>;
  cooperators: { id: number; name: string }[];
}) {
  const grouped = useMemo(() => {
    const map = new Map<number, { name: string; items: typeof activities }>();
    for (const a of activities) {
      const coop = cooperators.find(c => c.id === a.cooperator_id);
      const name = coop?.name || 'Unknown';
      if (!map.has(a.cooperator_id)) {
        map.set(a.cooperator_id, { name, items: [] });
      }
      map.get(a.cooperator_id)!.items.push(a);
    }
    return Array.from(map.entries());
  }, [activities, cooperators]);

  const grandTotals = useMemo(() => ({
    budget: activities.reduce((s, a) => s + a.budget, 0),
    projected: Object.values(allExpenses).flat().reduce((s, e) => s + (e.projected_amount ?? 0), 0),
    actual: activities.reduce((s, a) => s + a.total_actual, 0),
    committed: activities.reduce((s, a) => s + a.total_committed, 0),
  }), [activities, allExpenses]);

  const exportReport = () => {
    const headers = ['Cooperator', 'Activity', 'Budget', 'Projected', 'Actual', 'Committed'];
    const rows: string[][] = [];
    for (const [, group] of grouped) {
      for (const a of group.items) {
        const projTotal = (allExpenses[a.id] || []).reduce((s, e) => s + (e.projected_amount ?? 0), 0);
        rows.push([group.name, a.name, a.budget.toString(), projTotal.toString(), a.total_actual.toString(), a.total_committed.toString()]);
      }
    }
    rows.push(['TOTAL', '', grandTotals.budget.toString(), grandTotals.projected.toString(), grandTotals.actual.toString(), grandTotals.committed.toString()]);
    downloadCSV(headers, rows, 'budget-summary.csv');
  };

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Budget Summary</h2>
        <button onClick={exportReport} className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Activity</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Budget</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Projected</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Actual</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Committed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {grouped.map(([coopId, group]) => {
              const subtotals = {
                budget: group.items.reduce((s, a) => s + a.budget, 0),
                projected: group.items.reduce((s, a) => s + (allExpenses[a.id] || []).reduce((s2, e) => s2 + (e.projected_amount ?? 0), 0), 0),
                actual: group.items.reduce((s, a) => s + a.total_actual, 0),
                committed: group.items.reduce((s, a) => s + a.total_committed, 0),
              };
              return (
                <tbody key={coopId}>
                  <tr className="bg-gray-100 dark:bg-gray-700">
                    <td colSpan={5} className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300">{group.name}</td>
                  </tr>
                  {group.items.map(a => {
                    const projTotal = (allExpenses[a.id] || []).reduce((s, e) => s + (e.projected_amount ?? 0), 0);
                    return (
                      <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-2 pl-8 text-sm text-gray-900 dark:text-gray-100">{a.name}</td>
                        <td className="px-4 py-2 text-right text-sm text-gray-900 dark:text-gray-100">{formatCurrency(a.budget)}</td>
                        <td className="px-4 py-2 text-right text-sm text-gray-600 dark:text-gray-400">{formatCurrency(projTotal)}</td>
                        <td className="px-4 py-2 text-right text-sm text-gray-900 dark:text-gray-100">{formatCurrency(a.total_actual)}</td>
                        <td className="px-4 py-2 text-right text-sm font-medium text-gray-900 dark:text-gray-100">{formatCurrency(a.total_committed)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-50 dark:bg-gray-700/30">
                    <td className="px-4 py-1.5 pl-8 text-xs font-medium text-gray-500 dark:text-gray-400">Subtotal</td>
                    <td className="px-4 py-1.5 text-right text-xs font-medium text-gray-700 dark:text-gray-300">{formatCurrency(subtotals.budget)}</td>
                    <td className="px-4 py-1.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400">{formatCurrency(subtotals.projected)}</td>
                    <td className="px-4 py-1.5 text-right text-xs font-medium text-gray-700 dark:text-gray-300">{formatCurrency(subtotals.actual)}</td>
                    <td className="px-4 py-1.5 text-right text-xs font-medium text-gray-700 dark:text-gray-300">{formatCurrency(subtotals.committed)}</td>
                  </tr>
                </tbody>
              );
            })}
            <tr className="bg-gray-100 dark:bg-gray-600 font-bold">
              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">Grand Total</td>
              <td className="px-4 py-2 text-right text-sm text-gray-900 dark:text-gray-100">{formatCurrency(grandTotals.budget)}</td>
              <td className="px-4 py-2 text-right text-sm text-gray-600 dark:text-gray-400">{formatCurrency(grandTotals.projected)}</td>
              <td className="px-4 py-2 text-right text-sm text-gray-900 dark:text-gray-100">{formatCurrency(grandTotals.actual)}</td>
              <td className="px-4 py-2 text-right text-sm text-gray-900 dark:text-gray-100">{formatCurrency(grandTotals.committed)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Category Breakdown Report ---
function CategoryBreakdownReport({
  activities, allExpenses, categories,
}: {
  activities: { id: number }[];
  allExpenses: Record<number, { category_id: number; projected_amount: number | null; actual_amount: number | null }[]>;
  categories: { id: number; name: string }[];
}) {
  const data = useMemo(() => {
    const map = new Map<number, { name: string; count: number; projected: number; actual: number }>();
    for (const a of activities) {
      for (const e of allExpenses[a.id] || []) {
        const cat = categories.find(c => c.id === e.category_id);
        const existing = map.get(e.category_id) || { name: cat?.name || 'Unknown', count: 0, projected: 0, actual: 0 };
        existing.count++;
        existing.projected += e.projected_amount ?? 0;
        existing.actual += e.actual_amount ?? 0;
        map.set(e.category_id, existing);
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1].actual - a[1].actual);
  }, [activities, allExpenses, categories]);

  const totalActual = data.reduce((s, [, d]) => s + d.actual, 0);

  const exportReport = () => {
    const headers = ['Category', '# Expenses', 'Projected', 'Actual', '% of Total'];
    const rows = data.map(([, d]) => [
      d.name,
      d.count.toString(),
      d.projected.toString(),
      d.actual.toString(),
      totalActual > 0 ? `${Math.round((d.actual / totalActual) * 100)}%` : '0%',
    ]);
    downloadCSV(headers, rows, 'category-breakdown.csv');
  };

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Category Breakdown</h2>
        <button onClick={exportReport} className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
          Export CSV
        </button>
      </div>
      {data.length === 0 ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">No expense data available.</div>
      ) : (
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Category</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400"># Expenses</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Projected</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Actual</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">% of Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.map(([catId, d]) => (
              <tr key={catId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{d.name}</td>
                <td className="px-4 py-2 text-right text-sm text-gray-600 dark:text-gray-400">{d.count}</td>
                <td className="px-4 py-2 text-right text-sm text-gray-600 dark:text-gray-400">{formatCurrency(d.projected)}</td>
                <td className="px-4 py-2 text-right text-sm text-gray-900 dark:text-gray-100">{formatCurrency(d.actual)}</td>
                <td className="px-4 py-2 text-right text-sm text-gray-600 dark:text-gray-400">
                  {totalActual > 0 ? `${Math.round((d.actual / totalActual) * 100)}%` : '0%'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// --- Expected Charges Report ---
function ExpectedChargesReport({
  activities, allExpenses, cooperators, filter, setFilter,
}: {
  activities: { id: number; name: string; cooperator_id: number }[];
  allExpenses: Record<number, { id: number; category_name: string; description: string; projected_amount: number | null; projected_date: string | null; status: string }[]>;
  cooperators: { id: number; name: string }[];
  filter: 'all' | number;
  setFilter: (f: 'all' | number) => void;
}) {
  const filteredActivities = filter === 'all'
    ? activities
    : activities.filter(a => a.cooperator_id === filter || a.id === filter);

  const grouped = useMemo(() => {
    const map = new Map<string, { expenses: { id: number; description: string; projected_amount: number | null; projected_date: string | null; activityName: string }[]; subtotal: number }>();
    for (const a of filteredActivities) {
      for (const e of (allExpenses[a.id] || []).filter(e => e.status === 'projected')) {
        const cat = e.category_name;
        if (!map.has(cat)) map.set(cat, { expenses: [], subtotal: 0 });
        const group = map.get(cat)!;
        group.expenses.push({ id: e.id, description: e.description, projected_amount: e.projected_amount, projected_date: e.projected_date, activityName: a.name });
        group.subtotal += e.projected_amount ?? 0;
      }
    }
    return Array.from(map.entries());
  }, [filteredActivities, allExpenses]);

  const grandTotal = grouped.reduce((s, [, g]) => s + g.subtotal, 0);

  const exportReport = () => {
    const headers = ['Category', 'Activity', 'Description', 'Projected Amount', 'Projected Date'];
    const rows: string[][] = [];
    for (const [cat, group] of grouped) {
      for (const e of group.expenses) {
        rows.push([cat, e.activityName, e.description, (e.projected_amount ?? 0).toString(), e.projected_date || '']);
      }
    }
    downloadCSV(headers, rows, 'expected-charges.csv');
  };

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Expected Charges</h2>
        <div className="flex items-center gap-2">
          <select
            value={typeof filter === 'number' ? filter : 'all'}
            onChange={e => setFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="all">All</option>
            <optgroup label="Cooperators">
              {cooperators.map(c => <option key={`c-${c.id}`} value={c.id}>{c.name}</option>)}
            </optgroup>
          </select>
          <button onClick={exportReport} className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
            Export CSV
          </button>
        </div>
      </div>
      {grouped.length === 0 ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">No projected expenses found.</div>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {grouped.map(([cat, group]) => (
            <div key={cat}>
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 flex justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{cat}</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatCurrency(group.subtotal)}</span>
              </div>
              {group.expenses.map(e => (
                <div key={e.id} className="px-4 pl-8 py-2 flex justify-between text-sm">
                  <div>
                    <span className="text-gray-900 dark:text-gray-100">{e.description}</span>
                    <span className="text-gray-400 dark:text-gray-500 ml-2 text-xs">{e.activityName}</span>
                  </div>
                  <span className="text-gray-600 dark:text-gray-400">{formatCurrency(e.projected_amount ?? 0)}</span>
                </div>
              ))}
            </div>
          ))}
          <div className="px-4 py-2 bg-gray-100 dark:bg-gray-600 flex justify-between font-bold text-sm">
            <span className="text-gray-900 dark:text-gray-100">Total Expected</span>
            <span className="text-gray-900 dark:text-gray-100">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Cooperator Billing Report ---
function CooperatorBillingReport({
  activities, allExpenses, cooperators,
  selectedCooperator, setSelectedCooperator,
  selectedActivity, setSelectedActivity,
}: {
  activities: { id: number; name: string; cooperator_id: number }[];
  allExpenses: Record<number, { id: number; description: string; category_name: string; actual_amount: number | null; actual_date: string | null; receipt_reference: string | null }[]>;
  cooperators: { id: number; name: string }[];
  selectedCooperator: number | '';
  setSelectedCooperator: (v: number | '') => void;
  selectedActivity: number | '';
  setSelectedActivity: (v: number | '') => void;
}) {
  const coopActivities = selectedCooperator
    ? activities.filter(a => a.cooperator_id === selectedCooperator)
    : [];

  const filteredActivities = selectedActivity
    ? coopActivities.filter(a => a.id === selectedActivity)
    : coopActivities;

  const data = useMemo(() => {
    return filteredActivities.map(a => ({
      activity: a,
      expenses: (allExpenses[a.id] || []).filter(e => e.actual_amount != null),
    }));
  }, [filteredActivities, allExpenses]);

  const grandTotal = data.reduce((s, d) => s + d.expenses.reduce((s2, e) => s2 + (e.actual_amount ?? 0), 0), 0);

  const exportReport = () => {
    const headers = ['Activity', 'Date', 'Category', 'Description', 'Receipt Ref', 'Amount'];
    const rows: string[][] = [];
    for (const d of data) {
      for (const e of d.expenses) {
        rows.push([
          d.activity.name,
          e.actual_date || '',
          e.category_name,
          e.description,
          e.receipt_reference || '',
          (e.actual_amount ?? 0).toString(),
        ]);
      }
    }
    downloadCSV(headers, rows, `billing-${cooperators.find(c => c.id === selectedCooperator)?.name || 'report'}.csv`);
  };

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cooperator Billing</h2>
        <div className="flex items-center gap-2">
          <select
            value={selectedCooperator}
            onChange={e => { setSelectedCooperator(e.target.value ? Number(e.target.value) : ''); setSelectedActivity(''); }}
            className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="">Select cooperator...</option>
            {cooperators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {coopActivities.length > 1 && (
            <select
              value={selectedActivity}
              onChange={e => setSelectedActivity(e.target.value ? Number(e.target.value) : '')}
              className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">All Activities</option>
              {coopActivities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          {selectedCooperator && (
            <button onClick={exportReport} className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
              Export CSV
            </button>
          )}
        </div>
      </div>

      {!selectedCooperator ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
          Select a cooperator to view billing details.
        </div>
      ) : data.every(d => d.expenses.length === 0) ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
          No actual expenses found for this cooperator.
        </div>
      ) : (
        <div>
          {data.map(d => d.expenses.length > 0 && (
            <div key={d.activity.id}>
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{d.activity.name}</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Date</th>
                    <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Category</th>
                    <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Description</th>
                    <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Receipt</th>
                    <th className="px-4 py-1.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {d.expenses.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-1.5 text-xs text-gray-600 dark:text-gray-400">{e.actual_date || '-'}</td>
                      <td className="px-4 py-1.5 text-xs text-gray-600 dark:text-gray-400">{e.category_name}</td>
                      <td className="px-4 py-1.5 text-sm text-gray-900 dark:text-gray-100">{e.description}</td>
                      <td className="px-4 py-1.5 text-xs text-gray-500 dark:text-gray-400">{e.receipt_reference || '-'}</td>
                      <td className="px-4 py-1.5 text-right text-sm text-gray-900 dark:text-gray-100">{formatCurrency(e.actual_amount ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-gray-700/30">
                    <td colSpan={4} className="px-4 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">Subtotal</td>
                    <td className="px-4 py-1.5 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(d.expenses.reduce((s, e) => s + (e.actual_amount ?? 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}
          <div className="px-4 py-2 bg-gray-100 dark:bg-gray-600 flex justify-between font-bold text-sm">
            <span className="text-gray-900 dark:text-gray-100">Grand Total</span>
            <span className="text-gray-900 dark:text-gray-100">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
