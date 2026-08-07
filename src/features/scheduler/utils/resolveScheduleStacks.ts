import type { Meeting, Supplier, TimeSlot } from '../types';
import { findAllDoubleBookings } from './conflictDetection';
import { findFirstOpenSlot } from './scheduler';

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
  /** Meetings that were moved to a new open slot instead of cancelled. */
  rescheduledIds: string[];
  /** Meetings that had no open slot available and were cancelled. */
  cancelledIds: string[];
}

/**
 * Resolve every double-booking in `meetings` by picking the
 * highest-preference-scoring meeting per stack and moving each "loser"
 * to a different open slot. If no open slot fits the loser's supplier
 * availability and buyer schedule, it's cancelled (recoverable — the
 * meeting stays in the array with status='cancelled').
 *
 * When `timeSlots` isn't supplied, rescheduling is skipped and every
 * loser is cancelled — this preserves the old behavior for callers
 * that don't have slot data handy.
 */
export function resolveScheduleStacks(
  meetings: Meeting[],
  suppliers: Supplier[],
  timeSlots?: TimeSlot[],
): ResolveResult {
  const suppliersById = new Map(suppliers.map(s => [s.id, s]));
  const rescheduledIds: string[] = [];
  const cancelledIds: string[] = [];

  const stacks = findAllDoubleBookings(meetings);
  const meetingsById = new Map(meetings.map(m => [m.id, m]));

  // Compute the losers per stack up front (before any state mutations)
  // so a meeting that appears in both a supplier-stack and a buyer-stack
  // still resolves consistently.
  const losers: string[] = [];
  const seen = new Set<string>();
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
    for (const s of scored.slice(1)) {
      if (!seen.has(s.m.id)) {
        seen.add(s.m.id);
        losers.push(s.m.id);
      }
    }
  }

  // Iterate losers sequentially, updating the working meetings array
  // after each placement so subsequent searches see the fresh state.
  let working = [...meetings];
  for (const loserId of losers) {
    const meeting = working.find(m => m.id === loserId);
    if (!meeting) continue;

    if (timeSlots) {
      const supplier = suppliersById.get(meeting.supplierId);
      // Search everywhere — but treat the loser itself as absent so the
      // slot it currently occupies is considered "free from this meeting"
      // (it isn't really — the winner is there too — but findFirstOpenSlot
      // will skip that slot because the winner is still marked active).
      const searchMeetings = working.map(m =>
        m.id === loserId ? { ...m, status: 'cancelled' as const } : m,
      );
      const newSlot = findFirstOpenSlot(meeting, timeSlots, searchMeetings, supplier);
      if (newSlot) {
        working = working.map(m =>
          m.id === loserId
            ? { ...m, timeSlotId: newSlot.id, status: 'scheduled' as const }
            : m,
        );
        rescheduledIds.push(loserId);
        continue;
      }
    }

    // No open slot (or no slot data supplied) — cancel.
    working = working.map(m =>
      m.id === loserId ? { ...m, status: 'cancelled' as const } : m,
    );
    cancelledIds.push(loserId);
  }

  return { updatedMeetings: working, rescheduledIds, cancelledIds };
}
