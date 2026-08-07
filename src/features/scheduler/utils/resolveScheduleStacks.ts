import type { Meeting, Supplier } from '../types';
import { findAllDoubleBookings } from './conflictDetection';

/**
 * Score a meeting by how well it matches the supplier's stated
 * preference. Higher = more likely to be a legitimate wanted meeting.
 *   3 = supplier's preference='include' AND buyer is in the include list
 *   2 = supplier's preference='all', OR
 *       preference='exclude' AND buyer is NOT in the exclude list
 *   1 = preference='include' AND buyer NOT in the include list
 *       (buyer wasn't explicitly wanted — likely accidental)
 *   0 = preference='exclude' AND buyer IS in the exclude list
 *       (violates supplier's stated preference — almost certainly accidental)
 */
export function preferenceScoreForMeeting(meeting: Meeting, supplier: Supplier | undefined): number {
  if (!supplier) return 2;
  const list = supplier.preferenceList || [];
  const inList = list.includes(meeting.buyerId);
  if (supplier.preference === 'include') return inList ? 3 : 1;
  if (supplier.preference === 'exclude') return inList ? 0 : 2;
  return 2;
}

export interface ResolveResult {
  updatedMeetings: Meeting[];
  cancelledIds: string[];
}

/**
 * Resolve every double-booking in `meetings` by cancelling one meeting
 * from each stack. For each stack, keep the highest-preference-scoring
 * meeting; ties broken by lex-smallest ID for determinism.
 *
 * Cancelled meetings retain status='cancelled' — they stay in the array
 * so nothing is permanently lost and the admin can reverse a wrong pick
 * by editing the status back to 'scheduled'.
 *
 * Returns both the updated array and the list of cancelled meeting IDs
 * so callers can report the count / trigger analytics / etc.
 */
export function resolveScheduleStacks(
  meetings: Meeting[],
  suppliers: Supplier[],
): ResolveResult {
  const suppliersById = new Map(suppliers.map(s => [s.id, s]));
  const cancelled = new Set<string>();

  const stacks = findAllDoubleBookings(meetings);
  const meetingsById = new Map(meetings.map(m => [m.id, m]));

  for (const stack of stacks) {
    const stackMeetings = stack.meetingIds
      .map(id => meetingsById.get(id))
      .filter((m): m is Meeting => !!m);

    const scored = stackMeetings.map(m => ({
      m,
      score: preferenceScoreForMeeting(m, suppliersById.get(m.supplierId)),
    }));
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.m.id.localeCompare(b.m.id);
    });
    // Keep the top-scoring meeting; cancel the rest
    for (const s of scored.slice(1)) {
      cancelled.add(s.m.id);
    }
  }

  const updatedMeetings = meetings.map(m =>
    cancelled.has(m.id) ? { ...m, status: 'cancelled' as const } : m,
  );

  return { updatedMeetings, cancelledIds: [...cancelled] };
}
