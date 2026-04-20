import { describe, it, expect } from 'vitest';
import { scoreSchedule, compositeScore, getQualityLabel } from './scheduleScoring';
import { makeSupplier, makeSlot, makeMeeting } from './__testHelpers';

describe('scoreSchedule', () => {
  it('scores a fully packed schedule as 0', () => {
    const suppliers = [makeSupplier({ id: 's1' })];
    const slots = [
      makeSlot('slot1', '2024-01-01', 9, 0),
      makeSlot('slot2', '2024-01-01', 9, 30),
      makeSlot('slot3', '2024-01-01', 10, 0),
    ];
    const meetings = [
      makeMeeting('m1', 's1', 'b1', 'slot1'),
      makeMeeting('m2', 's1', 'b2', 'slot2'),
      makeMeeting('m3', 's1', 'b3', 'slot3'),
    ];

    const score = scoreSchedule(meetings, slots, suppliers);
    expect(score.totalScore).toBe(0);
    expect(score.totalMeetings).toBe(3);
    expect(score.maxConsecutiveGap).toBe(0);
  });

  it('does not penalize single-slot gaps (gap of 1 is acceptable)', () => {
    const suppliers = [makeSupplier({ id: 's1' })];
    const slots = [
      makeSlot('slot1', '2024-01-01', 9, 0),
      makeSlot('slot2', '2024-01-01', 9, 30),
      makeSlot('slot3', '2024-01-01', 10, 0),
    ];
    const meetings = [
      makeMeeting('m1', 's1', 'b1', 'slot1'),
      // slot2 empty — single gap
      makeMeeting('m3', 's1', 'b3', 'slot3'),
    ];

    const score = scoreSchedule(meetings, slots, suppliers);
    expect(score.totalScore).toBe(0);
    expect(score.maxConsecutiveGap).toBe(1);
  });

  it('penalizes a trailing gap of 3 with (3-1)^2 = 4', () => {
    const suppliers = [makeSupplier({ id: 's1' })];
    const slots = [
      makeSlot('slot1', '2024-01-01', 9, 0),
      makeSlot('slot2', '2024-01-01', 9, 30),
      makeSlot('slot3', '2024-01-01', 10, 0),
      makeSlot('slot4', '2024-01-01', 10, 30),
    ];
    const meetings = [makeMeeting('m1', 's1', 'b1', 'slot1')];

    const score = scoreSchedule(meetings, slots, suppliers);
    expect(score.totalScore).toBe(4);
    expect(score.maxConsecutiveGap).toBe(3);
  });

  it('ignores cancelled and bumped meetings', () => {
    const suppliers = [makeSupplier({ id: 's1' })];
    const slots = [
      makeSlot('slot1', '2024-01-01', 9, 0),
      makeSlot('slot2', '2024-01-01', 9, 30),
    ];
    const meetings = [
      makeMeeting('m1', 's1', 'b1', 'slot1', 'cancelled'),
      makeMeeting('m2', 's1', 'b2', 'slot2', 'bumped'),
    ];

    const score = scoreSchedule(meetings, slots, suppliers);
    expect(score.totalMeetings).toBe(0);
  });

  it('excludes break slots from scoring', () => {
    const suppliers = [makeSupplier({ id: 's1' })];
    const slots = [
      makeSlot('slot1', '2024-01-01', 9, 0),
      { ...makeSlot('lunch', '2024-01-01', 12, 0), isBreak: true },
      makeSlot('slot2', '2024-01-01', 13, 0),
    ];
    const meetings = [
      makeMeeting('m1', 's1', 'b1', 'slot1'),
      makeMeeting('m2', 's1', 'b2', 'slot2'),
    ];

    const score = scoreSchedule(meetings, slots, suppliers);
    expect(score.totalScore).toBe(0);
    expect(score.maxConsecutiveGap).toBe(0);
  });
});

describe('compositeScore', () => {
  it('weights gap score 1000x more than meeting count', () => {
    const worseGaps = { totalScore: 1, totalMeetings: 100 } as ReturnType<typeof scoreSchedule>;
    const moreMeetings = { totalScore: 0, totalMeetings: 50 } as ReturnType<typeof scoreSchedule>;
    expect(compositeScore(moreMeetings)).toBeLessThan(compositeScore(worseGaps));
  });
});

describe('getQualityLabel', () => {
  it('labels no gaps as Excellent', () => {
    expect(getQualityLabel({ maxConsecutiveGap: 0 } as ReturnType<typeof scoreSchedule>)).toBe('Excellent');
    expect(getQualityLabel({ maxConsecutiveGap: 1 } as ReturnType<typeof scoreSchedule>)).toBe('Excellent');
  });
  it('labels gaps of 4+ as "Gaps remain"', () => {
    expect(getQualityLabel({ maxConsecutiveGap: 4 } as ReturnType<typeof scoreSchedule>)).toBe('Gaps remain');
  });
});
