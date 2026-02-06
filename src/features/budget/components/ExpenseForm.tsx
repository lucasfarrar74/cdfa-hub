import { useState, useEffect } from 'react';
import { useBudget } from '../context/BudgetContext';
import type { Expense, CreateExpenseInput } from '../types';

interface ExpenseFormProps {
  activityId: number;
  expense?: Expense | null;
  onClose: () => void;
  onSaved?: () => void;
}

function parseCurrency(value: string): number | undefined {
  const n = Number(value.replace(/[^0-9.-]/g, ''));
  return isNaN(n) || value.trim() === '' ? undefined : n;
}

export default function ExpenseForm({ activityId, expense, onClose, onSaved }: ExpenseFormProps) {
  const { categories, templates, participants, createExpense, updateExpense } = useBudget();
  const isEdit = !!expense;

  const [categoryId, setCategoryId] = useState<number | ''>(expense?.category_id || '');
  const [description, setDescription] = useState(expense?.description || '');
  const [projectedAmount, setProjectedAmount] = useState(expense?.projected_amount?.toString() || '');
  const [projectedDate, setProjectedDate] = useState(expense?.projected_date || '');
  const [actualAmount, setActualAmount] = useState(expense?.actual_amount?.toString() || '');
  const [actualDate, setActualDate] = useState(expense?.actual_date || '');
  const [receiptReference, setReceiptReference] = useState(expense?.receipt_reference || '');
  const [notes, setNotes] = useState(expense?.notes || '');
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<number[]>(
    expense?.participants?.map(p => p.id) || []
  );
  const [saving, setSaving] = useState(false);

  // Get eligible participants: global or scoped to this activity, and not archived
  const eligibleParticipants = participants.filter(
    p => !p.is_archived && (p.activity_id === null || p.activity_id === activityId)
  );

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const applyTemplate = (templateId: number) => {
    const t = templates.find(t => t.id === templateId);
    if (!t) return;
    setCategoryId(t.category_id);
    setDescription(t.description);
    setProjectedAmount(t.default_amount.toString());
    setNotes(t.notes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || !description.trim()) return;

    setSaving(true);
    try {
      if (isEdit && expense) {
        let status: 'projected' | 'actual' | 'partial' = 'projected';
        const pa = parseCurrency(projectedAmount);
        const aa = parseCurrency(actualAmount);
        if (aa !== undefined && pa !== undefined) status = 'partial';
        else if (aa !== undefined) status = 'actual';

        const selectedParticipants = participants.filter(p => selectedParticipantIds.includes(p.id));
        updateExpense(activityId, expense.id, {
          category_id: Number(categoryId),
          category_name: categories.find(c => c.id === Number(categoryId))?.name || expense.category_name,
          description: description.trim(),
          projected_amount: pa ?? null,
          projected_date: projectedDate || null,
          actual_amount: aa ?? null,
          actual_date: actualDate || null,
          receipt_reference: receiptReference.trim() || null,
          notes: notes.trim() || null,
          status,
          participants: selectedParticipants,
        });
      } else {
        const data: CreateExpenseInput = {
          category_id: Number(categoryId),
          description: description.trim(),
          projected_amount: parseCurrency(projectedAmount),
          projected_date: projectedDate || undefined,
          actual_amount: parseCurrency(actualAmount),
          actual_date: actualDate || undefined,
          receipt_reference: receiptReference.trim() || undefined,
          notes: notes.trim() || undefined,
          participant_ids: selectedParticipantIds.length > 0 ? selectedParticipantIds : undefined,
        };
        const newExpense = await createExpense(activityId, data);
        // Update participants on the new expense
        if (newExpense && selectedParticipantIds.length > 0) {
          const selectedParticipants = participants.filter(p => selectedParticipantIds.includes(p.id));
          updateExpense(activityId, newExpense.id, { participants: selectedParticipants });
        }
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
            {isEdit ? 'Edit Expense' : 'Add Expense'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {!isEdit && templates.length > 0 && (
            <div>
              <label className={labelCls}>From Template</label>
              <select onChange={e => e.target.value && applyTemplate(Number(e.target.value))} className={inputCls} defaultValue="">
                <option value="">Select template...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelCls}>Category *</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : '')} className={inputCls} required>
              <option value="">Select...</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Description *</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} className={inputCls} required />
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
            <label className={labelCls}>Receipt Reference</label>
            <input type="text" value={receiptReference} onChange={e => setReceiptReference(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} rows={2} />
          </div>

          {eligibleParticipants.length > 0 && (
            <div>
              <label className={labelCls}>Participants</label>
              <div className="max-h-32 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-2 space-y-1">
                {eligibleParticipants.map(p => (
                  <label key={p.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded px-1 py-0.5">
                    <input
                      type="checkbox"
                      checked={selectedParticipantIds.includes(p.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedParticipantIds([...selectedParticipantIds, p.id]);
                        } else {
                          setSelectedParticipantIds(selectedParticipantIds.filter(id => id !== p.id));
                        }
                      }}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    <span>{p.name}</span>
                    {p.organization && <span className="text-xs text-gray-400">({p.organization})</span>}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !categoryId || !description.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
