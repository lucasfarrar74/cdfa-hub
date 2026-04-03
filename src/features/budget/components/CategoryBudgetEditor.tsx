import { useState } from 'react';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface CategoryBudgetEditorProps {
  categoryName: string;
  currentAmount: number | null;
  activityBudget: number;
  totalAllocatedOther: number; // Total allocated to OTHER categories (not this one)
  onSave: (amount: number) => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function CategoryBudgetEditor({
  categoryName,
  currentAmount,
  activityBudget,
  totalAllocatedOther,
  onSave,
  onDelete,
  onClose,
}: CategoryBudgetEditorProps) {
  const [value, setValue] = useState(currentAmount?.toString() ?? '');

  const parsedAmount = Number(value.replace(/[^0-9.-]/g, '')) || 0;
  const remainingAfter = activityBudget - totalAllocatedOther - parsedAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount > 0) {
      onSave(parsedAmount);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 mx-4 max-w-sm w-full"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Set Allocation
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {categoryName}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Allocated Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                type="text"
                value={value}
                onChange={e => setValue(e.target.value)}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
                autoFocus
              />
            </div>
          </div>

          <div className="text-sm space-y-1">
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>Activity Budget</span>
              <span>{formatCurrency(activityBudget)}</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>Other Allocations</span>
              <span>{formatCurrency(totalAllocatedOther)}</span>
            </div>
            <div className={`flex justify-between font-medium pt-1 border-t border-gray-200 dark:border-gray-600 ${
              remainingAfter < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'
            }`}>
              <span>Remaining Unallocated</span>
              <span>{formatCurrency(remainingAfter)}</span>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <div>
              {currentAmount !== null && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
