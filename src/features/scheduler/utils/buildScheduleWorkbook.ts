import type { EventConfig, Supplier, Buyer, Meeting, TimeSlot } from '../types';
import { formatTime, formatDateRange, formatDateReadable, getUniqueDatesFromSlots } from './timeUtils';
import { createBuyerColorMap } from './colors';

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

/** Lighten a hex color by mixing it with white. amount 0..1 (1 = pure white). */
function lighten(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return (
    '#' +
    mix(r).toString(16).padStart(2, '0') +
    mix(g).toString(16).padStart(2, '0') +
    mix(b).toString(16).padStart(2, '0')
  );
}

export interface SheetMerge {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export interface CellFill {
  row: number;
  col: number;
  /** Hex color, e.g. "#FFF3E0". */
  color: string;
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
  /** Background fills for specific cells (sparse list). */
  cellFills?: CellFill[];
  /** Wrap text in all cells of this sheet. Default false. */
  wrapText?: boolean;
  /** Number of top rows to freeze (stay visible on scroll). Default 0. */
  frozenRows?: number;
}

export interface BuildScheduleWorkbookInput {
  eventConfig: EventConfig | null;
  suppliers: Supplier[];
  buyers: Buyer[];
  meetings: Meeting[];
  timeSlots: TimeSlot[];
}

/**
 * Build the logical sheet structure for a meeting schedule, independent of
 * output format. Both the Excel export (via `xlsx`) and the Google Sheets
 * export consume this so they stay in lockstep.
 *
 * Layout: one Master Grid sheet per event day showing all suppliers in
 * columns and time slots in rows, with meetings filled in as buyer names
 * tinted by each buyer's assigned color. Plus "By Buyer" (pivoted
 * perspective) and "All Meetings" (flat detail list).
 */
export function buildScheduleWorkbook(input: BuildScheduleWorkbookInput): WorkbookSheet[] {
  const { eventConfig, suppliers, buyers, meetings, timeSlots } = input;

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
  const buyerColorMap = createBuyerColorMap(buyers);

  // Uniform pixel-ish widths converted to Excel "wch" units (1 wch ≈ 7 px).
  const TIME_COL_WCH = 12;
  const MEETING_COL_WCH = 22;

  const sheets: WorkbookSheet[] = [];

  // Header rows are shared across daily grid sheets. We merge them across
  // the full width of each sheet for a banner look.
  for (const date of dates) {
    const daySlots = meetingSlots.filter(s => s.date === date);

    // Include ALL suppliers so column structure is identical across days —
    // empty cells make gaps visible rather than hiding them.
    const daySuppliers = suppliers.slice();
    if (daySuppliers.length === 0) continue;

    const dayLabel = isMultiDay ? formatDateReadable(date).split(',')[0] : '';
    const sheetName = isMultiDay ? `Grid ${dayLabel}` : 'Master Grid';

    const headerRows: string[][] = [
      [title],
      [isMultiDay ? formatDateReadable(date) : dateRangeStr],
      [`Generated: ${new Date().toLocaleDateString()}`],
      [],
      ['Time', ...daySuppliers.map(s => s.companyName)],
    ];
    const dataRows: string[][] = [];
    const cellFills: CellFill[] = [];

    // Header banner rows get a light blue fill for prominence.
    cellFills.push({ row: 0, col: 0, color: '#DBEAFE' });
    cellFills.push({ row: 1, col: 0, color: '#DBEAFE' });

    daySlots.forEach((slot, rowIdx) => {
      const absRow = headerRows.length + rowIdx;
      const row: string[] = [safeFormatTime(slot.startTime)];
      daySuppliers.forEach((supplier, colIdx) => {
        const meeting = activeMeetings.find(
          m => m.supplierId === supplier.id && m.timeSlotId === slot.id,
        );
        const buyer = meeting ? getBuyer(meeting.buyerId) : null;
        row.push(buyer?.name || '');
        if (buyer) {
          const baseColor = buyerColorMap.get(buyer.id) || '#3B82F6';
          cellFills.push({
            row: absRow,
            col: colIdx + 1,
            color: lighten(baseColor, 0.65),
          });
        }
      });
      dataRows.push(row);
    });

    const allRows = [...headerRows, ...dataRows];
    const columnCount = daySuppliers.length + 1;

    sheets.push({
      name: sheetName.substring(0, 31),
      rows: allRows,
      columnWidths: [TIME_COL_WCH, ...daySuppliers.map(() => MEETING_COL_WCH)],
      merges: [
        // Title banner across the row
        { startRow: 0, endRow: 0, startCol: 0, endCol: columnCount - 1 },
        // Date line across the row
        { startRow: 1, endRow: 1, startCol: 0, endCol: columnCount - 1 },
        // Generated line across the row
        { startRow: 2, endRow: 2, startCol: 0, endCol: columnCount - 1 },
      ],
      cellFills,
      wrapText: true,
      frozenRows: 5,
    });
  }

  // By Buyer — pivot with buyers as columns, suppliers as cell values.
  const byBuyerHeaderCols = isMultiDay
    ? ['Date', 'Time', ...buyers.map(b => b.name)]
    : ['Time', ...buyers.map(b => b.name)];
  const byBuyerHeader: string[][] = [
    [title],
    ['Schedule by Buyer'],
    [],
    byBuyerHeaderCols,
  ];
  const byBuyerRows: string[][] = [];
  const byBuyerFills: CellFill[] = [
    { row: 0, col: 0, color: '#DBEAFE' },
    { row: 1, col: 0, color: '#DBEAFE' },
  ];

  meetingSlots.forEach((slot, rowIdx) => {
    const absRow = byBuyerHeader.length + rowIdx;
    const row: string[] = [];
    if (isMultiDay) row.push(formatDateReadable(slot.date));
    row.push(safeFormatTime(slot.startTime));
    buyers.forEach((buyer, buyerIdx) => {
      const meeting = activeMeetings
        .filter(m => m.buyerId === buyer.id)
        .find(m => m.timeSlotId === slot.id);
      const supplier = meeting ? getSupplier(meeting.supplierId) : null;
      row.push(supplier?.companyName || '');
      if (supplier) {
        const baseColor = buyerColorMap.get(buyer.id) || '#3B82F6';
        byBuyerFills.push({
          row: absRow,
          col: (isMultiDay ? 2 : 1) + buyerIdx,
          color: lighten(baseColor, 0.65),
        });
      }
    });
    byBuyerRows.push(row);
  });

  sheets.push({
    name: 'By Buyer',
    rows: [...byBuyerHeader, ...byBuyerRows],
    columnWidths: [
      ...(isMultiDay ? [18] : []),
      TIME_COL_WCH,
      ...buyers.map(() => MEETING_COL_WCH),
    ],
    merges: [
      { startRow: 0, endRow: 0, startCol: 0, endCol: byBuyerHeaderCols.length - 1 },
      { startRow: 1, endRow: 1, startCol: 0, endCol: byBuyerHeaderCols.length - 1 },
    ],
    cellFills: byBuyerFills,
    wrapText: true,
    frozenRows: 4,
  });

  // All Meetings — flat detail list.
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
  const allHeaderRows: string[][] = [
    [title],
    ['All Meetings Detail'],
    [],
    allHeaderFields,
  ];
  const allDataRows = activeMeetings.map(m => {
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
    rows: [...allHeaderRows, ...allDataRows],
    columnWidths: [
      ...(isMultiDay ? [18] : []),
      TIME_COL_WCH,
      MEETING_COL_WCH,
      18,
      26,
      18,
      26,
      MEETING_COL_WCH,
      MEETING_COL_WCH,
      14,
    ],
    merges: [
      { startRow: 0, endRow: 0, startCol: 0, endCol: allHeaderFields.length - 1 },
      { startRow: 1, endRow: 1, startCol: 0, endCol: allHeaderFields.length - 1 },
    ],
    cellFills: [
      { row: 0, col: 0, color: '#DBEAFE' },
      { row: 1, col: 0, color: '#DBEAFE' },
    ],
    wrapText: true,
    frozenRows: 4,
  });

  return sheets;
}
