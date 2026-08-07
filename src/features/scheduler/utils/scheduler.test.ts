import { describe, it, expect } from 'vitest';
import { isSlotInSupplierWindow, canSupplierMeetBuyer, findNextAvailableSlotAfter, bumpMeetingToLaterSlot } from './scheduler';
import { makeSupplier, makeSlot, makeMeeting } from './__testHelpers';

describe('isSlotInSupplierWindow', () => {
  it('returns true when supplier has no time window', () => {
    const supplier = makeSupplier();
    expect(isSlotInSupplierWindow(makeSlot('s', '2024-01-01', 8, 0), supplier)).toBe(true);
  });

  it('returns false for slots starting before availableFrom', () => {
    const supplier = makeSupplier({ availableFrom: '09:00' });
    expect(isSlotInSupplierWindow(makeSlot('s', '2024-01-01', 8, 30), supplier)).toBe(false);
  });

  it('returns true for slots starting exactly at availableFrom', () => {
    const supplier = makeSupplier({ availableFrom: '09:00' });
    expect(isSlotInSupplierWindow(makeSlot('s', '2024-01-01', 9, 0), supplier)).toBe(true);
  });

  it('treats availableTo as exclusive upper bound', () => {
    const supplier = makeSupplier({ availableTo: '12:00' });
    expect(isSlotInSupplierWindow(makeSlot('s', '2024-01-01', 12, 0), supplier)).toBe(false);
    expect(isSlotInSupplierWindow(makeSlot('s', '2024-01-01', 11, 30), supplier)).toBe(true);
  });

  it('accepts slots within a bounded window', () => {
    const supplier = makeSupplier({ availableFrom: '09:00', availableTo: '12:00' });
    expect(isSlotInSupplierWindow(makeSlot('s', '2024-01-01', 10, 30), supplier)).toBe(true);
  });
});

describe('canSupplierMeetBuyer', () => {
  it('returns true for all buyers when preference is "all"', () => {
    const supplier = makeSupplier({ preference: 'all', preferenceList: [] });
    expect(canSupplierMeetBuyer(supplier, 'b1')).toBe(true);
  });

  it('returns true only for listed buyers when preference is "include"', () => {
    const supplier = makeSupplier({ preference: 'include', preferenceList: ['b1', 'b2'] });
    expect(canSupplierMeetBuyer(supplier, 'b1')).toBe(true);
    expect(canSupplierMeetBuyer(supplier, 'b3')).toBe(false);
  });

  it('returns false for listed buyers when preference is "exclude"', () => {
    const supplier = makeSupplier({ preference: 'exclude', preferenceList: ['b1'] });
    expect(canSupplierMeetBuyer(supplier, 'b1')).toBe(false);
    expect(canSupplierMeetBuyer(supplier, 'b2')).toBe(true);
  });
});

describe('findNextAvailableSlotAfter', () => {
  const slots = [
    makeSlot('slot1', '2024-01-01', 9, 0),
    makeSlot('slot2', '2024-01-01', 9, 30),
    makeSlot('slot3', '2024-01-01', 10, 0),
    makeSlot('slot4', '2024-01-01', 10, 30),
    makeSlot('slot5', '2024-01-01', 11, 0),
  ];

  it('finds the next open slot when supplier and buyer are both free', () => {
    const meeting = makeMeeting('m1', 's1', 'b1', 'slot1');
    const next = findNextAvailableSlotAfter(meeting, slots, [meeting], 'slot1');
    expect(next?.id).toBe('slot2');
  });

  it('skips slots outside the supplier availability window', () => {
    // Supplier can only meet until 10:00 — slots 3, 4, 5 should be skipped.
    const supplier = makeSupplier({ id: 's1', availableTo: '10:00' });
    const meeting = makeMeeting('m1', 's1', 'b1', 'slot1');
    const next = findNextAvailableSlotAfter(meeting, slots, [meeting], 'slot1', supplier);
    // Only slot2 (9:30) is left inside the window
    expect(next?.id).toBe('slot2');
    // From slot2, there are no more in-window slots
    expect(findNextAvailableSlotAfter(meeting, slots, [meeting], 'slot2', supplier)).toBeNull();
  });

  it('skips days the supplier is not attending', () => {
    const daySlots = [
      makeSlot('slot1', '2024-01-01', 9, 0),
      makeSlot('slot2', '2024-01-02', 9, 0),
    ];
    const supplier = makeSupplier({ id: 's1', selectedDays: ['2024-01-01'] });
    const meeting = makeMeeting('m1', 's1', 'b1', 'slot1');
    const next = findNextAvailableSlotAfter(meeting, daySlots, [meeting], 'slot1', supplier);
    // slot2 is on 2024-01-02, which the supplier didn't select; expect no result
    expect(next).toBeNull();
  });
});

describe('bumpMeetingToLaterSlot', () => {
  const slots = [
    makeSlot('slot1', '2024-01-01', 9, 0),
    makeSlot('slot2', '2024-01-01', 9, 30),
    makeSlot('slot3', '2024-01-01', 10, 0),
  ];

  it('marks the original meeting bumped and adds a new one at the next slot', () => {
    const meeting = makeMeeting('m1', 's1', 'b1', 'slot1');
    const suppliers = [makeSupplier({ id: 's1' })];
    const result = bumpMeetingToLaterSlot('m1', [meeting], slots, suppliers);
    expect(result.success).toBe(true);
    expect(result.newSlotId).toBe('slot2');
    const bumped = result.updatedMeetings.find(m => m.id === 'm1');
    expect(bumped?.status).toBe('bumped');
    const rescheduled = result.updatedMeetings.find(m => m.id !== 'm1');
    expect(rescheduled?.timeSlotId).toBe('slot2');
    expect(rescheduled?.status).toBe('scheduled');
  });

  it('refuses to bump into a slot outside supplier availability', () => {
    const meeting = makeMeeting('m1', 's1', 'b1', 'slot1');
    // Only slot1 is inside window; slot2 (9:30) and slot3 (10:00) are not.
    const suppliers = [makeSupplier({ id: 's1', availableTo: '09:30' })];
    const result = bumpMeetingToLaterSlot('m1', [meeting], slots, suppliers);
    expect(result.success).toBe(false);
  });
});
