import { describe, it, expect } from 'vitest';
import { buildScheduleWorkbook } from './buildScheduleWorkbook';
import { makeSupplier, makeBuyer, makeSlot, makeMeeting } from './__testHelpers';
import type { EventConfig } from '../types';

function makeEventConfig(overrides: Partial<EventConfig> = {}): EventConfig {
  return {
    id: 'e1',
    name: 'Test Event',
    startDate: '2024-01-01',
    endDate: '2024-01-01',
    startTime: '09:00',
    endTime: '12:00',
    defaultMeetingDuration: 30,
    breaks: [],
    schedulingStrategy: 'efficient',
    ...overrides,
  };
}

describe('buildScheduleWorkbook', () => {
  it('produces expected sheet set for a simple one-day schedule', () => {
    const suppliers = [makeSupplier({ id: 's1', companyName: 'Acme' })];
    const buyers = [makeBuyer('b1', { name: 'Alice' })];
    const slots = [makeSlot('slot1', '2024-01-01', 9, 0)];
    const meetings = [makeMeeting('m1', 's1', 'b1', 'slot1')];

    const sheets = buildScheduleWorkbook({
      eventConfig: makeEventConfig(),
      suppliers,
      buyers,
      meetings,
      timeSlots: slots,
    });

    const names = sheets.map(s => s.name);
    expect(names).toContain('Master Grid');
    expect(names).toContain('By Buyer');
    expect(names).toContain('All Meetings');
    // "By Supplier" is intentionally gone — Master Grid is already
    // supplier-centric, the duplicate tab just added noise.
    expect(names).not.toContain('By Supplier');
  });

  it('attaches a buyer-colored fill on each booked grid cell', () => {
    const suppliers = [makeSupplier({ id: 's1', companyName: 'Acme' })];
    const buyers = [makeBuyer('b1', { name: 'Alice' })];
    const slots = [makeSlot('slot1', '2024-01-01', 9, 0)];
    const meetings = [makeMeeting('m1', 's1', 'b1', 'slot1')];

    const [grid] = buildScheduleWorkbook({
      eventConfig: makeEventConfig(),
      suppliers,
      buyers,
      meetings,
      timeSlots: slots,
    });

    // Find the fill entry for the single meeting — row 5 (after 5 header
    // rows), col 1 (after time col).
    const meetingFill = grid.cellFills?.find(f => f.row === 5 && f.col === 1);
    expect(meetingFill).toBeTruthy();
    expect(meetingFill?.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('places buyer name in the correct grid cell', () => {
    const suppliers = [makeSupplier({ id: 's1', companyName: 'Acme' })];
    const buyers = [makeBuyer('b1', { name: 'Alice' })];
    const slots = [makeSlot('slot1', '2024-01-01', 9, 0)];
    const meetings = [makeMeeting('m1', 's1', 'b1', 'slot1')];

    const [grid] = buildScheduleWorkbook({
      eventConfig: makeEventConfig(),
      suppliers,
      buyers,
      meetings,
      timeSlots: slots,
    });

    // Grid layout: 4 header rows (title, date, generated, blank), 1 column
    // header row, then data rows. First data row, col 1 should be buyer name.
    expect(grid.rows[5][1]).toBe('Alice');
  });

  it('excludes cancelled and bumped meetings', () => {
    const suppliers = [makeSupplier({ id: 's1' })];
    const buyers = [makeBuyer('b1'), makeBuyer('b2')];
    const slots = [
      makeSlot('slot1', '2024-01-01', 9, 0),
      makeSlot('slot2', '2024-01-01', 9, 30),
    ];
    const meetings = [
      makeMeeting('m1', 's1', 'b1', 'slot1', 'cancelled'),
      makeMeeting('m2', 's1', 'b2', 'slot2'),
    ];

    const sheets = buildScheduleWorkbook({
      eventConfig: makeEventConfig(),
      suppliers,
      buyers,
      meetings,
      timeSlots: slots,
    });
    const allMeetings = sheets.find(s => s.name === 'All Meetings')!;
    // Header rows (title, "All Meetings Detail", blank, field row) = 4.
    // Only 1 active meeting should follow.
    expect(allMeetings.rows.length).toBe(4 + 1);
  });

  it('produces one grid sheet per day in a multi-day event', () => {
    const suppliers = [makeSupplier({ id: 's1', companyName: 'Acme' })];
    const buyers = [makeBuyer('b1')];
    const slots = [
      makeSlot('slot1', '2024-01-01', 9, 0),
      makeSlot('slot2', '2024-01-02', 9, 0),
      makeSlot('slot3', '2024-01-03', 9, 0),
    ];
    const meetings = [makeMeeting('m1', 's1', 'b1', 'slot1')];

    const sheets = buildScheduleWorkbook({
      eventConfig: makeEventConfig({ endDate: '2024-01-03' }),
      suppliers,
      buyers,
      meetings,
      timeSlots: slots,
    });
    const gridSheets = sheets.filter(s => s.name.startsWith('Grid '));
    // 3 days → 3 daily grids (multi-day naming: "Grid Mon Jan 1", etc.)
    expect(gridSheets.length).toBe(3);
  });

  it('keeps the grid sheet column count equal to suppliers + 1 regardless of headcount', () => {
    const suppliers = Array.from({ length: 9 }, (_, i) =>
      makeSupplier({ id: `s${i}`, companyName: `Supplier${i}` }),
    );
    const buyers = [makeBuyer('b0')];
    const slots = [makeSlot('slot1', '2024-01-01', 9, 0)];
    const meetings = [makeMeeting('m0', 's0', 'b0', 'slot1')];

    const sheets = buildScheduleWorkbook({
      eventConfig: makeEventConfig(),
      suppliers,
      buyers,
      meetings,
      timeSlots: slots,
    });
    const grid = sheets.find(s => s.name === 'Master Grid')!;
    // Column count on the header row = time + 9 suppliers
    expect(grid.rows[4].length).toBe(10);
    // No separate "Grid ... 2" sheet should exist from splitting.
    expect(sheets.some(s => s.name.endsWith(' 2'))).toBe(false);
  });

  it('prepends a Date column when the event spans multiple days', () => {
    const suppliers = [makeSupplier({ id: 's1' })];
    const buyers = [makeBuyer('b1')];
    const slots = [
      makeSlot('slot1', '2024-01-01', 9, 0),
      makeSlot('slot2', '2024-01-02', 9, 0),
    ];
    const meetings = [
      makeMeeting('m1', 's1', 'b1', 'slot1'),
      makeMeeting('m2', 's1', 'b1', 'slot2'),
    ];

    const sheets = buildScheduleWorkbook({
      eventConfig: makeEventConfig({ endDate: '2024-01-02' }),
      suppliers,
      buyers,
      meetings,
      timeSlots: slots,
    });
    const byBuyer = sheets.find(s => s.name === 'By Buyer')!;
    const headerRow = byBuyer.rows[3];
    expect(headerRow[0]).toBe('Date');
    expect(headerRow[1]).toBe('Time');
  });

  it('truncates sheet names to 31 chars (Excel hard limit)', () => {
    const longName = 'a'.repeat(60);
    const suppliers = [makeSupplier({ id: 's1', companyName: longName })];
    const buyers = [makeBuyer('b1')];
    const slots = [makeSlot('slot1', '2024-01-01', 9, 0)];
    const meetings = [makeMeeting('m1', 's1', 'b1', 'slot1')];

    const sheets = buildScheduleWorkbook({
      eventConfig: makeEventConfig({ name: longName }),
      suppliers,
      buyers,
      meetings,
      timeSlots: slots,
    });
    for (const s of sheets) {
      expect(s.name.length).toBeLessThanOrEqual(31);
    }
  });
});
