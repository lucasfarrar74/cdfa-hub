import type { EventConfig, Supplier, Buyer, Meeting, TimeSlot } from '../types';
import { formatTime, formatDateRange, formatDateReadable, getUniqueDatesFromSlots } from './timeUtils';

// Safe time formatter that tolerates both Date objects and ISO strings
// (meetings loaded from JSON/Firestore have strings).
function safeFormatTime(time: Date | string): string {
  try {
    const d = time instanceof Date ? time : new Date(time);
    if (isNaN(d.getTime())) return '??:??';
    return formatTime(d);
  } catch {
    return '??:??';
  }
}

export interface SheetMerge {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export interface WorkbookSheet {
  /** Display name, truncated to 31 chars (Excel hard limit). */
  name: string;
  /** 2D array of cell values. Rows can have varying length — callers pad. */
  rows: string[][];
  /** Column widths in Excel "wch" character units. Optional. */
  columnWidths?: number[];
  /** Cell merges (inclusive ranges, zero-indexed). Optional. */
  merges?: SheetMerge[];
}

export interface BuildScheduleWorkbookInput {
  eventConfig: EventConfig | null;
  suppliers: Supplier[];
  buyers: Buyer[];
  meetings: Meeting[];
  timeSlots: TimeSlot[];
  /** Max supplier columns per grid sheet; long events get split. Default 7. */
  maxColumnsPerSheet?: number;
}

/**
 * Build the logical sheet structure for a meeting schedule, independent of
 * output format. Both the Excel export (via `xlsx`) and the Google Sheets
 * export consume this so they stay in lockstep.
 *
 * The sheets produced:
 *   - "Master Grid" / "Grid <Day> <N>" — time rows × supplier columns,
 *     buyer names in cells. Split by day and into groups of
 *     maxColumnsPerSheet suppliers.
 *   - "By Supplier" / "Supplier <Day> <N>" — same shape but labeled as
 *     supplier-centric; also split by day/group.
 *   - "By Buyer" — time rows × buyer columns, supplier names in cells.
 *   - "All Meetings" — flat list with supplier, buyer, contact info, status.
 */
export function buildScheduleWorkbook(input: BuildScheduleWorkbookInput): WorkbookSheet[] {
  const {
    eventConfig,
    suppliers,
    buyers,
    meetings,
    timeSlots,
    maxColumnsPerSheet = 7,
  } = input;

  const meetingSlots = (timeSlots || []).filter(s => !s.isBreak);
  const activeMeetings = (meetings || []).filter(
    m => m.status !== 'cancelled' && m.status !== 'bumped',
  );
  const dates = getUniqueDatesFromSlots(timeSlots || []);
  const isMultiDay = dates.length > 1;

  const title = eventConfig?.name || 'Meeting Schedule';

  let dateRangeStr = '';
  try {
    if (eventConfig?.startDate && eventConfig?.endDate) {
      dateRangeStr = formatDateRange(eventConfig.startDate, eventConfig.endDate);
    }
  } catch {
    dateRangeStr = '';
  }

  const getBuyer = (id: string) => buyers.find(b => b.id === id);
  const getSupplier = (id: string) => suppliers.find(s => s.id === id);
  const getSlot = (id: string) => timeSlots.find(s => s.id === id);

  const sheets: WorkbookSheet[] = [];

  for (const date of dates) {
    const daySlots = meetingSlots.filter(s => s.date === date);
    const dateLabel = isMultiDay ? formatDateReadable(date).split(',')[0] : '';

    const daySuppliers = suppliers.filter(supplier =>
      daySlots.some(slot =>
        activeMeetings.some(m => m.supplierId === supplier.id && m.timeSlotId === slot.id),
      ),
    );
    if (daySuppliers.length === 0) continue;

    const groups: Supplier[][] = [];
    for (let i = 0; i < daySuppliers.length; i += maxColumnsPerSheet) {
      groups.push(daySuppliers.slice(i, i + maxColumnsPerSheet));
    }

    // Master Grid sheets
    groups.forEach((group, groupIdx) => {
      const isSingle = dates.length === 1 && groups.length === 1;
      const name = isSingle
        ? 'Master Grid'
        : `Grid${isMultiDay ? ' ' + dateLabel : ''}${groups.length > 1 ? ' ' + (groupIdx + 1) : ''}`.trim();

      const header: string[][] = [
        [title],
        [isMultiDay ? formatDateReadable(date) : dateRangeStr],
        [`Generated: ${new Date().toLocaleDateString()}`],
        [],
        ['Time', ...group.map(s => s.companyName)],
      ];
      const rows = daySlots.map(slot => [
        safeFormatTime(slot.startTime),
        ...group.map(supplier => {
          const meeting = activeMeetings.find(
            m => m.supplierId === supplier.id && m.timeSlotId === slot.id,
          );
          return meeting ? getBuyer(meeting.buyerId)?.name || '' : '';
        }),
      ]);

      sheets.push({
        name: name.substring(0, 31),
        rows: [...header, ...rows],
        columnWidths: [
          10,
          ...group.map(s => Math.max(14, Math.min(28, s.companyName.length + 2))),
        ],
        merges: [
          { startRow: 0, endRow: 0, startCol: 0, endCol: group.length },
          { startRow: 1, endRow: 1, startCol: 0, endCol: group.length },
        ],
      });
    });

    // By Supplier sheets
    groups.forEach((group, groupIdx) => {
      const isSingle = dates.length === 1 && groups.length === 1;
      const name = isSingle
        ? 'By Supplier'
        : `Supplier${isMultiDay ? ' ' + dateLabel : ''}${groups.length > 1 ? ' ' + (groupIdx + 1) : ''}`.trim();

      const header: string[][] = [
        [title],
        ['Schedule by Supplier'],
        [],
        ['Time', ...group.map(s => s.companyName)],
      ];
      const rows = daySlots.map(slot => [
        safeFormatTime(slot.startTime),
        ...group.map(supplier => {
          const meeting = activeMeetings
            .filter(m => m.supplierId === supplier.id)
            .find(m => m.timeSlotId === slot.id);
          return meeting ? getBuyer(meeting.buyerId)?.name || '' : '';
        }),
      ]);

      sheets.push({
        name: name.substring(0, 31),
        rows: [...header, ...rows],
        columnWidths: [
          10,
          ...group.map(s => Math.max(14, Math.min(28, s.companyName.length + 2))),
        ],
      });
    });
  }

  // By Buyer sheet
  const byBuyerHeader: string[][] = [
    [title],
    ['Schedule by Buyer'],
    [],
    [isMultiDay ? 'Date' : '', 'Time', ...buyers.map(b => b.name)].filter(Boolean) as string[],
  ];
  const byBuyerRows = meetingSlots.map(slot => {
    const row: string[] = [
      safeFormatTime(slot.startTime),
      ...buyers.map(buyer => {
        const meeting = activeMeetings
          .filter(m => m.buyerId === buyer.id)
          .find(m => m.timeSlotId === slot.id);
        return meeting ? getSupplier(meeting.supplierId)?.companyName || '' : '';
      }),
    ];
    if (isMultiDay) row.unshift(formatDateReadable(slot.date));
    return row;
  });

  sheets.push({
    name: 'By Buyer',
    rows: [...byBuyerHeader, ...byBuyerRows],
    columnWidths: [
      ...(isMultiDay ? [18] : []),
      10,
      ...buyers.map(b => Math.max(12, Math.min(25, b.name.length + 2))),
    ],
  });

  // All Meetings detail
  const allHeaderFields: string[] = [
    ...(isMultiDay ? ['Date'] : []),
    'Time',
    'Supplier',
    'Primary Contact',
    'Primary Email',
    'Secondary Contact',
    'Secondary Email',
    'Buyer',
    'Organization',
    'Status',
  ];
  const allMeetingsHeader: string[][] = [
    [title],
    ['All Meetings Detail'],
    [],
    allHeaderFields,
  ];
  const allMeetingsRows = activeMeetings.map(m => {
    const slot = getSlot(m.timeSlotId);
    const supplier = getSupplier(m.supplierId);
    const buyer = getBuyer(m.buyerId);
    const row: string[] = [];
    if (isMultiDay) row.push(slot ? formatDateReadable(slot.date) : '');
    row.push(
      slot ? safeFormatTime(slot.startTime) : '',
      supplier?.companyName || '',
      supplier?.primaryContact.name || '',
      supplier?.primaryContact.email || '',
      supplier?.secondaryContact?.name || '',
      supplier?.secondaryContact?.email || '',
      buyer?.name || '',
      buyer?.organization || '',
      m.status,
    );
    return row;
  });

  sheets.push({
    name: 'All Meetings',
    rows: [...allMeetingsHeader, ...allMeetingsRows],
    columnWidths: [
      ...(isMultiDay ? [18] : []),
      10,
      20,
      18,
      25,
      18,
      25,
      18,
      18,
      12,
    ],
  });

  return sheets;
}
