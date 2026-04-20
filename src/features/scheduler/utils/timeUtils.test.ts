import { describe, it, expect } from 'vitest';
import {
  getDateRange,
  getEnabledDates,
  getSlotDuration,
  getUniqueDatesFromSlots,
  generateTimeSlots,
} from './timeUtils';
import type { EventConfig, TimeSlot } from '../types';

const baseConfig: EventConfig = {
  id: 'e1',
  name: 'Test Event',
  startDate: '2024-01-01',
  endDate: '2024-01-01',
  startTime: '09:00',
  endTime: '12:00',
  defaultMeetingDuration: 30,
  breaks: [],
  schedulingStrategy: 'efficient',
};

describe('getDateRange', () => {
  it('returns a single date when start equals end', () => {
    expect(getDateRange('2024-01-01', '2024-01-01')).toEqual(['2024-01-01']);
  });

  it('returns all days inclusive', () => {
    expect(getDateRange('2024-01-01', '2024-01-03')).toEqual([
      '2024-01-01',
      '2024-01-02',
      '2024-01-03',
    ]);
  });

  it('crosses month boundaries', () => {
    expect(getDateRange('2024-01-30', '2024-02-01')).toEqual([
      '2024-01-30',
      '2024-01-31',
      '2024-02-01',
    ]);
  });
});

describe('getEnabledDates', () => {
  it('returns all dates when no disabled days are set', () => {
    const config: EventConfig = { ...baseConfig, endDate: '2024-01-03' };
    expect(getEnabledDates(config)).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
  });

  it('filters out disabled days', () => {
    const config: EventConfig = {
      ...baseConfig,
      endDate: '2024-01-03',
      disabledDays: ['2024-01-02'],
    };
    expect(getEnabledDates(config)).toEqual(['2024-01-01', '2024-01-03']);
  });
});

describe('getSlotDuration', () => {
  it('returns duration in minutes', () => {
    const slot: TimeSlot = {
      id: 's1',
      date: '2024-01-01',
      startTime: new Date(2024, 0, 1, 9, 0),
      endTime: new Date(2024, 0, 1, 9, 30),
      isBreak: false,
    };
    expect(getSlotDuration(slot)).toBe(30);
  });
});

describe('getUniqueDatesFromSlots', () => {
  it('returns sorted unique dates', () => {
    const slots: TimeSlot[] = [
      { id: 's1', date: '2024-01-02', startTime: new Date(), endTime: new Date(), isBreak: false },
      { id: 's2', date: '2024-01-01', startTime: new Date(), endTime: new Date(), isBreak: false },
      { id: 's3', date: '2024-01-01', startTime: new Date(), endTime: new Date(), isBreak: false },
    ];
    expect(getUniqueDatesFromSlots(slots)).toEqual(['2024-01-01', '2024-01-02']);
  });

  it('returns empty array for empty input', () => {
    expect(getUniqueDatesFromSlots([])).toEqual([]);
  });
});

describe('generateTimeSlots', () => {
  it('generates the expected count of meeting slots for a single day', () => {
    // 09:00 → 11:00 window, 30-min slots → 4 slots at 9:00, 9:30, 10:00, 10:30
    const config: EventConfig = { ...baseConfig, endTime: '11:00' };
    const slots = generateTimeSlots(config);
    expect(slots.filter(s => !s.isBreak).length).toBe(4);
  });

  it('inserts a break slot at the configured time', () => {
    const config: EventConfig = {
      ...baseConfig,
      breaks: [{ id: 'b1', name: 'Coffee', startTime: '10:00', endTime: '10:15' }],
    };
    const slots = generateTimeSlots(config);
    const breakSlots = slots.filter(s => s.isBreak);
    expect(breakSlots.length).toBe(1);
    expect(breakSlots[0].breakName).toBe('Coffee');
  });

  it('skips disabled days', () => {
    const config: EventConfig = {
      ...baseConfig,
      endDate: '2024-01-02',
      disabledDays: ['2024-01-02'],
    };
    const slots = generateTimeSlots(config);
    const dates = new Set(slots.map(s => s.date));
    expect([...dates]).toEqual(['2024-01-01']);
  });

  it('generates slots across multiple days', () => {
    const config: EventConfig = { ...baseConfig, endDate: '2024-01-02' };
    const slots = generateTimeSlots(config);
    const dates = new Set(slots.map(s => s.date));
    expect(dates.size).toBe(2);
  });

  it('assigns unique IDs to every slot', () => {
    const config: EventConfig = { ...baseConfig, endDate: '2024-01-02' };
    const slots = generateTimeSlots(config);
    const ids = new Set(slots.map(s => s.id));
    expect(ids.size).toBe(slots.length);
  });
});
