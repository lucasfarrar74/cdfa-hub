import { describe, it, expect } from 'vitest';
import { computeSyncOutcome, getProjectRevision } from './syncOutcome';
import { makeMeeting } from './__testHelpers';

describe('getProjectRevision', () => {
  it('returns 0 when the project is null or undefined', () => {
    expect(getProjectRevision(null)).toBe(0);
    expect(getProjectRevision(undefined)).toBe(0);
  });

  it('returns 0 when the field is missing (legacy projects)', () => {
    expect(getProjectRevision({} as { revision?: number })).toBe(0);
  });

  it('returns the numeric revision when set', () => {
    expect(getProjectRevision({ revision: 7 })).toBe(7);
  });

  it('coerces non-finite values to 0', () => {
    expect(getProjectRevision({ revision: Number.NaN })).toBe(0);
    expect(getProjectRevision({ revision: Number.POSITIVE_INFINITY })).toBe(0);
  });
});

describe('computeSyncOutcome', () => {
  const safeMeetings = [
    makeMeeting('m1', 's1', 'b1', 'slot1'),
    makeMeeting('m2', 's1', 'b2', 'slot2'),
  ];

  it('proceeds when base matches server and meetings are clean', () => {
    expect(computeSyncOutcome(3, 3, safeMeetings)).toBe('proceed');
  });

  it('reports conflict when server has advanced past our base', () => {
    expect(computeSyncOutcome(3, 4, safeMeetings)).toBe('conflict');
  });

  it('reports conflict when server is behind our base (defensive)', () => {
    expect(computeSyncOutcome(4, 3, safeMeetings)).toBe('conflict');
  });

  it('flags would-double-book when meetings contain a supplier stack', () => {
    const stacked = [
      makeMeeting('m1', 's1', 'b1', 'slot1'),
      makeMeeting('m2', 's1', 'b2', 'slot1'),
    ];
    expect(computeSyncOutcome(3, 3, stacked)).toBe('would-double-book');
  });

  it('flags would-double-book when meetings contain a buyer stack', () => {
    const stacked = [
      makeMeeting('m1', 's1', 'b1', 'slot1'),
      makeMeeting('m2', 's2', 'b1', 'slot1'),
    ];
    expect(computeSyncOutcome(3, 3, stacked)).toBe('would-double-book');
  });

  it('reports conflict before would-double-book (revision mismatch is the earlier failure)', () => {
    // A revision mismatch means our meetings aren't going to be written
    // anyway; no point complaining about their content.
    const stacked = [
      makeMeeting('m1', 's1', 'b1', 'slot1'),
      makeMeeting('m2', 's1', 'b2', 'slot1'),
    ];
    expect(computeSyncOutcome(3, 4, stacked)).toBe('conflict');
  });

  it('treats matching revisions of 0 as a safe first write', () => {
    expect(computeSyncOutcome(0, 0, safeMeetings)).toBe('proceed');
  });
});
