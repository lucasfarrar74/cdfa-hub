import { useState, useMemo } from 'react';
import { useSchedule } from '../context/ScheduleContext';

interface ConflictSummaryPanelProps {
  onHighlightMeeting?: (meetingId: string) => void;
  className?: string;
}

export default function ConflictSummaryPanel({
  onHighlightMeeting,
  className = '',
}: ConflictSummaryPanelProps) {
  const { getScheduleConflicts } = useSchedule();
  const [isExpanded, setIsExpanded] = useState(true);

  // Call getScheduleConflicts without unnecessary dependencies since it already uses activeProject internally
  const conflicts = useMemo(() => getScheduleConflicts(), [getScheduleConflicts]);

  const hasConflicts = conflicts.totalConflicts > 0;

  // Don't render if no conflicts
  if (!hasConflicts) {
    return null;
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 overflow-hidden ${className}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-amber-500 dark:text-amber-400">!</span>
          <span className="font-medium text-amber-800 dark:text-amber-300">
            Schedule Conflicts ({conflicts.totalConflicts})
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-amber-600 dark:text-amber-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-80 overflow-y-auto">
          {/* Buyer Double Bookings */}
          {conflicts.buyerDoubleBookings.map((conflict, index) => (
            <div key={`buyer-${index}`} className="p-3">
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <span className="text-red-500 text-xs font-bold">!</span>
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {conflict.buyerName} is double-booked
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {conflict.slotTime} - Meeting with: {conflict.supplierNames.join(', ')}
                  </p>
                  <div className="flex gap-1 mt-2">
                    {conflict.meetingIds.map((meetingId, mIndex) => (
                      <button
                        key={meetingId}
                        onClick={() => onHighlightMeeting?.(meetingId)}
                        className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50"
                      >
                        View {mIndex + 1}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Preference Violations */}
          {conflicts.preferenceViolations.map((conflict, index) => (
            <div key={`pref-${index}`} className="p-3">
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <span className="text-amber-500 text-xs">!</span>
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Preference violation
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {conflict.supplierName} meeting with {conflict.buyerName} violates preferences
                  </p>
                  <button
                    onClick={() => onHighlightMeeting?.(conflict.meetingId)}
                    className="mt-2 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50"
                  >
                    View Meeting
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
