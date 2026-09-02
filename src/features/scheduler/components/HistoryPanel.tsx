import { useState } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { colorForCollaborator, initialForCollaborator } from '../utils/collaboratorColors';
import type { ActivityEvent } from '../types';

/**
 * Chronological, per-user activity log with per-entry Undo. Ships as a
 * side drawer that toggles open from a button in the schedule header.
 *
 * Only rendered when the active project is in the cloud — solo local
 * projects don't have a shared log to display.
 */
export default function HistoryPanel() {
  const {
    activityEvents,
    applyActivityUndo,
    activeProject,
    isFirebaseEnabled,
  } = useSchedule();
  const [isOpen, setIsOpen] = useState(false);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);

  if (!activeProject?.isCloud || !isFirebaseEnabled) return null;

  const handleUndo = async (event: ActivityEvent) => {
    setBusyEventId(event.id);
    try {
      await applyActivityUndo(event);
    } finally {
      setBusyEventId(null);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(v => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
        title="Show change history"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>History</span>
        {activityEvents.length > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">({activityEvents.length})</span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setIsOpen(false)}
          />
          {/* Drawer */}
          <div className="fixed right-0 top-0 h-full w-96 max-w-full bg-white dark:bg-gray-900 shadow-xl z-50 flex flex-col border-l border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Change history</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {activityEvents.length === 0
                    ? 'No changes yet. This log fills up as anyone edits the schedule.'
                    : `Most recent ${activityEvents.length} of the last 50 changes`}
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {activityEvents.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  Every move, add, cancel, and status change made by any admin will appear here — with a button to undo each one independently.
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {activityEvents.map(event => {
                    const color = colorForCollaborator(event.userId);
                    const initial = initialForCollaborator(event.userName, event.userId);
                    const isUndoable = event.undoPayload.kind !== 'none' && !event.undone;
                    return (
                      <li
                        key={event.id}
                        className={`px-4 py-3 flex items-start gap-3 ${event.undone ? 'opacity-50' : ''}`}
                      >
                        <div
                          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
                          style={{ backgroundColor: color }}
                          title={event.userName || `User ${event.userId.slice(0, 6)}`}
                        >
                          {initial}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-900 dark:text-gray-100">
                            {event.undone && <span className="italic text-gray-400 mr-1">(undone)</span>}
                            {event.summary}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {formatRelativeTime(event.timestamp)}
                            {event.userName && <span className="ml-1">· {event.userName}</span>}
                          </div>
                        </div>
                        {isUndoable && (
                          <button
                            onClick={() => handleUndo(event)}
                            disabled={busyEventId === event.id}
                            className="flex-shrink-0 px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                            title="Undo this specific change"
                          >
                            {busyEventId === event.id ? 'Undoing…' : 'Undo'}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return iso;
  const diffMs = Date.now() - then;
  const secs = Math.round(diffMs / 1000);
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
