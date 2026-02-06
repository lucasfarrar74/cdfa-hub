import { useState, useMemo } from 'react';
import { useBudget } from '../context/BudgetContext';
import type { Cooperator } from '../types';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

interface CooperatorsPageProps {
  onNavigateToActivities?: (cooperatorId: number) => void;
  onNavigateToReports?: (cooperatorId: number) => void;
}

export default function CooperatorsPage({ onNavigateToActivities, onNavigateToReports }: CooperatorsPageProps) {
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Cooperators</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage partner organizations</p>
        </div>
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
              {/* Info */}
              <div className="space-y-2 text-sm">
                {selected.full_name && <div><span className="text-gray-500 dark:text-gray-400">Full Name:</span> <span className="text-gray-900 dark:text-gray-100">{selected.full_name}</span></div>}
                {selected.contact_name && <div><span className="text-gray-500 dark:text-gray-400">Contact:</span> <span className="text-gray-900 dark:text-gray-100">{selected.contact_name}</span></div>}
                {selected.email && <div><span className="text-gray-500 dark:text-gray-400">Email:</span> <a href={`mailto:${selected.email}`} className="text-blue-600 dark:text-blue-400">{selected.email}</a></div>}
                {selected.phone && <div><span className="text-gray-500 dark:text-gray-400">Phone:</span> <span className="text-gray-900 dark:text-gray-100">{selected.phone}</span></div>}
                {selected.address && <div><span className="text-gray-500 dark:text-gray-400">Address:</span> <span className="text-gray-900 dark:text-gray-100">{selected.address}</span></div>}
                {selected.notes && <div><span className="text-gray-500 dark:text-gray-400">Notes:</span> <span className="text-gray-900 dark:text-gray-100">{selected.notes}</span></div>}
              </div>

              {/* Stats */}
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

              {/* Quick Links */}
              <div className="flex gap-2">
                {onNavigateToActivities && (
                  <button onClick={() => onNavigateToActivities(selected.id)} className="flex-1 px-3 py-2 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-center">
                    View Activities
                  </button>
                )}
                {onNavigateToReports && (
                  <button onClick={() => onNavigateToReports(selected.id)} className="flex-1 px-3 py-2 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors text-center">
                    Billing Report
                  </button>
                )}
              </div>

              {/* Activities Table */}
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
