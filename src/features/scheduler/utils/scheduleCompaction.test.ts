import { describe, it, expect } from 'vitest';
import { compactSchedule } from './scheduleCompaction';
import type { Meeting } from '../types';
import { makeSupplier, makeBuyer, makeSlot, makeMeeting } from './__testHelpers';

/**
 * Assert no supplier or buyer holds more than one meeting at the same slot.
 * This is the core invariant the compaction must preserve.
 */
function assertNoDoubleBookings(meetings: Meeting[]) {
  const supplierSlot = new Set<string>();
  const buyerSlot = new Set<string>();
  const active = meetings.filter(m => m.status !== 'cancelled' && m.status !== 'bumped');
  for (const m of active) {
    const sKey = `${m.supplierId}:${m.timeSlotId}`;
    const bKey = `${m.buyerId}:${m.timeSlotId}`;
    expect(supplierSlot.has(sKey), `supplier ${m.supplierId} double-booked at slot ${m.timeSlotId}`).toBe(false);
    expect(buyerSlot.has(bKey), `buyer ${m.buyerId} double-booked at slot ${m.timeSlotId}`).toBe(false);
    supplierSlot.add(sKey);
    buyerSlot.add(bKey);
  }
}

describe('compactSchedule', () => {
  it('returns a new array (does not mutate input)', () => {
    const suppliers = [makeSupplier({ id: 's1' })];
    const buyers = [makeBuyer('b1')];
    const slots = [makeSlot('slot1', '2024-01-01', 9, 0)];
    const meetings = [makeMeeting('m1', 's1', 'b1', 'slot1')];

    const result = compactSchedule(meetings, slots, suppliers, buyers);
    expect(result).not.toBe(meetings);
    expect(result[0]).not.toBe(meetings[0]);
  });

  it('preserves meeting count (never drops or adds meetings)', () => {
    const suppliers = [
      makeSupplier({ id: 's1', companyName: 'A' }),
      makeSupplier({ id: 's2', companyName: 'B' }),
    ];
    const buyers = [makeBuyer('b1'), makeBuyer('b2'), makeBuyer('b3'), makeBuyer('b4')];
    const slots = [
      makeSlot('slot1', '2024-01-01', 9, 0),
      makeSlot('slot2', '2024-01-01', 9, 30),
      makeSlot('slot3', '2024-01-01', 10, 0),
      makeSlot('slot4', '2024-01-01', 10, 30),
    ];
    const meetings = [
      makeMeeting('m1', 's1', 'b1', 'slot1'),
      makeMeeting('m2', 's1', 'b2', 'slot4'),
      makeMeeting('m3', 's2', 'b3', 'slot2'),
      makeMeeting('m4', 's2', 'b4', 'slot3'),
    ];

    const result = compactSchedule(meetings, slots, suppliers, buyers);
    expect(result.length).toBe(meetings.length);
  });

  it('fills a supplier gap by relocating one of their own meetings (phase 1)', () => {
    // Supplier s1 has 5 available slots and 3 meetings clustered as {slot1, slot2, slot5}.
    // The gap [slot3, slot4] (length 2) costs penalty 1. The heuristic picks the
    // cheapest meeting to vacate — slot1, since removing it creates no new gap run >= 2
    // (slot1 becomes a single empty, not penalized). So m1 moves from slot1 to slot3.
    const suppliers = [makeSupplier({ id: 's1', companyName: 'A' })];
    const buyers = [makeBuyer('b1'), makeBuyer('b2'), makeBuyer('b3')];
    const slots = [
      makeSlot('slot1', '2024-01-01', 9, 0),
      makeSlot('slot2', '2024-01-01', 9, 30),
      makeSlot('slot3', '2024-01-01', 10, 0),
      makeSlot('slot4', '2024-01-01', 10, 30),
      makeSlot('slot5', '2024-01-01', 11, 0),
    ];
    const meetings = [
      makeMeeting('m1', 's1', 'b1', 'slot1'),
      makeMeeting('m2', 's1', 'b2', 'slot2'),
      makeMeeting('m3', 's1', 'b3', 'slot5'),
    ];

    const result = compactSchedule(meetings, slots, suppliers, buyers);
    const m1After = result.find(m => m.id === 'm1')!;
    expect(m1After.timeSlotId).toBe('slot3');
    assertNoDoubleBookings(result);
    expect(result.length).toBe(3);
  });

  it('respects supplier availability window (availableTo)', () => {
    // Supplier can only meet between 09:00 and 10:00.
    // Compaction should never place their meetings at slot3 (10:00) or slot4 (10:30).
    const suppliers = [
      makeSupplier({ id: 's1', companyName: 'A', availableFrom: '09:00', availableTo: '10:00' }),
    ];
    const buyers = [makeBuyer('b1')];
    const slots = [
      makeSlot('slot1', '2024-01-01', 9, 0),
      makeSlot('slot2', '2024-01-01', 9, 30),
      makeSlot('slot3', '2024-01-01', 10, 0),
      makeSlot('slot4', '2024-01-01', 10, 30),
    ];
    const meetings = [makeMeeting('m1', 's1', 'b1', 'slot1')];

    const result = compactSchedule(meetings, slots, suppliers, buyers);
    // m1 should remain at slot1 — no gap to fix, nothing to move
    expect(result[0].timeSlotId).toBe('slot1');
    assertNoDoubleBookings(result);
  });

  it('never creates double-bookings in a multi-supplier swap scenario (regression for PR #1)', () => {
    // This setup creates overlap pressure where the cross-supplier swap phase could
    // previously leave supplier B with two meetings at the same slot. The compaction
    // must either skip the unsafe swap or execute it safely — never produce conflicts.
    const suppliers = [
      makeSupplier({ id: 's1', companyName: 'A' }),
      makeSupplier({ id: 's2', companyName: 'B' }),
    ];
    const buyers = [
      makeBuyer('b1'),
      makeBuyer('b2'),
      makeBuyer('b3'),
      makeBuyer('b4'),
      makeBuyer('b5'),
    ];
    const slots = [
      makeSlot('slot1', '2024-01-01', 9, 0),
      makeSlot('slot2', '2024-01-01', 9, 30),
      makeSlot('slot3', '2024-01-01', 10, 0),
      makeSlot('slot4', '2024-01-01', 10, 30),
      makeSlot('slot5', '2024-01-01', 11, 0),
    ];
    // Supplier A: meetings at slot1 and slot5 (gap in middle)
    // Supplier B: meetings at slot2, slot3, slot5 — competes for slot5 with A
    const meetings = [
      makeMeeting('m1', 's1', 'b1', 'slot1'),
      makeMeeting('m2', 's1', 'b2', 'slot5'),
      makeMeeting('m3', 's2', 'b3', 'slot2'),
      makeMeeting('m4', 's2', 'b4', 'slot3'),
      makeMeeting('m5', 's2', 'b5', 'slot5'),
    ];

    const result = compactSchedule(meetings, slots, suppliers, buyers);

    // Core invariant: no supplier or buyer may have two active meetings in the same slot.
    assertNoDoubleBookings(result);
    expect(result.length).toBe(meetings.length);
  });

  it('ignores cancelled and bumped meetings when checking occupancy', () => {
    const suppliers = [makeSupplier({ id: 's1', companyName: 'A' })];
    const buyers = [makeBuyer('b1'), makeBuyer('b2')];
    const slots = [
      makeSlot('slot1', '2024-01-01', 9, 0),
      makeSlot('slot2', '2024-01-01', 9, 30),
    ];
    const meetings = [
      makeMeeting('m1', 's1', 'b1', 'slot1', 'cancelled'),
      makeMeeting('m2', 's1', 'b2', 'slot2', 'scheduled'),
    ];

    const result = compactSchedule(meetings, slots, suppliers, buyers);
    // Cancelled meeting should still appear in output (we don't drop)
    expect(result.length).toBe(2);
    assertNoDoubleBookings(result);
  });
});
