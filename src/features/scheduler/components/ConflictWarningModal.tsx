import type { ConflictInfo } from '../types';

interface ConflictWarningModalProps {
  title: string;
  conflicts: ConflictInfo[];
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  showConfirm?: boolean;
}

export default function ConflictWarningModal({
  title,
  conflicts,
  onClose,
  onConfirm,
  confirmText = 'Proceed Anyway',
  showConfirm = false,
}: ConflictWarningModalProps) {
  const hasErrors = conflicts.some(c => c.severity === 'error');
  const hasWarnings = conflicts.some(c => c.severity === 'warning');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className={`px-4 py-3 ${hasErrors ? 'bg-red-50 dark:bg-red-900/30' : 'bg-amber-50 dark:bg-amber-900/30'}`}>
          <div className="flex items-center gap-2">
            {hasErrors ? (
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            <h3 className={`font-semibold ${hasErrors ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'}`}>
              {title}
            </h3>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-4">
          <div className="space-y-3">
            {conflicts.map((conflict, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-3 rounded-md ${
                  conflict.severity === 'error'
                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                    : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                }`}
              >
                <span className="flex-shrink-0 mt-0.5">
                  {conflict.severity === 'error' ? (
                    <span className="text-red-500 text-lg">X</span>
                  ) : conflict.type === 'preference_violation' ? (
                    <span className="text-amber-500 text-lg">!</span>
                  ) : (
                    <span className="text-amber-500 text-lg">!</span>
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    conflict.severity === 'error'
                      ? 'text-red-800 dark:text-red-300'
                      : 'text-amber-800 dark:text-amber-300'
                  }`}>
                    {conflict.type === 'supplier_busy' && 'Supplier Double-Booking'}
                    {conflict.type === 'buyer_busy' && 'Buyer Conflict'}
                    {conflict.type === 'preference_violation' && 'Preference Violation'}
                  </p>
                  <p className={`text-sm mt-0.5 ${
                    conflict.severity === 'error'
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}>
                    {conflict.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {hasErrors && (
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              This action cannot be completed due to the error above.
            </p>
          )}
          {!hasErrors && hasWarnings && (
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              You can proceed, but the meeting will show a conflict indicator.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            {hasErrors ? 'OK' : 'Cancel'}
          </button>
          {showConfirm && !hasErrors && onConfirm && (
            <button
              onClick={onConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-md hover:bg-amber-600"
            >
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
