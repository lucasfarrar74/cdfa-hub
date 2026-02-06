import { useState, useEffect } from 'react';
import { useBudget } from '../context/BudgetContext';
import type { ActivitySummary, CreateActivityInput } from '../types';

interface ActivityFormProps {
  activity?: ActivitySummary | null;
  onClose: () => void;
  onSaved?: () => void;
}

function parseCurrency(value: string): number {
  return Number(value.replace(/[^0-9.-]/g, '')) || 0;
}

export default function ActivityForm({ activity, onClose, onSaved }: ActivityFormProps) {
  const { cooperators, createActivity, updateActivity } = useBudget();
  const isEdit = !!activity;

  const [name, setName] = useState(activity?.name || '');
  const [description, setDescription] = useState(activity?.description || '');
  const [cooperatorId, setCooperatorId] = useState<number | ''>(activity?.cooperator_id || '');
  const [budget, setBudget] = useState(activity?.budget?.toString() || '');
  const [startDate, setStartDate] = useState(activity?.start_date || '');
  const [endDate, setEndDate] = useState(activity?.end_date || '');
  const [status, setStatus] = useState<'planning' | 'active' | 'completed'>(activity?.status || 'planning');
  const [location, setLocation] = useState(activity?.location || '');
  const [cdfaActivityId, setCdfaActivityId] = useState(activity?.cdfa_activity_id || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !cooperatorId || !budget) return;

    setSaving(true);
    try {
      const data: CreateActivityInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        cooperator_id: Number(cooperatorId),
        budget: parseCurrency(budget),
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        status,
        location: location.trim() || undefined,
        cdfa_activity_id: cdfaActivityId.trim() || undefined,
      };

      if (isEdit && activity) {
        await updateActivity(activity.id, data);
      } else {
        await createActivity(data);
      }
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {isEdit ? 'Edit Activity' : 'New Activity'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls} required />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className={inputCls} rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Cooperator *</label>
              <select
                value={cooperatorId}
                onChange={e => setCooperatorId(e.target.value ? Number(e.target.value) : '')}
                className={inputCls}
                required
              >
                <option value="">Select...</option>
                {cooperators.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Budget *</label>
              <input
                type="text"
                value={budget}
                onChange={e => setBudget(e.target.value)}
                placeholder="$0"
                className={inputCls}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as 'planning' | 'active' | 'completed')} className={inputCls}>
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>CDFA Activity ID</label>
              <input type="text" value={cdfaActivityId} onChange={e => setCdfaActivityId(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Location</label>
            <input type="text" value={location} onChange={e => setLocation(e.target.value)} className={inputCls} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim() || !cooperatorId || !budget}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Activity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
