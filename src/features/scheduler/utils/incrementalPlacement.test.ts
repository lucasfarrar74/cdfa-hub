import { describe, it, expect } from 'vitest';
import {
  placeSupplierIncrementally,
  placeBuyerIncrementally,
  rebalanceSupplier,
  removeSupplierFromEvent,
  applyLateArrival,
  shiftScheduleAfter,
} from './incrementalPlacement';
import { makeSupplier, makeBuyer, makeSlot, makeMeeting } from './__testHelpers';
import { findAllDoubleBookings } from './conflictDetection';

describe('placeSupplierIncrementally', () => {
  it('places one meeting per buyer when the schedule is empty', () => {
    const supplier = makeSupplier({ id: 's1', preference: 'all' });
    const buyers = [makeBuyer('b1'), makeBuyer('b2'), makeBuyer('b3')];
    const slots = [
      makeSlot('slot1', '2024-01-01', 9, 0),
      makeSlot('slot2', '2024-01-01', 9, 30),
      makeSlot('slot3', '2024-01-01', 10, 0),
    ];
    const result = placeSupplierIncrementally('s1', [supplier], buyers, slots, []);
    expect(result.additions).toHaveLength(3);
    expect(result.unscheduledPairs).toHaveLength(0);
    // Meetings should target different slots (no supplier stack).
    const usedSlots = result.additions.map(m => m.timeSlotId);
    expect(new Set(usedSlots).size).toBe(3);
  });

  it('respects preference: include list', () => {
    const supplier = makeSupplier({ id: 's1', preference: 'include', preferenceList: ['b1'] });
    const buyers = [makeBuyer('b1'), makeBuyer('b2'), makeBuyer('b3')];
    const slots = [
      makeSlot('slot1', '2024-01-01', 9, 0),
      makeSlot('slot2', '2024-01-01', 9, 30),
      makeSlot('slot3', '2024-01-01', 10, 0),
    ];
    const result = placeSupplierIncrementally('s1', [supplier], buyers, slots, []);
    expect(result.additions).toHaveLength(1);
    expect(result.additions[0].buyerId).toBe('b1');
  });

  it('does not create double bookings when other meetings already occupy slots', () => {
    // Two existing suppliers already meet b1 in slot1 and slot2.
    // New supplier s3 (preference all) should NOT collide with b1's
    // active meetings — they can't meet b1 in slot1 or slot2.
    const supplier1 = makeSupplier({ id: 's1', preference: 'all' });
    const supplier2 = makeSupplier({ id: 's2', preference: 'all' });
    const supplier3 = makeSupplier({ id: 's3', preference: 'all' });
    const buyers = [makeBuyer('b1'), makeBuyer('b2')];
    const slots = [
      makeSlot('slot1', '2024-01-01', 9, 0),
      makeSlot('slot2', '2024-01-01', 9, 30),
      makeSlot('slot3', '2024-01-01', 10, 0),
      makeSlot('slot4', '2024-01-01', 10, 30),
    ];
    const meetings = [
      makeMeeting('m1', 's1', 'b1', 'slot1'),
      makeMeeting('m2', 's2', 'b1', 'slot2'),
    ];
    const result = placeSupplierIncrementally(
      's3',
      [supplier1, supplier2, supplier3],
      buyers,
      slots,
      meetings,
    );
    const all = [...meetings, ...result.additions];
    expect(findAllDoubleBookings(all)).toEqual([]);
  });

  it('surfaces buyer-fully-booked when a buyer has no free slot in the supplier window', () => {
    // Supplier can only meet in the 9:00 slot (availableTo=09:15).
    // b1 already booked in slot1 with someone else.
    const supplier1 = makeSupplier({ id: 's1', preference: 'all' });
    const supplier2 = makeSupplier({ id: 's2', preference: 'all', availableTo: '09:15' });
    const buyers = [makeBuyer('b1')];
    const slots = [
      makeSlot('slot1', '2024-01-01', 9, 0),
      makeSlot('slot2', '2024-01-01', 9, 30),
    ];
    const meetings = [makeMeeting('m1', 's1', 'b1', 'slot1')];
    const result = placeSupplierIncrementally('s2', [supplier1, supplier2], buyers, slots, meetings);
    expect(result.additions).toEqual([]);
    expect(result.failures[0].reason).toBe('buyer-fully-booked');
  });
});

describe('placeBuyerIncrementally', () => {
  it('places the new buyer against every supplier that allows them', () => {
    const suppliers = [
      makeSupplier({ id: 's1', preference: 'all' }),
      makeSupplier({ id: 's2', preference: 'exclude', preferenceList: ['b1'] }),
      makeSupplier({ id: 's3', preference: 'include', preferenceList: ['b2'] }),
    ];
    const buyers = [makeBuyer('b1')];
    const slots = [
      makeSlot('slot1', '2024-01-01', 9, 0),
      makeSlot('slot2', '2024-01-01', 9, 30),
      makeSlot('slot3', '2024-01-01', 10, 0),
    ];
    const result = placeBuyerIncrementally('b1', suppliers, buyers, slots, []);
    // s1 accepts b1 (all). s2 excludes b1 (skip). s3 includes only b2 (skip).
    expect(result.additions).toHaveLength(1);
    expect(result.additions[0].supplierId).toBe('s1');
  });
});

describe('rebalanceSupplier', () => {
  it('leaves already-fitting meetings alone and moves out-of-window ones', () => {
    // Supplier had availableTo="12:00" originally with meetings at 9:00 and 11:00.
    // Now availableTo="10:00" — the 11:00 meeting must move.
    const supplier = makeSupplier({ id: 's1', preference: 'all', availableTo: '10:00' });
    const slots = [
      makeSlot('slot1', '2024-01-01', 9, 0),
      makeSlot('slot2', '2024-01-01', 9, 30),
      makeSlot('slot3', '2024-01-01', 11, 0),
    ];
    const meetings = [
      makeMeeting('m1', 's1', 'b1', 'slot1'),
      makeMeeting('m2', 's1', 'b2', 'slot3'), // outside new window
    ];
    const result = rebalanceSupplier('s1', [supplier], slots, meetings);
    expect(result.movedIds).toContain('m2');
    // m2 should land on slot2 (9:30) — the only fitting free slot.
    expect(result.updatedMeetings.find(m => m.id === 'm2')?.timeSlotId).toBe('slot2');
    expect(result.updatedMeetings.find(m => m.id === 'm1')?.timeSlotId).toBe('slot1');
  });

  it("cancels meetings that can't fit anywhere in the new window", () => {
    const supplier = makeSupplier({ id: 's1', preference: 'all', availableTo: '09:15' });
    const slots = [
      makeSlot('slot1', '2024-01-01', 9, 0),
      makeSlot('slot2', '2024-01-01', 9, 30),
      makeSlot('slot3', '2024-01-01', 10, 0),
    ];
    const meetings = [
      makeMeeting('m1', 's1', 'b1', 'slot1'), // fits
      makeMeeting('m2', 's1', 'b2', 'slot2'), // outside; slot1 taken; nowhere else
    ];
    const result = rebalanceSupplier('s1', [supplier], slots, meetings);
    expect(result.cancelledIds).toContain('m2');
    expect(result.updatedMeetings.find(m => m.id === 'm2')?.status).toBe('cancelled');
  });

  it('does not touch other suppliers', () => {
    const supplier1 = makeSupplier({ id: 's1', preference: 'all', availableTo: '09:15' });
    const supplier2 = makeSupplier({ id: 's2', preference: 'all' });
    const slots = [
      makeSlot('slot1', '2024-01-01', 9, 0),
      makeSlot('slot2', '2024-01-01', 9, 30),
    ];
    const meetings = [
      makeMeeting('m1', 's1', 'b1', 'slot2'), // s1 outside window
      makeMeeting('m2', 's2', 'b1', 'slot1'), // s2 unrelated
    ];
    const result = rebalanceSupplier('s1', [supplier1, supplier2], slots, meetings);
    expect(result.updatedMeetings.find(m => m.id === 'm2')?.timeSlotId).toBe('slot1');
    expect(result.updatedMeetings.find(m => m.id === 'm2')?.status).toBe('scheduled');
  });
});

describe('removeSupplierFromEvent', () => {
  it('cancels all active meetings without touching others', () => {
    const suppliers = [makeSupplier({ id: 's1' }), makeSupplier({ id: 's2' })];
    const buyers = [makeBuyer('b1'), makeBuyer('b2')];
    const slots = [makeSlot('slot1', '2024-01-01', 9, 0)];
    const meetings = [
      makeMeeting('m1', 's1', 'b1', 'slot1'),
      makeMeeting('m2', 's2', 'b2', 'slot1'),
    ];
    const result = removeSupplierFromEvent('s1', suppliers, buyers, slots, meetings);
    expect(result.cancelledIds).toEqual(['m1']);
    expect(result.updatedMeetings.find(m => m.id === 'm1')?.status).toBe('cancelled');
    expect(result.updatedMeetings.find(m => m.id === 'm2')?.status).toBe('scheduled');
    expect(result.unscheduledPairs).toEqual([{ supplierId: 's1', buyerId: 'b1' }]);
  });

  it("reassigns to a replacement supplier when the target allows", () => {
    const suppliers = [
      makeSupplier({ id: 's1', preference: 'all' }),
      makeSupplier({ id: 's2', preference: 'all' }),
    ];
    const buyers = [makeBuyer('b1')];
    const slots = [
      makeSlot('slot1', '2024-01-01', 9, 0),
      makeSlot('slot2', '2024-01-01', 9, 30),
    ];
    const meetings = [makeMeeting('m1', 's1', 'b1', 'slot1')];
    const result = removeSupplierFromEvent('s1', suppliers, buyers, slots, meetings, 's2');
    expect(result.cancelledIds).toEqual(['m1']);
    expect(result.reassignments).toHaveLength(1);
    expect(result.reassignments[0].newMeeting.supplierId).toBe('s2');
  });
});

describe('applyLateArrival', () => {
  it('bumps meetings before the cutoff to a later same-day slot', () => {
    const supplier = makeSupplier({ id: 's1', preference: 'all' });
    const slots = [
      makeSlot('slot1', '2024-01-01', 9, 0),
      makeSlot('slot2', '2024-01-01', 10, 30),
      makeSlot('slot3', '2024-01-01', 11, 0),
    ];
    const meetings = [makeMeeting('m1', 's1', 'b1', 'slot1')];
    const result = applyLateArrival('s1', '2024-01-01', '10:00', [supplier], slots, meetings);
    expect(result.movedIds).toEqual(['m1']);
    // m1 should now be at 10:30 (the earliest ≥ 10:00 free slot).
    expect(result.updatedMeetings.find(m => m.id === 'm1')?.timeSlotId).toBe('slot2');
  });

  it("cancels meetings that can't fit later that day", () => {
    const supplier = makeSupplier({ id: 's1', preference: 'all' });
    const slots = [
      makeSlot('slot1', '2024-01-01', 9, 0),
    ];
    const meetings = [makeMeeting('m1', 's1', 'b1', 'slot1')];
    const result = applyLateArrival('s1', '2024-01-01', '10:00', [supplier], slots, meetings);
    expect(result.cancelledIds).toEqual(['m1']);
  });
});

describe('shiftScheduleAfter', () => {
  it('moves all active meetings at or after the cutoff to slot-N-minutes-later', () => {
    const slots = [
      makeSlot('slot1', '2024-01-01', 9, 0),
      makeSlot('slot2', '2024-01-01', 9, 30),
      makeSlot('slot3', '2024-01-01', 10, 0),
      makeSlot('slot4', '2024-01-01', 10, 30),
    ];
    const meetings = [
      makeMeeting('m1', 's1', 'b1', 'slot1'),
      makeMeeting('m2', 's1', 'b2', 'slot2'),
      makeMeeting('m3', 's2', 'b1', 'slot3'),
    ];
    // Shift everything at/after 09:30 by +30 min.
    const result = shiftScheduleAfter('2024-01-01', '09:30', 30, slots, meetings);
    expect(result.shiftedIds.sort()).toEqual(['m2', 'm3']);
    expect(result.updatedMeetings.find(m => m.id === 'm2')?.timeSlotId).toBe('slot3');
    expect(result.updatedMeetings.find(m => m.id === 'm3')?.timeSlotId).toBe('slot4');
    expect(result.updatedMeetings.find(m => m.id === 'm1')?.timeSlotId).toBe('slot1');
  });

  it("leaves a meeting that can't shift (no matching later slot) in place", () => {
    const slots = [
      makeSlot('slot1', '2024-01-01', 9, 0),
      makeSlot('slot2', '2024-01-01', 9, 30),
    ];
    const meetings = [makeMeeting('m1', 's1', 'b1', 'slot2')];
    const result = shiftScheduleAfter('2024-01-01', '09:00', 30, slots, meetings);
    expect(result.couldNotShiftIds).toEqual(['m1']);
    expect(result.updatedMeetings.find(m => m.id === 'm1')?.timeSlotId).toBe('slot2');
  });
});
