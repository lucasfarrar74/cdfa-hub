/**
 * Incremental placement operations — the "add / rebalance / bump
 * without regenerating the whole schedule" helpers.
 *
 * Every function here is pure and returns a delta the caller applies
 * via `updateActiveProject`. All placements respect the same invariant
 * the write-time guards enforce (no supplier or buyer in two active
 * meetings at the same slot), so composing these with the existing
 * mutations can never create a stack.
 *
 * See docs/scheduler-flexibility-plan.md for the design rationale.
 */

import type { Supplier, Buyer, Meeting, TimeSlot, UnscheduledPair } from '../types';
import { canSupplierMeetBuyer, isSlotInSupplierWindow } from './scheduler';
import { generateId } from './timeUtils';

/** Reason a supplier×buyer meeting could not be placed. */
export type PlacementFailureReason =
  | 'no-open-slot'
  | 'outside-supplier-window'
  | 'buyer-fully-booked';

export interface PlacementFailure {
  supplierId: string;
  buyerId: string;
  reason: PlacementFailureReason;
}

/**
 * Result of an incremental placement operation.
 * - `additions` are new Meeting records to append to project.meetings.
 * - `unscheduledPairs` are supplier×buyer pairs we couldn't place;
 *   caller appends these to project.unscheduledPairs.
 * - `failures` mirrors unscheduledPairs but with the reason attached,
 *   useful for the summary modal.
 */
export interface PlacementResult {
  additions: Meeting[];
  unscheduledPairs: UnscheduledPair[];
  failures: PlacementFailure[];
}

/**
 * Which slots is a party currently "busy" in? Considers only active
 * statuses ('scheduled' | 'in_progress' | 'completed' | 'delayed' |
 * 'running_late'); ignores cancelled + bumped.
 */
function activeMeetingsInSlot(slotId: string, meetings: Meeting[]): Meeting[] {
  return meetings.filter(
    m => m.timeSlotId === slotId && m.status !== 'cancelled' && m.status !== 'bumped',
  );
}

/**
 * Find the first slot that fits both a specific supplier and a
 * specific buyer. Mirror of `findFirstOpenSlot` in scheduler.ts but
 * shaped for incremental placement (no synthetic meeting needed).
 */
function findSlotForPair(
  supplier: Supplier,
  buyerId: string,
  timeSlots: TimeSlot[],
  meetings: Meeting[],
): TimeSlot | null {
  const usable = timeSlots.filter(s => !s.isBreak);
  for (const slot of usable) {
    if (!isSlotInSupplierWindow(slot, supplier)) continue;
    const days = supplier.selectedDays;
    if (days && days.length > 0 && !days.includes(slot.date)) continue;
    const active = activeMeetingsInSlot(slot.id, meetings);
    const supplierBusy = active.some(m => m.supplierId === supplier.id);
    const buyerBusy = active.some(m => m.buyerId === buyerId);
    if (!supplierBusy && !buyerBusy) return slot;
  }
  return null;
}

/**
 * Place meetings for a NEWLY-added supplier into the existing
 * schedule. Never moves or cancels an existing meeting — only appends
 * new ones. Any (supplier, buyer) pair we can't place is returned in
 * `unscheduledPairs` for the admin to review.
 *
 * Buyer order: currently the buyers array as-is. The design doc calls
 * for "most-restrictive-first" ordering (buyers with fewest options
 * first) as a follow-up; the current order still respects supplier
 * preference and produces a valid schedule.
 */
export function placeSupplierIncrementally(
  supplierId: string,
  suppliers: Supplier[],
  buyers: Buyer[],
  timeSlots: TimeSlot[],
  meetings: Meeting[],
): PlacementResult {
  const supplier = suppliers.find(s => s.id === supplierId);
  if (!supplier) return { additions: [], unscheduledPairs: [], failures: [] };

  const targets = buyers.filter(b => canSupplierMeetBuyer(supplier, b.id));
  const additions: Meeting[] = [];
  const unscheduledPairs: UnscheduledPair[] = [];
  const failures: PlacementFailure[] = [];

  // Track a growing "meetings so far" list so successive placements
  // don't stack on the same slot.
  const workingMeetings = [...meetings];

  for (const buyer of targets) {
    const slot = findSlotForPair(supplier, buyer.id, timeSlots, workingMeetings);
    if (!slot) {
      // Diagnose why: was the buyer fully booked in every slot that
      // fit the supplier window, or were there no window-fitting
      // slots at all?
      const anyWindowSlot = timeSlots.some(
        s => !s.isBreak && isSlotInSupplierWindow(s, supplier) &&
          (!supplier.selectedDays || supplier.selectedDays.length === 0 || supplier.selectedDays.includes(s.date)),
      );
      const reason: PlacementFailureReason = anyWindowSlot
        ? 'buyer-fully-booked'
        : 'outside-supplier-window';
      unscheduledPairs.push({ supplierId: supplier.id, buyerId: buyer.id });
      failures.push({ supplierId: supplier.id, buyerId: buyer.id, reason });
      continue;
    }
    const meeting: Meeting = {
      id: generateId(),
      supplierId: supplier.id,
      buyerId: buyer.id,
      timeSlotId: slot.id,
      status: 'scheduled',
    };
    additions.push(meeting);
    workingMeetings.push(meeting);
  }

  return { additions, unscheduledPairs, failures };
}

/**
 * Mirror of `placeSupplierIncrementally` for a newly-added buyer.
 * Iterates every supplier that CAN meet the buyer (per each
 * supplier's own preference) and tries to place one meeting each.
 */
export function placeBuyerIncrementally(
  buyerId: string,
  suppliers: Supplier[],
  buyers: Buyer[],
  timeSlots: TimeSlot[],
  meetings: Meeting[],
): PlacementResult {
  const buyer = buyers.find(b => b.id === buyerId);
  if (!buyer) return { additions: [], unscheduledPairs: [], failures: [] };

  const targets = suppliers.filter(s => canSupplierMeetBuyer(s, buyerId));
  const additions: Meeting[] = [];
  const unscheduledPairs: UnscheduledPair[] = [];
  const failures: PlacementFailure[] = [];
  const workingMeetings = [...meetings];

  for (const supplier of targets) {
    const slot = findSlotForPair(supplier, buyerId, timeSlots, workingMeetings);
    if (!slot) {
      const anyWindowSlot = timeSlots.some(
        s => !s.isBreak && isSlotInSupplierWindow(s, supplier) &&
          (!supplier.selectedDays || supplier.selectedDays.length === 0 || supplier.selectedDays.includes(s.date)),
      );
      const reason: PlacementFailureReason = anyWindowSlot
        ? 'buyer-fully-booked'
        : 'outside-supplier-window';
      unscheduledPairs.push({ supplierId: supplier.id, buyerId });
      failures.push({ supplierId: supplier.id, buyerId, reason });
      continue;
    }
    const meeting: Meeting = {
      id: generateId(),
      supplierId: supplier.id,
      buyerId,
      timeSlotId: slot.id,
      status: 'scheduled',
    };
    additions.push(meeting);
    workingMeetings.push(meeting);
  }

  return { additions, unscheduledPairs, failures };
}

/**
 * Rebalance a single supplier's meetings after their availability
 * changed. For each active meeting they own that no longer fits the
 * new window (or falls on a day they're no longer available), try to
 * relocate it to the first fitting open slot. If no slot fits, cancel
 * that meeting.
 *
 * Meetings that STILL fit the new window are left in place.
 * Other suppliers' meetings are never touched.
 */
export interface RebalanceResult {
  updatedMeetings: Meeting[];
  movedIds: string[];
  cancelledIds: string[];
}

export function rebalanceSupplier(
  supplierId: string,
  suppliers: Supplier[],
  timeSlots: TimeSlot[],
  meetings: Meeting[],
): RebalanceResult {
  const supplier = suppliers.find(s => s.id === supplierId);
  if (!supplier) return { updatedMeetings: meetings, movedIds: [], cancelledIds: [] };

  const slotById = new Map(timeSlots.map(s => [s.id, s]));

  const slotFits = (slot: TimeSlot | undefined): boolean => {
    if (!slot) return false;
    if (!isSlotInSupplierWindow(slot, supplier)) return false;
    const days = supplier.selectedDays;
    if (days && days.length > 0 && !days.includes(slot.date)) return false;
    return true;
  };

  const movedIds: string[] = [];
  const cancelledIds: string[] = [];
  // Work on a mutable copy so successive relocations see prior moves.
  let working = [...meetings];

  for (const m of meetings) {
    if (m.supplierId !== supplierId) continue;
    if (m.status === 'cancelled' || m.status === 'bumped') continue;
    const slot = slotById.get(m.timeSlotId);
    if (slotFits(slot)) continue;
    // Need to relocate. Simulate a working set with the current
    // meeting removed to avoid self-blocking.
    const withoutCurrent = working.filter(x => x.id !== m.id);
    const newSlot = findSlotForPair(supplier, m.buyerId, timeSlots, withoutCurrent);
    if (newSlot) {
      working = working.map(x => (x.id === m.id ? { ...x, timeSlotId: newSlot.id } : x));
      movedIds.push(m.id);
    } else {
      working = working.map(x => (x.id === m.id ? { ...x, status: 'cancelled' as const } : x));
      cancelledIds.push(m.id);
    }
  }

  return { updatedMeetings: working, movedIds, cancelledIds };
}

/**
 * Bulk-cancel every active meeting belonging to a supplier. Returns
 * the mutated meetings array plus the affected pairs so the caller
 * can dump them into `unscheduledPairs` for re-scheduling later.
 *
 * Optionally, `reassignTo` reassigns each cancelled pair to another
 * supplier via the placement primitive. That supplier's preferences
 * and window are respected; any pair that can't be reassigned lands
 * in unscheduledPairs.
 */
export interface RemoveSupplierResult {
  updatedMeetings: Meeting[];
  cancelledIds: string[];
  reassignments: Array<{ oldMeetingId: string; newMeeting: Meeting }>;
  unscheduledPairs: UnscheduledPair[];
}

export function removeSupplierFromEvent(
  supplierId: string,
  suppliers: Supplier[],
  _buyers: Buyer[],
  timeSlots: TimeSlot[],
  meetings: Meeting[],
  reassignTo?: string,
): RemoveSupplierResult {
  const cancelledIds: string[] = [];
  const reassignments: Array<{ oldMeetingId: string; newMeeting: Meeting }> = [];
  const unscheduledPairs: UnscheduledPair[] = [];
  let working = meetings.map(m => {
    if (m.supplierId === supplierId && m.status !== 'cancelled' && m.status !== 'bumped') {
      cancelledIds.push(m.id);
      return { ...m, status: 'cancelled' as const };
    }
    return m;
  });

  if (!reassignTo) {
    // Just add the affected buyers to unscheduledPairs so the admin
    // can re-place them by hand.
    for (const id of cancelledIds) {
      const original = meetings.find(m => m.id === id);
      if (original) {
        unscheduledPairs.push({ supplierId, buyerId: original.buyerId });
      }
    }
    return { updatedMeetings: working, cancelledIds, reassignments, unscheduledPairs };
  }

  // Reassign flow: try to place each cancelled pair with `reassignTo`.
  const newSupplier = suppliers.find(s => s.id === reassignTo);
  if (!newSupplier) {
    return { updatedMeetings: working, cancelledIds, reassignments, unscheduledPairs };
  }

  for (const id of cancelledIds) {
    const original = meetings.find(m => m.id === id);
    if (!original) continue;
    if (!canSupplierMeetBuyer(newSupplier, original.buyerId)) {
      unscheduledPairs.push({ supplierId, buyerId: original.buyerId });
      continue;
    }
    const slot = findSlotForPair(newSupplier, original.buyerId, timeSlots, working);
    if (!slot) {
      unscheduledPairs.push({ supplierId, buyerId: original.buyerId });
      continue;
    }
    const newMeeting: Meeting = {
      id: generateId(),
      supplierId: newSupplier.id,
      buyerId: original.buyerId,
      timeSlotId: slot.id,
      status: 'scheduled',
    };
    working = [...working, newMeeting];
    reassignments.push({ oldMeetingId: id, newMeeting });
  }

  return { updatedMeetings: working, cancelledIds, reassignments, unscheduledPairs };
}

/**
 * Given the desired earliest-time cutoff `HH:mm` on a specific
 * `date`, cancel or bump all active meetings for `supplierId` that
 * start before it. Used for the "late arrival" flow — a supplier
 * calls in at 10:00, everyone before 10:00 needs to move or drop.
 *
 * "Bump" tries to relocate to a later slot that day; if none fits,
 * the meeting is cancelled.
 */
export interface LateArrivalResult {
  updatedMeetings: Meeting[];
  movedIds: string[];
  cancelledIds: string[];
}

export function applyLateArrival(
  supplierId: string,
  date: string,
  earliestHHMM: string,
  suppliers: Supplier[],
  timeSlots: TimeSlot[],
  meetings: Meeting[],
): LateArrivalResult {
  const supplier = suppliers.find(s => s.id === supplierId);
  if (!supplier) return { updatedMeetings: meetings, movedIds: [], cancelledIds: [] };
  const slotById = new Map(timeSlots.map(s => [s.id, s]));

  const isBefore = (slot: TimeSlot | undefined): boolean => {
    if (!slot) return false;
    if (slot.date !== date) return false;
    const t = slot.startTime instanceof Date ? slot.startTime : new Date(slot.startTime);
    const hhmm = t.toTimeString().substring(0, 5);
    return hhmm < earliestHHMM;
  };

  const movedIds: string[] = [];
  const cancelledIds: string[] = [];
  let working = [...meetings];

  for (const m of meetings) {
    if (m.supplierId !== supplierId) continue;
    if (m.status === 'cancelled' || m.status === 'bumped') continue;
    const slot = slotById.get(m.timeSlotId);
    if (!isBefore(slot)) continue;
    // Find a later slot on the same day that fits.
    const laterSlots = timeSlots.filter(s => {
      if (s.isBreak || s.date !== date) return false;
      const t = s.startTime instanceof Date ? s.startTime : new Date(s.startTime);
      const hhmm = t.toTimeString().substring(0, 5);
      return hhmm >= earliestHHMM;
    });
    const withoutCurrent = working.filter(x => x.id !== m.id);
    let placed: TimeSlot | null = null;
    for (const s of laterSlots) {
      const active = activeMeetingsInSlot(s.id, withoutCurrent);
      const supplierBusy = active.some(x => x.supplierId === supplierId);
      const buyerBusy = active.some(x => x.buyerId === m.buyerId);
      if (!supplierBusy && !buyerBusy && isSlotInSupplierWindow(s, supplier)) {
        placed = s;
        break;
      }
    }
    if (placed) {
      working = working.map(x => (x.id === m.id ? { ...x, timeSlotId: placed!.id } : x));
      movedIds.push(m.id);
    } else {
      working = working.map(x => (x.id === m.id ? { ...x, status: 'cancelled' as const } : x));
      cancelledIds.push(m.id);
    }
  }

  return { updatedMeetings: working, movedIds, cancelledIds };
}

/**
 * Uniformly shift every active meeting whose slot start-time is >=
 * `fromHHMM` on `date` by `minutes`. Meetings are relocated to the
 * slot that starts at (original + minutes) IF one exists that day
 * and both parties are free. If no matching slot exists, the meeting
 * stays put; the caller should regenerate slots first if wanted.
 */
export interface ShiftScheduleResult {
  updatedMeetings: Meeting[];
  shiftedIds: string[];
  couldNotShiftIds: string[];
}

export function shiftScheduleAfter(
  date: string,
  fromHHMM: string,
  minutes: number,
  timeSlots: TimeSlot[],
  meetings: Meeting[],
): ShiftScheduleResult {
  const slotById = new Map(timeSlots.map(s => [s.id, s]));
  const slotStartHHMM = (s: TimeSlot): string => {
    const t = s.startTime instanceof Date ? s.startTime : new Date(s.startTime);
    return t.toTimeString().substring(0, 5);
  };
  const addMinutes = (hhmm: string, delta: number): string => {
    const [h, m] = hhmm.split(':').map(Number);
    const total = h * 60 + m + delta;
    const nh = Math.floor(total / 60);
    const nm = total % 60;
    return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
  };
  const slotAtDateTime = (d: string, hhmm: string): TimeSlot | undefined =>
    timeSlots.find(s => s.date === d && !s.isBreak && slotStartHHMM(s) === hhmm);

  const shiftedIds: string[] = [];
  const couldNotShiftIds: string[] = [];
  let working = [...meetings];

  for (const m of meetings) {
    if (m.status === 'cancelled' || m.status === 'bumped') continue;
    const slot = slotById.get(m.timeSlotId);
    if (!slot || slot.date !== date) continue;
    if (slotStartHHMM(slot) < fromHHMM) continue;
    const targetHHMM = addMinutes(slotStartHHMM(slot), minutes);
    const targetSlot = slotAtDateTime(date, targetHHMM);
    if (!targetSlot) {
      couldNotShiftIds.push(m.id);
      continue;
    }
    // Check both parties are free in the target (excluding self).
    const withoutSelf = working.filter(x => x.id !== m.id);
    const active = activeMeetingsInSlot(targetSlot.id, withoutSelf);
    const supplierBusy = active.some(x => x.supplierId === m.supplierId);
    const buyerBusy = active.some(x => x.buyerId === m.buyerId);
    if (supplierBusy || buyerBusy) {
      couldNotShiftIds.push(m.id);
      continue;
    }
    working = working.map(x => (x.id === m.id ? { ...x, timeSlotId: targetSlot.id } : x));
    shiftedIds.push(m.id);
  }

  return { updatedMeetings: working, shiftedIds, couldNotShiftIds };
}
