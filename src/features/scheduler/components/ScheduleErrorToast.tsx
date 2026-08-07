import { useEffect } from 'react';
import { useSchedule } from '../context/ScheduleContext';

const AUTO_DISMISS_MS = 4500;

/**
 * Bottom-right red toast for guard rejections (double-booking blocks,
 * out-of-window bumps, etc.). Reads mutationError from ScheduleContext
 * and auto-dismisses after a few seconds. Not modal — the schedule
 * stays interactive underneath.
 */
export default function ScheduleErrorToast() {
  const { mutationError, clearMutationError } = useSchedule();

  useEffect(() => {
    if (!mutationError) return;
    const id = setTimeout(clearMutationError, AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [mutationError, clearMutationError]);

  if (!mutationError) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 max-w-md bg-red-600 text-white shadow-lg rounded-lg px-4 py-3 flex items-start gap-3"
    >
      <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <p className="text-sm flex-1">{mutationError}</p>
      <button
        onClick={clearMutationError}
        className="text-white/80 hover:text-white text-xs font-medium underline"
      >
        Dismiss
      </button>
    </div>
  );
}
