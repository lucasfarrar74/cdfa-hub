import { useState, useEffect } from 'react';
import { useBudget } from '../context/BudgetContext';
import type { Income, CreateIncomeInput } from '../types';

interface IncomeFormProps {
  activityId: number;
  income?: Income | null;
  onClose: () => void;
  onSaved?: () => void;
}

function parseCurrency(value: string): number | undefined {
  const n = Number(value.replace(/[^0-9.-]/g, ''));
  return isNaN(n) || value.trim() === '' ? undefined : n;
}

const INCOME_SOURCES = ['Participant Fees', 'Registration', 'Sponsorship', 'Reimbursement', 'Other'];

export default function IncomeForm({ activityId, income, onClose, onSaved }: IncomeFormProps) {
  const { createIncome, updateIncome } = useBudget();
  const isEdit = !!income;

  const [description, setDescription] = useState(income?.description || '');
  const [source, setSource] = useState(income?.source || '');
  const [projectedAmount, setProjectedAmount] = useState(income?.projected_amount?.toString() || '');
  const [projectedDate, setProjectedDate] = useState(income?.projected_date || '');
  const [actualAmount, setActualAmount] = useState(income?.actual_amount?.toString() || '');
  const [actualDate, setActualDate] = useState(income?.actual_date || '');
  const [notes, setNotes] = useState(income?.notes || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setSaving(true);
    try {
      if (isEdit && income) {
        let status: 'projected' | 'actual' | 'partial' = 'projected';
        const pa = parseCurrency(projectedAmount);
        const aa = parseCurrency(actualAmount);
        if (aa !== undefined && pa !== undefined) status = 'partial';
        else if (aa !== undefined) status = 'actual';

        updateIncome(activityId, income.id, {
          description: description.trim(),
          source: source || null,
          projected_amount: pa ?? null,
          projected_date: projectedDate || null,
          actual_amount: aa ?? null,
          actual_date: actualDate || null,
          notes: notes.trim() || null,
          status,
        });
      } else {
        const data: CreateIncomeInput = {
          description: description.trim(),
          source: source || undefined,
          projected_amount: parseCurrency(projectedAmount),
          projected_date: projectedDate || undefined,
          actual_amount: parseCurrency(actualAmount),
          actual_date: actualDate || undefined,
          notes: notes.trim() || undefined,
        };
        createIncome(activityId, data);
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
            {isEdit ? 'Edit Income' : 'Add Income'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>Description *</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} className={inputCls} required />
          </div>

          <div>
            <label className={labelCls}>Source</label>
            <select value={source} onChange={e => setSource(e.target.value)} className={inputCls}>
              <option value="">Select...</option>
              {INCOME_SOURCES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Projected Amount</label>
              <input type="text" value={projectedAmount} onChange={e => setProjectedAmount(e.target.value)} placeholder="$0" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Projected Date</label>
              <input type="date" value={projectedDate} onChange={e => setProjectedDate(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Actual Amount</label>
              <input type="text" value={actualAmount} onChange={e => setActualAmount(e.target.value)} placeholder="$0" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Actual Date</label>
              <input type="date" value={actualDate} onChange={e => setActualDate(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} rows={2} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !description.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Income'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
