import { useState, useMemo } from 'react';
import { useBudget } from '../context/BudgetContext';
import type { Cooperator, ExpenseCategory, ExpenseTemplate, Participant } from '../types';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

type SettingsTab = 'cooperators' | 'categories' | 'participants' | 'templates' | 'data';

export default function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('cooperators');

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'cooperators', label: 'Cooperators' },
    { id: 'categories', label: 'Categories' },
    { id: 'participants', label: 'Participants' },
    { id: 'templates', label: 'Templates' },
    { id: 'data', label: 'Data' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage reference data and configuration</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex space-x-1 border-b border-gray-200 dark:border-gray-700">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'cooperators' && <CooperatorsSection />}
      {activeTab === 'categories' && <CategoriesSection />}
      {activeTab === 'participants' && <ParticipantsSection />}
      {activeTab === 'templates' && <TemplatesSection />}
      {activeTab === 'data' && <DataSection />}
    </div>
  );
}

// --- Cooperators (card grid + detail panel from CooperatorsPage) ---
function CooperatorsSection() {
  const { cooperators, activities, createCooperator, updateCooperator, deleteCooperator } = useBudget();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Cooperator | null>(null);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [fullName, setFullName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const cooperatorStats = useMemo(() => {
    return cooperators.map(c => {
      const coopActivities = activities.filter(a => a.cooperator_id === c.id);
      return {
        ...c,
        activityCount: coopActivities.length,
        totalBudget: coopActivities.reduce((s, a) => s + a.budget, 0),
        totalActual: coopActivities.reduce((s, a) => s + a.total_actual, 0),
        totalCommitted: coopActivities.reduce((s, a) => s + a.total_committed, 0),
        activities: coopActivities,
      };
    });
  }, [cooperators, activities]);

  const selected = selectedId ? cooperatorStats.find(c => c.id === selectedId) : null;

  const resetForm = () => {
    setName(''); setFullName(''); setContactName(''); setEmail('');
    setPhone(''); setAddress(''); setNotes('');
    setEditing(null); setShowForm(false); setError('');
  };

  const startEdit = (c: Cooperator) => {
    setEditing(c);
    setName(c.name); setFullName(c.full_name || '');
    setContactName(c.contact_name || ''); setEmail(c.email || '');
    setPhone(c.phone || ''); setAddress(c.address || ''); setNotes(c.notes || '');
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const data = {
      name: name.trim(), full_name: fullName.trim() || null,
      contact_name: contactName.trim() || undefined, email: email.trim() || undefined,
      phone: phone.trim() || undefined, address: address.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    if (editing) { updateCooperator(editing.id, data); }
    else { createCooperator(data); }
    resetForm();
  };

  const handleDelete = (id: number) => {
    const success = deleteCooperator(id);
    if (!success) { setError('Cannot delete: cooperator has activities.'); setTimeout(() => setError(''), 3000); }
    else if (selectedId === id) setSelectedId(null);
  };

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">{cooperators.length} cooperator{cooperators.length !== 1 ? 's' : ''}</p>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
          + Add Cooperator
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-700 dark:text-red-300 text-sm">{error}</div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={resetForm}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{editing ? 'Edit Cooperator' : 'New Cooperator'}</h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Short Name *</label><input value={name} onChange={e => setName(e.target.value)} className={inputCls} required /></div>
                <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Full Name</label><input value={fullName} onChange={e => setFullName(e.target.value)} className={inputCls} /></div>
                <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Contact Name</label><input value={contactName} onChange={e => setContactName(e.target.value)} className={inputCls} /></div>
                <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} /></div>
                <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Phone</label><input value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Address</label><textarea value={address} onChange={e => setAddress(e.target.value)} className={inputCls} rows={2} /></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} rows={2} /></div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={resetForm} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg">{editing ? 'Save' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex gap-6" style={{ minHeight: 0 }}>
        {/* Card Grid */}
        <div className={`flex-1 min-w-0 ${selected ? 'hidden lg:block lg:max-w-[55%]' : ''}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {cooperatorStats.map(c => (
              <div
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`bg-white dark:bg-gray-800 rounded-lg border shadow-sm p-4 cursor-pointer transition-colors ${
                  selectedId === c.id ? 'border-blue-300 dark:border-blue-700 ring-1 ring-blue-200 dark:ring-blue-800' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{c.name}</h3>
                    {c.full_name && <p className="text-xs text-gray-500 dark:text-gray-400">{c.full_name}</p>}
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                    {c.activityCount} activit{c.activityCount !== 1 ? 'ies' : 'y'}
                  </span>
                </div>
                {c.contact_name && <p className="text-sm text-gray-600 dark:text-gray-400">{c.contact_name}</p>}
                {c.email && <p className="text-xs text-gray-500 dark:text-gray-400">{c.email}</p>}
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Budget: {formatCurrency(c.totalBudget)}</span>
                  <span>Actual: {formatCurrency(c.totalActual)}</span>
                </div>
                {c.totalBudget > 0 && (
                  <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min((c.totalActual / c.totalBudget) * 100, 100)}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
          {cooperatorStats.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
              No cooperators yet. Add one to get started.
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="w-full lg:w-[45%] lg:min-w-[350px] bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selected.name}</h2>
              <div className="flex gap-2">
                <button onClick={() => startEdit(selected)} className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400">Edit</button>
                <button onClick={() => handleDelete(selected.id)} className="text-xs text-red-500 hover:text-red-700 dark:text-red-400">Delete</button>
                <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 lg:hidden">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
              <div className="space-y-2 text-sm">
                {selected.full_name && <div><span className="text-gray-500 dark:text-gray-400">Full Name:</span> <span className="text-gray-900 dark:text-gray-100">{selected.full_name}</span></div>}
                {selected.contact_name && <div><span className="text-gray-500 dark:text-gray-400">Contact:</span> <span className="text-gray-900 dark:text-gray-100">{selected.contact_name}</span></div>}
                {selected.email && <div><span className="text-gray-500 dark:text-gray-400">Email:</span> <a href={`mailto:${selected.email}`} className="text-blue-600 dark:text-blue-400">{selected.email}</a></div>}
                {selected.phone && <div><span className="text-gray-500 dark:text-gray-400">Phone:</span> <span className="text-gray-900 dark:text-gray-100">{selected.phone}</span></div>}
                {selected.address && <div><span className="text-gray-500 dark:text-gray-400">Address:</span> <span className="text-gray-900 dark:text-gray-100">{selected.address}</span></div>}
                {selected.notes && <div><span className="text-gray-500 dark:text-gray-400">Notes:</span> <span className="text-gray-900 dark:text-gray-100">{selected.notes}</span></div>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  <p className="text-xs text-blue-600 dark:text-blue-400">Activities</p>
                  <p className="text-xl font-bold text-blue-800 dark:text-blue-200">{selected.activityCount}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                  <p className="text-xs text-green-600 dark:text-green-400">Total Budget</p>
                  <p className="text-xl font-bold text-green-800 dark:text-green-200">{formatCurrency(selected.totalBudget)}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                  <p className="text-xs text-amber-600 dark:text-amber-400">Total Actual</p>
                  <p className="text-xl font-bold text-amber-800 dark:text-amber-200">{formatCurrency(selected.totalActual)}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400">Remaining</p>
                  <p className="text-xl font-bold text-gray-800 dark:text-gray-200">{formatCurrency(selected.totalBudget - selected.totalCommitted)}</p>
                </div>
              </div>

              {selected.activities.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Activities</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 dark:text-gray-400">
                        <th className="text-left py-1">Activity</th>
                        <th className="text-right py-1">Budget</th>
                        <th className="text-right py-1">Actual</th>
                        <th className="text-center py-1">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {selected.activities.map(a => (
                        <tr key={a.id}>
                          <td className="py-1.5 text-gray-900 dark:text-gray-100">{a.name}</td>
                          <td className="py-1.5 text-right text-gray-600 dark:text-gray-400">{formatCurrency(a.budget)}</td>
                          <td className="py-1.5 text-right text-gray-600 dark:text-gray-400">{formatCurrency(a.total_actual)}</td>
                          <td className="py-1.5 text-center">
                            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                              a.status === 'active' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                              : a.status === 'completed' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}>
                              {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Categories (with stat cards from CategoriesPage) ---
function CategoriesSection() {
  const { categories, allExpenses, createCategory, updateCategory, deleteCategory } = useBudget();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ExpenseCategory | null>(null);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

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

  const totalActual = Object.values(categoryStats).reduce((s, v) => s + v.actualTotal, 0);

  const resetForm = () => {
    setName(''); setDescription('');
    setEditing(null); setShowForm(false); setError('');
  };

  const startEdit = (c: ExpenseCategory) => {
    setEditing(c);
    setName(c.name); setDescription(c.description || '');
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editing) {
      updateCategory(editing.id, { name: name.trim(), description: description.trim() || null });
    } else {
      createCategory({ name: name.trim(), description: description.trim() || null });
    }
    resetForm();
  };

  const handleDelete = (id: number) => {
    const success = deleteCategory(id);
    if (!success) {
      setError('Cannot delete: category is referenced by expenses.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">{categories.length} categories</p>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          + Add Category
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-700 dark:text-red-300 text-sm">{error}</div>
      )}

      {/* Stat Cards */}
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
                  <button onClick={() => startEdit(cat)} className="px-2 py-0.5 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400">
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
          No categories. Add one to get started.
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {editing ? 'Edit Category' : 'Add Category'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} required className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={inputCls} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={resetForm} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                    {editing ? 'Update' : 'Create'}
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

// --- Participants (from ParticipantsPage) ---
function ParticipantsSection() {
  const {
    participants, activities, allExpenses,
    createParticipant, updateParticipant,
    archiveParticipant, unarchiveParticipant, deleteParticipant,
  } = useBudget();

  const PAGE_SIZE = 50;
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'global' | 'activity'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);

  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formOrg, setFormOrg] = useState('');
  const [formActivityId, setFormActivityId] = useState<number | ''>('');

  const expenseCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    Object.values(allExpenses).forEach(expenses => {
      expenses.forEach(e => {
        e.participants.forEach(p => {
          counts[p.id] = (counts[p.id] || 0) + 1;
        });
      });
    });
    return counts;
  }, [allExpenses]);

  const filtered = useMemo(() => {
    let items = participants;
    if (!showArchived) items = items.filter(p => !p.is_archived);
    else items = items.filter(p => p.is_archived);

    if (scopeFilter === 'global') items = items.filter(p => p.activity_id === null);
    else if (scopeFilter === 'activity') items = items.filter(p => p.activity_id !== null);

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.email && p.email.toLowerCase().includes(q)) ||
        (p.organization && p.organization.toLowerCase().includes(q))
      );
    }

    items.sort((a, b) => a.name.localeCompare(b.name));
    return items;
  }, [participants, showArchived, scopeFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeCount = participants.filter(p => !p.is_archived).length;
  const archivedCount = participants.filter(p => p.is_archived).length;

  function openCreateForm() {
    setFormName(''); setFormEmail(''); setFormOrg(''); setFormActivityId('');
    setEditingParticipant(null); setShowForm(true);
  }

  function openEditForm(p: Participant) {
    setFormName(p.name); setFormEmail(p.email || '');
    setFormOrg(p.organization || ''); setFormActivityId(p.activity_id ?? '');
    setEditingParticipant(p); setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;

    if (editingParticipant) {
      updateParticipant(editingParticipant.id, {
        name: formName.trim(),
        email: formEmail.trim() || null,
        organization: formOrg.trim() || null,
        activity_id: formActivityId ? Number(formActivityId) : null,
      });
    } else {
      createParticipant({
        name: formName.trim(),
        email: formEmail.trim() || undefined,
        organization: formOrg.trim() || undefined,
        activity_id: formActivityId ? Number(formActivityId) : null,
      });
    }
    setShowForm(false);
  }

  function getActivityName(activityId: number | null): string {
    if (!activityId) return 'Global';
    const a = activities.find(act => act.id === activityId);
    return a ? a.name : `Activity #${activityId}`;
  }

  const selectCls = 'px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500';
  const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {activeCount} active, {archivedCount} archived
        </p>
        <button onClick={openCreateForm} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
          + Add Participant
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search by name, email, or organization..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className={`${selectCls} min-w-[250px]`}
          />
          <select value={scopeFilter} onChange={e => { setScopeFilter(e.target.value as typeof scopeFilter); setPage(1); }} className={selectCls}>
            <option value="all">All Scopes</option>
            <option value="global">Global Only</option>
            <option value="activity">Activity-Specific</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={e => { setShowArchived(e.target.checked); setPage(1); }}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            Show Archived
          </label>
        </div>
      </div>

      {/* Table */}
      {paginated.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
          No participants found.
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
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Scope</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300">Expenses</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {paginated.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{p.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{p.email || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{p.organization || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{getActivityName(p.activity_id)}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600 dark:text-gray-400">{expenseCounts[p.id] || 0}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.is_archived
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          : 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200'
                      }`}>
                        {p.is_archived ? 'Archived' : 'Active'}
                      </span>
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Activity Scope</label>
                  <select value={formActivityId} onChange={e => setFormActivityId(e.target.value ? Number(e.target.value) : '')} className={inputCls}>
                    <option value="">Global (all activities)</option>
                    {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
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

// --- Templates ---
function TemplatesSection() {
  const { templates, categories, createTemplate, updateTemplate, deleteTemplate } = useBudget();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ExpenseTemplate | null>(null);

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [defaultAmount, setDefaultAmount] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setName(''); setCategoryId(''); setDescription(''); setDefaultAmount(''); setNotes('');
    setEditing(null); setShowForm(false);
  };

  const startEdit = (t: ExpenseTemplate) => {
    setEditing(t);
    setName(t.name); setCategoryId(t.category_id);
    setDescription(t.description); setDefaultAmount(t.default_amount.toString());
    setNotes(t.notes);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !categoryId) return;

    const data = {
      name: name.trim(),
      category_id: Number(categoryId),
      description: description.trim(),
      default_amount: Number(defaultAmount.replace(/[^0-9.-]/g, '')) || 0,
      notes: notes.trim(),
    };

    if (editing) {
      updateTemplate(editing.id, data);
    } else {
      createTemplate(data);
    }
    resetForm();
  };

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Expense Templates</h2>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          + Add Template
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Template Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Category *</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : '')} className={inputCls} required>
                <option value="">Select...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
              <input value={description} onChange={e => setDescription(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Default Amount</label>
              <input value={defaultAmount} onChange={e => setDefaultAmount(e.target.value)} placeholder="$0" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetForm} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400">Cancel</button>
            <button type="submit" className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
              {editing ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      )}

      {templates.length === 0 ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
          No templates yet. Templates pre-fill expense forms for common expenses.
        </div>
      ) : (
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Name</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Category</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Description</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Amount</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {templates.map(t => (
              <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">{t.name}</td>
                <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{categories.find(c => c.id === t.category_id)?.name || '-'}</td>
                <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{t.description || '-'}</td>
                <td className="px-4 py-2 text-right text-sm text-gray-900 dark:text-gray-100">${t.default_amount.toLocaleString()}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => startEdit(t)} className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 mr-2">Edit</button>
                  <button onClick={() => deleteTemplate(t.id)} className="text-xs text-red-500 hover:text-red-700 dark:text-red-400">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// --- Data Management ---
function DataSection() {
  const { loadSampleData, exportToJSON, importFromJSON } = useBudget();
  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState('');

  const handleExport = () => {
    const json = exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'budget-data.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setMessage('Data exported successfully.');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleImport = () => {
    if (!importText.trim()) return;
    const success = importFromJSON(importText);
    if (success) {
      setMessage('Data imported successfully.');
      setImportText('');
    } else {
      setMessage('Invalid data format. Import failed.');
    }
    setTimeout(() => setMessage(''), 3000);
  };

  const handleResetToSample = () => {
    if (confirm('This will replace all current data with sample data. Continue?')) {
      loadSampleData();
      setMessage('Sample data loaded.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className={`px-4 py-3 rounded-lg text-sm ${message.includes('failed') ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'}`}>
          {message}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Export Data</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">Download all budget data as JSON.</p>
        <button onClick={handleExport} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
          Download JSON
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Import Data</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">Paste exported JSON to replace all current data.</p>
        <textarea
          value={importText}
          onChange={e => setImportText(e.target.value)}
          placeholder="Paste JSON data here..."
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono"
          rows={6}
        />
        <button
          onClick={handleImport}
          disabled={!importText.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg transition-colors"
        >
          Import
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Reset Data</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">Replace all data with sample data for testing.</p>
        <button onClick={handleResetToSample} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
          Reset to Sample Data
        </button>
      </div>
    </div>
  );
}
