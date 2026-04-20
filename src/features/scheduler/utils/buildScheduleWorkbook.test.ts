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
    expect(names).toContain('By Supplier');
    expect(names).toContain('By Buyer');
    expect(names).toContain('All Meetings');
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

  it('splits wide day into multiple grid sheets past maxColumnsPerSheet', () => {
    const suppliers = Array.from({ length: 9 }, (_, i) =>
      makeSupplier({ id: `s${i}`, companyName: `Supplier${i}` }),
    );
    const buyers = Array.from({ length: 9 }, (_, i) => makeBuyer(`b${i}`));
    const slots = [makeSlot('slot1', '2024-01-01', 9, 0)];
    const meetings = suppliers.map((s, i) =>
      makeMeeting(`m${i}`, s.id, `b${i}`, 'slot1'),
    );

    const sheets = buildScheduleWorkbook({
      eventConfig: makeEventConfig(),
      suppliers,
      buyers,
      meetings,
      timeSlots: slots,
      maxColumnsPerSheet: 7,
    });
    // 9 suppliers / 7 = 2 grid sheets + 2 by-supplier sheets
    const gridLike = sheets.filter(s => s.name.startsWith('Grid') || s.name === 'Master Grid');
    const supplierLike = sheets.filter(s => s.name.startsWith('Supplier') || s.name === 'By Supplier');
    expect(gridLike.length).toBe(2);
    expect(supplierLike.length).toBe(2);
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
