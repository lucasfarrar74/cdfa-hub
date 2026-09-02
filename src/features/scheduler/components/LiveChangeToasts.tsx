import { useEffect, useRef, useState } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { useAuth } from '../../../context/AuthContext';
import { colorForCollaborator, initialForCollaborator } from '../utils/collaboratorColors';
import type { ActivityEvent } from '../types';

interface ToastEntry {
  key: string;
  event: ActivityEvent;
  createdAt: number;
}

/**
 * Live-change notifications. Watches the shared activity log; every
 * time a new event arrives that WASN'T authored by the current user,
 * a small toast pops in the bottom-right corner and auto-dismisses
 * after 5 seconds.
 *
 * Piggybacks on item B — no separate diff logic needed. Attribution,
 * summary, and color already live on each ActivityEvent.
 *
 * First-mount protection: on initial load `activityEvents` arrives
 * populated (historical events). We record their ids as "already
 * seen" to avoid a burst of toasts for events that predate the user
 * opening the app.
 */
export default function LiveChangeToasts() {
  const { activityEvents, activeProject, isFirebaseEnabled } = useSchedule();
  const { user } = useAuth();
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  // Initialize seen set from whatever's already in the log on first mount.
  useEffect(() => {
    if (initializedRef.current) return;
    if (activityEvents.length === 0) return;
    for (const e of activityEvents) seenIdsRef.current.add(e.id);
    initializedRef.current = true;
  }, [activityEvents]);

  // Detect new events on each render of activityEvents.
  useEffect(() => {
    if (!initializedRef.current) return;
    const selfId = user?.uid;
    const newlyArrived: ActivityEvent[] = [];
    for (const e of activityEvents) {
      if (seenIdsRef.current.has(e.id)) continue;
      seenIdsRef.current.add(e.id);
      // Suppress toasts for our own changes and for pure informational
      // events like "Undid: X" (which the acting user just clicked and
      // doesn't need announced).
      if (e.userId === selfId) continue;
      if (e.type === 'undo_applied') continue;
      newlyArrived.push(e);
    }
    if (newlyArrived.length === 0) return;

    const now = Date.now();
    setToasts(prev => {
      const additions: ToastEntry[] = newlyArrived.map((e, i) => ({
        key: `${e.id}-${now + i}`,
        event: e,
        createdAt: now + i,
      }));
      // Keep at most 4 toasts on screen at once — older ones drop off
      // to leave room for the newer messages.
      return [...prev, ...additions].slice(-4);
    });
  }, [activityEvents, user?.uid]);

  // Auto-dismiss each toast after 5 seconds.
  useEffect(() => {
    if (toasts.length === 0) return;
    const timeouts = toasts.map(t =>
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.key !== t.key));
      }, Math.max(1000, 5000 - (Date.now() - t.createdAt))),
    );
    return () => {
      for (const id of timeouts) clearTimeout(id);
    };
  }, [toasts]);

  if (!activeProject?.isCloud || !isFirebaseEnabled) return null;
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col gap-2 pointer-events-none">
      {toasts.map(({ key, event }) => {
        const color = colorForCollaborator(event.userId);
        const initial = initialForCollaborator(event.userName, event.userId);
        return (
          <div
            key={key}
            className="pointer-events-auto flex items-start gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-w-sm text-sm"
          >
            <div
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
              style={{ backgroundColor: color }}
              title={event.userName || `User ${event.userId.slice(0, 6)}`}
            >
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-900 dark:text-gray-100">{event.summary}</div>
              {event.userName && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  by {event.userName}
                </div>
              )}
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.key !== key))}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              title="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
