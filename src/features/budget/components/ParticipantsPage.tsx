import { useState, useMemo } from 'react';
import { useBudget } from '../context/BudgetContext';
import type { Participant } from '../types';

const PAGE_SIZE = 50;

export default function ParticipantsPage() {
  const {
    participants,
    activities,
    allExpenses,
    createParticipant,
    updateParticipant,
    archiveParticipant,
    unarchiveParticipant,
    deleteParticipant,
  } = useBudget();

  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'global' | 'activity'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formOrg, setFormOrg] = useState('');
  const [formActivityId, setFormActivityId] = useState<number | ''>('');

  // Count expenses per participant
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
    setFormName('');
    setFormEmail('');
    setFormOrg('');
    setFormActivityId('');
    setEditingParticipant(null);
    setShowForm(true);
  }

  function openEditForm(p: Participant) {
    setFormName(p.name);
    setFormEmail(p.email || '');
    setFormOrg(p.organization || '');
    setFormActivityId(p.activity_id ?? '');
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Participants</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {activeCount} active, {archivedCount} archived
          </p>
        </div>
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
