import { describe, it, expect } from 'vitest';
import {
  isBuyerAvailableAtSlot,
  isSupplierAvailableAtSlot,
  checkAddMeetingConflicts,
  checkMoveConflicts,
  getScheduleConflictsSummary,
  getConflictsForMeeting,
} from './conflictDetection';
import { makeSupplier, makeBuyer, makeSlot, makeMeeting } from './__testHelpers';

describe('isBuyerAvailableAtSlot', () => {
  it('returns true when no meetings exist', () => {
    expect(isBuyerAvailableAtSlot('b1', 'slot1', [])).toBe(true);
  });

  it('returns false when buyer has an active meeting at the slot', () => {
    const meetings = [makeMeeting('m1', 's1', 'b1', 'slot1')];
    expect(isBuyerAvailableAtSlot('b1', 'slot1', meetings)).toBe(false);
  });

  it('ignores cancelled and bumped meetings', () => {
    const meetings = [
      makeMeeting('m1', 's1', 'b1', 'slot1', 'cancelled'),
      makeMeeting('m2', 's2', 'b1', 'slot1', 'bumped'),
    ];
    expect(isBuyerAvailableAtSlot('b1', 'slot1', meetings)).toBe(true);
  });

  it('excludes the specified meetingId', () => {
    const meetings = [makeMeeting('m1', 's1', 'b1', 'slot1')];
    expect(isBuyerAvailableAtSlot('b1', 'slot1', meetings, 'm1')).toBe(true);
  });
});

describe('isSupplierAvailableAtSlot', () => {
  it('returns false when supplier has an active meeting at the slot', () => {
    const meetings = [makeMeeting('m1', 's1', 'b1', 'slot1')];
    expect(isSupplierAvailableAtSlot('s1', 'slot1', meetings)).toBe(false);
  });

  it('returns true when the supplier has meetings at different slots', () => {
    const meetings = [makeMeeting('m1', 's1', 'b1', 'slot2')];
    expect(isSupplierAvailableAtSlot('s1', 'slot1', meetings)).toBe(true);
  });
});

describe('checkAddMeetingConflicts', () => {
  it('returns no conflicts for a clean add', () => {
    const suppliers = [makeSupplier({ id: 's1' })];
    const buyers = [makeBuyer('b1')];
    const result = checkAddMeetingConflicts('s1', 'b1', 'slot1', [], suppliers, buyers);
    expect(result.hasConflicts).toBe(false);
    expect(result.hasErrors).toBe(false);
    expect(result.hasWarnings).toBe(false);
  });

  it('reports supplier_busy as a hard error when supplier is occupied', () => {
    const suppliers = [makeSupplier({ id: 's1' })];
    const buyers = [makeBuyer('b1'), makeBuyer('b2')];
    const meetings = [makeMeeting('m1', 's1', 'b2', 'slot1')];
    const result = checkAddMeetingConflicts('s1', 'b1', 'slot1', meetings, suppliers, buyers);
    expect(result.hasErrors).toBe(true);
    expect(result.conflicts.some(c => c.type === 'supplier_busy')).toBe(true);
  });

  it('reports buyer_busy as a warning (not blocking)', () => {
    const suppliers = [
      makeSupplier({ id: 's1' }),
      makeSupplier({ id: 's2', companyName: 'Other Co' }),
    ];
    const buyers = [makeBuyer('b1')];
    const meetings = [makeMeeting('m1', 's2', 'b1', 'slot1')];
    const result = checkAddMeetingConflicts('s1', 'b1', 'slot1', meetings, suppliers, buyers);
    expect(result.hasWarnings).toBe(true);
    expect(result.hasErrors).toBe(false);
    expect(result.conflicts.find(c => c.type === 'buyer_busy')?.severity).toBe('warning');
  });

  it('reports preference violation for excluded buyers', () => {
    const suppliers = [makeSupplier({ id: 's1', preference: 'exclude', preferenceList: ['b1'] })];
    const buyers = [makeBuyer('b1')];
    const result = checkAddMeetingConflicts('s1', 'b1', 'slot1', [], suppliers, buyers);
    expect(result.hasWarnings).toBe(true);
    expect(result.conflicts.some(c => c.type === 'preference_violation')).toBe(true);
  });

  it('returns no conflicts when supplier or buyer is unknown', () => {
    const result = checkAddMeetingConflicts('ghost', 'nobody', 'slot1', [], [], []);
    expect(result.hasConflicts).toBe(false);
  });
});

describe('checkMoveConflicts', () => {
  it('allows moving a meeting to an empty slot', () => {
    const suppliers = [makeSupplier({ id: 's1' })];
    const buyers = [makeBuyer('b1')];
    const meeting = makeMeeting('m1', 's1', 'b1', 'slot1');
    const result = checkMoveConflicts(meeting, 'slot2', [meeting], suppliers, buyers);
    expect(result.hasConflicts).toBe(false);
  });

  it('blocks moving when target slot is supplier-busy', () => {
    const suppliers = [makeSupplier({ id: 's1' })];
    const buyers = [makeBuyer('b1'), makeBuyer('b2')];
    const moving = makeMeeting('m1', 's1', 'b1', 'slot1');
    const blocker = makeMeeting('m2', 's1', 'b2', 'slot2');
    const result = checkMoveConflicts(moving, 'slot2', [moving, blocker], suppliers, buyers);
    expect(result.hasErrors).toBe(true);
  });
});

describe('getScheduleConflictsSummary', () => {
  it('detects buyer double-bookings', () => {
    const suppliers = [
      makeSupplier({ id: 's1', companyName: 'A' }),
      makeSupplier({ id: 's2', companyName: 'B' }),
    ];
    const buyers = [makeBuyer('b1')];
    const slots = [makeSlot('slot1', '2024-01-01', 9, 0)];
    const meetings = [
      makeMeeting('m1', 's1', 'b1', 'slot1'),
      makeMeeting('m2', 's2', 'b1', 'slot1'),
    ];
    const summary = getScheduleConflictsSummary(meetings, suppliers, buyers, slots);
    expect(summary.buyerDoubleBookings.length).toBe(1);
    expect(summary.buyerDoubleBookings[0].supplierNames).toHaveLength(2);
  });

  it('detects preference violations', () => {
    const suppliers = [
      makeSupplier({ id: 's1', preference: 'include', preferenceList: ['b2'] }),
    ];
    const buyers = [makeBuyer('b1'), makeBuyer('b2')];
    const slots = [makeSlot('slot1', '2024-01-01', 9, 0)];
    const meetings = [makeMeeting('m1', 's1', 'b1', 'slot1')];
    const summary = getScheduleConflictsSummary(meetings, suppliers, buyers, slots);
    expect(summary.preferenceViolations.length).toBe(1);
  });

  it('returns zero conflicts for a clean schedule', () => {
    const suppliers = [makeSupplier({ id: 's1' })];
    const buyers = [makeBuyer('b1')];
    const slots = [makeSlot('slot1', '2024-01-01', 9, 0)];
    const meetings = [makeMeeting('m1', 's1', 'b1', 'slot1')];
    const summary = getScheduleConflictsSummary(meetings, suppliers, buyers, slots);
    expect(summary.totalConflicts).toBe(0);
  });
});

describe('getConflictsForMeeting', () => {
  it('returns empty array for cancelled meetings', () => {
    const suppliers = [makeSupplier({ id: 's1' })];
    const buyers = [makeBuyer('b1')];
    const meeting = makeMeeting('m1', 's1', 'b1', 'slot1', 'cancelled');
    expect(getConflictsForMeeting(meeting, [meeting], suppliers, buyers)).toEqual([]);
  });

  it('flags preference violations', () => {
    const suppliers = [
      makeSupplier({ id: 's1', preference: 'exclude', preferenceList: ['b1'] }),
    ];
    const buyers = [makeBuyer('b1')];
    const meeting = makeMeeting('m1', 's1', 'b1', 'slot1');
    const conflicts = getConflictsForMeeting(meeting, [meeting], suppliers, buyers);
    expect(conflicts.some(c => c.type === 'preference_violation')).toBe(true);
  });
});
