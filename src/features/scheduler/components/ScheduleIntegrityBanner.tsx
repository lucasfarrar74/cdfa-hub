import { useState } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { formatTime } from '../utils/timeUtils';

/**
 * Amber warning banner shown above the schedule when the active project
 * has one or more double-bookings — two active meetings pointing at the
 * same supplier + slot or same buyer + slot. Rendered no matter how the
 * stacks got there (past bug, corrupted import, sync race). Click the
 * "Details" button to reveal the full list.
 *
 * The write-time guards (in ScheduleContext) prevent NEW stacks, but
 * this banner is what makes existing stacks visible so an admin knows
 * to clean up before the schedule is used at an event.
 */
export default function ScheduleIntegrityBanner() {
  const { scheduleIntegrityIssues, activeProject } = useSchedule();
  const [expanded, setExpanded] = useState(false);

  if (!activeProject || scheduleIntegrityIssues.length === 0) return null;

  const suppliersById = new Map(activeProject.suppliers.map(s => [s.id, s]));
  const buyersById = new Map(activeProject.buyers.map(b => [b.id, b]));
  const slotsById = new Map(activeProject.timeSlots.map(s => [s.id, s]));
  const meetingsById = new Map(activeProject.meetings.map(m => [m.id, m]));

  const fmtSlot = (slotId: string) => {
    const slot = slotsById.get(slotId);
    if (!slot) return '(unknown slot)';
    try {
      const t = slot.startTime instanceof Date ? slot.startTime : new Date(slot.startTime);
      return `${slot.date} ${formatTime(t)}`;
    } catch {
      return slot.date;
    }
  };

  const count = scheduleIntegrityIssues.length;

  return (
    <div className="mb-4 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <svg className="w-5 h-5 mt-0.5 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            Schedule integrity warning: {count} double-booking{count === 1 ? '' : 's'} detected
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
            One or more meetings are stacked — the same party is scheduled twice in the same
            slot. This is data left over from an older bug that has since been fixed
            (write-time guards now prevent new stacks). Review the list below and cancel
            duplicates you don't want, or run{' '}
            <code className="text-xs bg-amber-100 dark:bg-amber-950 px-1 py-0.5 rounded">
              node scripts/audit-schedule-integrity.mjs {activeProject.shareId || '<shareId>'} --fix
            </code>{' '}
            to auto-cancel one duplicate per stack.
          </p>
          <button
            onClick={() => setExpanded(v => !v)}
            className="mt-2 text-sm font-medium text-amber-900 dark:text-amber-200 underline hover:text-amber-700 dark:hover:text-amber-100"
          >
            {expanded ? 'Hide details' : 'Show details'}
          </button>

          {expanded && (
            <ul className="mt-3 space-y-2 text-sm text-amber-900 dark:text-amber-200">
              {scheduleIntegrityIssues.map((issue, i) => {
                const partyName = issue.kind === 'supplier'
                  ? suppliersById.get(issue.partyId)?.companyName
                  : buyersById.get(issue.partyId)?.name;
                return (
                  <li key={i} className="border-t border-amber-200 dark:border-amber-800 pt-2">
                    <div className="font-medium">
                      {issue.kind === 'supplier' ? 'Supplier' : 'Buyer'}:{' '}
                      {partyName || `(unknown id ${issue.partyId.slice(0, 6)})`}
                    </div>
                    <div className="text-xs text-amber-800 dark:text-amber-300">
                      Slot: {fmtSlot(issue.slotId)}
                    </div>
                    <ul className="mt-1 ml-4 list-disc">
                      {issue.meetingIds.map(mid => {
                        const m = meetingsById.get(mid);
                        if (!m) return <li key={mid}>meeting {mid.slice(0, 8)}</li>;
                        const otherName = issue.kind === 'supplier'
                          ? buyersById.get(m.buyerId)?.name
                          : suppliersById.get(m.supplierId)?.companyName;
                        return (
                          <li key={mid}>
                            with {otherName || '(unknown)'} — meeting {mid.slice(0, 8)}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
