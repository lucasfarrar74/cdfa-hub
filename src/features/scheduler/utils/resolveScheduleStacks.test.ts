import { describe, it, expect } from 'vitest';
import { resolveScheduleStacks, preferenceScoreForMeeting } from './resolveScheduleStacks';
import { makeSupplier, makeMeeting } from './__testHelpers';

describe('preferenceScoreForMeeting', () => {
  it('scores 3 when include list contains the buyer', () => {
    const supplier = makeSupplier({ id: 's1', preference: 'include', preferenceList: ['b1'] });
    expect(preferenceScoreForMeeting(makeMeeting('m', 's1', 'b1', 'slot'), supplier)).toBe(3);
  });

  it('scores 1 when include list does NOT contain the buyer', () => {
    const supplier = makeSupplier({ id: 's1', preference: 'include', preferenceList: ['b1'] });
    expect(preferenceScoreForMeeting(makeMeeting('m', 's1', 'b2', 'slot'), supplier)).toBe(1);
  });

  it('scores 0 when exclude list contains the buyer', () => {
    const supplier = makeSupplier({ id: 's1', preference: 'exclude', preferenceList: ['b1'] });
    expect(preferenceScoreForMeeting(makeMeeting('m', 's1', 'b1', 'slot'), supplier)).toBe(0);
  });

  it('scores 2 for all-preference and exclude-not-in-list', () => {
    const allSupplier = makeSupplier({ id: 's1', preference: 'all' });
    const excludeSupplier = makeSupplier({ id: 's2', preference: 'exclude', preferenceList: ['b1'] });
    expect(preferenceScoreForMeeting(makeMeeting('m', 's1', 'b1', 'slot'), allSupplier)).toBe(2);
    expect(preferenceScoreForMeeting(makeMeeting('m', 's2', 'b2', 'slot'), excludeSupplier)).toBe(2);
  });
});

describe('resolveScheduleStacks', () => {
  it('is a no-op when there are no stacks', () => {
    const meetings = [
      makeMeeting('m1', 's1', 'b1', 'slot1'),
      makeMeeting('m2', 's1', 'b2', 'slot2'),
    ];
    const { updatedMeetings, cancelledIds } = resolveScheduleStacks(meetings, [makeSupplier({ id: 's1' })]);
    expect(cancelledIds).toEqual([]);
    expect(updatedMeetings).toEqual(meetings);
  });

  it('cancels the lower-scoring meeting in a supplier stack', () => {
    // s1 is include=[b1]. m1 (with b1) scores 3, m2 (with b2) scores 1.
    // Should keep m1 and cancel m2.
    const suppliers = [makeSupplier({ id: 's1', preference: 'include', preferenceList: ['b1'] })];
    const meetings = [
      makeMeeting('m1', 's1', 'b1', 'slot1'),
      makeMeeting('m2', 's1', 'b2', 'slot1'),
    ];
    const { updatedMeetings, cancelledIds } = resolveScheduleStacks(meetings, suppliers);
    expect(cancelledIds).toEqual(['m2']);
    expect(updatedMeetings.find(m => m.id === 'm2')?.status).toBe('cancelled');
    expect(updatedMeetings.find(m => m.id === 'm1')?.status).toBe('scheduled');
  });

  it('falls back to lex-smallest ID when scores tie', () => {
    // s1 is preference='all' → both meetings score 2.
    // Tiebreaker: keep the meeting whose ID sorts first alphabetically.
    const suppliers = [makeSupplier({ id: 's1', preference: 'all' })];
    const meetings = [
      makeMeeting('zzzz', 's1', 'b1', 'slot1'),
      makeMeeting('aaaa', 's1', 'b2', 'slot1'),
    ];
    const { cancelledIds } = resolveScheduleStacks(meetings, suppliers);
    expect(cancelledIds).toEqual(['zzzz']);
  });

  it('handles multiple stacks in one call', () => {
    const suppliers = [
      makeSupplier({ id: 's1', preference: 'all' }),
      makeSupplier({ id: 's2', preference: 'all' }),
    ];
    const meetings = [
      makeMeeting('m1', 's1', 'b1', 'slot1'),
      makeMeeting('m2', 's1', 'b2', 'slot1'), // s1 stack at slot1
      makeMeeting('m3', 's2', 'b1', 'slot2'),
      makeMeeting('m4', 's2', 'b2', 'slot2'), // s2 stack at slot2
    ];
    const { cancelledIds } = resolveScheduleStacks(meetings, suppliers);
    expect(cancelledIds.sort()).toEqual(['m2', 'm4']);
  });

  it('does not cancel meetings that are already cancelled or bumped', () => {
    // If two meetings share a slot but one is already cancelled, the
    // remaining active meeting isn't in any stack, so nothing changes.
    const suppliers = [makeSupplier({ id: 's1' })];
    const meetings = [
      makeMeeting('m1', 's1', 'b1', 'slot1'),
      makeMeeting('m2', 's1', 'b2', 'slot1', 'cancelled'),
    ];
    const { cancelledIds } = resolveScheduleStacks(meetings, suppliers);
    expect(cancelledIds).toEqual([]);
  });
});
