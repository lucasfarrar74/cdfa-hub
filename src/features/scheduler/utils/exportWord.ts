import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  Header,
  Footer,
  TextRun,
  AlignmentType,
  WidthType,
  PageNumber,
  HeadingLevel,
  ShadingType,
  VerticalAlign,
  TableLayoutType,
  PageBreak,
} from 'docx';
import { saveAs } from 'file-saver';
import type { EventConfig, Supplier, Buyer, Meeting, TimeSlot } from '../types';
import { formatTime, formatDateRange, formatDateReadable, getUniqueDatesFromSlots } from './timeUtils';

// Safe wrapper for formatTime - handles both Date objects and serialized strings
function safeFormatTime(time: Date | string): string {
  try {
    const date = time instanceof Date ? time : new Date(time);
    if (isNaN(date.getTime())) return '??:??';
    return formatTime(date);
  } catch {
    return '??:??';
  }
}

interface ExportData {
  eventConfig: EventConfig;
  suppliers: Supplier[];
  buyers: Buyer[];
  meetings: Meeting[];
  timeSlots: TimeSlot[];
}

// Professional blue color for headers
const HEADER_COLOR = '2563EB';
const HEADER_TEXT_COLOR = 'FFFFFF';
const ALT_ROW_COLOR = 'F3F4F6';

/**
 * Create a professional header for the document
 */
function createDocumentHeader(eventConfig: EventConfig): Header {
  return new Header({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: eventConfig.name,
            bold: true,
            size: 28,
            color: HEADER_COLOR,
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: formatDateRange(eventConfig.startDate, eventConfig.endDate),
            size: 20,
            color: '6B7280',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
    ],
  });
}

/**
 * Create a professional footer with page numbers
 */
function createDocumentFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: `Generated on ${new Date().toLocaleDateString()} | Page `,
            size: 18,
            color: '9CA3AF',
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            size: 18,
            color: '9CA3AF',
          }),
          new TextRun({
            text: ' of ',
            size: 18,
            color: '9CA3AF',
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            size: 18,
            color: '9CA3AF',
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ],
  });
}

/**
 * Create a styled table header cell
 */
function createHeaderCell(text: string, width?: number): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: true,
            color: HEADER_TEXT_COLOR,
            size: 20,
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ],
    shading: {
      type: ShadingType.SOLID,
      color: HEADER_COLOR,
    },
    verticalAlign: VerticalAlign.CENTER,
    width: width ? { size: width, type: WidthType.DXA } : undefined,
  });
}

/**
 * Create a styled table data cell
 */
function createDataCell(text: string, isAltRow: boolean = false): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            size: 20,
          }),
        ],
        alignment: AlignmentType.LEFT,
      }),
    ],
    shading: isAltRow
      ? { type: ShadingType.SOLID, color: ALT_ROW_COLOR }
      : undefined,
    verticalAlign: VerticalAlign.CENTER,
  });
}

/**
 * Export schedule to Word document - By Supplier view
 */
export async function exportSupplierScheduleToWord(data: ExportData): Promise<void> {
  const { eventConfig, suppliers, buyers, meetings, timeSlots } = data;

  const activeMeetings = meetings.filter(m => m.status !== 'cancelled' && m.status !== 'bumped');
  const meetingSlots = timeSlots.filter(s => !s.isBreak);
  const dates = getUniqueDatesFromSlots(timeSlots);
  const isMultiDay = dates.length > 1;

  const getBuyer = (id: string) => buyers.find(b => b.id === id);

  const sections: (Paragraph | Table)[] = [];

  // Create table for each supplier (each on their own page)
  for (let supplierIndex = 0; supplierIndex < suppliers.length; supplierIndex++) {
    const supplier = suppliers[supplierIndex];

    // Add page break before each supplier (except first)
    if (supplierIndex > 0) {
      sections.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      );
    }

    // Title on each page
    sections.push(
      new Paragraph({
        text: 'Schedule by Supplier',
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 400 },
      })
    );

    // Supplier header
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: supplier.companyName,
            bold: true,
            size: 26,
          }),
        ],
        spacing: { before: 200, after: 100 },
      })
    );

    // Contact info
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Contact: ${supplier.primaryContact.name}`,
            size: 20,
            color: '6B7280',
          }),
          supplier.primaryContact.email
            ? new TextRun({
                text: ` (${supplier.primaryContact.email})`,
                size: 20,
                color: '6B7280',
              })
            : new TextRun({ text: '' }),
        ],
        spacing: { after: 200 },
      })
    );

    // Create schedule table
    const supplierMeetings = activeMeetings.filter(m => m.supplierId === supplier.id);

    const headerRow = new TableRow({
      children: isMultiDay
        ? [createHeaderCell('Date', 2000), createHeaderCell('Time', 1500), createHeaderCell('Buyer', 3500), createHeaderCell('Organization', 3000)]
        : [createHeaderCell('Time', 1500), createHeaderCell('Buyer', 3500), createHeaderCell('Organization', 3000)],
      tableHeader: true,
    });

    const dataRows = meetingSlots.map((slot, index) => {
      const meeting = supplierMeetings.find(m => m.timeSlotId === slot.id);
      const buyer = meeting ? getBuyer(meeting.buyerId) : null;
      const isAlt = index % 2 === 1;

      return new TableRow({
        children: isMultiDay
          ? [
              createDataCell(formatDateReadable(slot.date), isAlt),
              createDataCell(safeFormatTime(slot.startTime), isAlt),
              createDataCell(buyer?.name || '-', isAlt),
              createDataCell(buyer?.organization || '-', isAlt),
            ]
          : [
              createDataCell(safeFormatTime(slot.startTime), isAlt),
              createDataCell(buyer?.name || '-', isAlt),
              createDataCell(buyer?.organization || '-', isAlt),
            ],
      });
    });

    sections.push(
      new Table({
        rows: [headerRow, ...dataRows],
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        headers: { default: createDocumentHeader(eventConfig) },
        footers: { default: createDocumentFooter() },
        children: sections,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, 'schedule-by-supplier.docx');
}

/**
 * Export schedule to Word document - By Buyer view
 */
export async function exportBuyerScheduleToWord(data: ExportData): Promise<void> {
  const { eventConfig, suppliers, buyers, meetings, timeSlots } = data;

  const activeMeetings = meetings.filter(m => m.status !== 'cancelled' && m.status !== 'bumped');
  const meetingSlots = timeSlots.filter(s => !s.isBreak);
  const dates = getUniqueDatesFromSlots(timeSlots);
  const isMultiDay = dates.length > 1;

  const getSupplier = (id: string) => suppliers.find(s => s.id === id);

  const sections: (Paragraph | Table)[] = [];

  // Create table for each buyer (each on their own page)
  for (let buyerIndex = 0; buyerIndex < buyers.length; buyerIndex++) {
    const buyer = buyers[buyerIndex];

    // Add page break before each buyer (except first)
    if (buyerIndex > 0) {
      sections.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      );
    }

    // Title on each page
    sections.push(
      new Paragraph({
        text: 'Schedule by Buyer',
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 400 },
      })
    );

    // Buyer header
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${buyer.name} (${buyer.organization})`,
            bold: true,
            size: 26,
          }),
        ],
        spacing: { before: 200, after: 200 },
      })
    );

    // Create schedule table
    const buyerMeetings = activeMeetings.filter(m => m.buyerId === buyer.id);

    const headerRow = new TableRow({
      children: isMultiDay
        ? [createHeaderCell('Date', 2000), createHeaderCell('Time', 1500), createHeaderCell('Supplier', 4000), createHeaderCell('Contact', 2500)]
        : [createHeaderCell('Time', 1500), createHeaderCell('Supplier', 4000), createHeaderCell('Contact', 2500)],
      tableHeader: true,
    });

    const dataRows = meetingSlots.map((slot, index) => {
      const meeting = buyerMeetings.find(m => m.timeSlotId === slot.id);
      const supplier = meeting ? getSupplier(meeting.supplierId) : null;
      const isAlt = index % 2 === 1;

      return new TableRow({
        children: isMultiDay
          ? [
              createDataCell(formatDateReadable(slot.date), isAlt),
              createDataCell(safeFormatTime(slot.startTime), isAlt),
              createDataCell(supplier?.companyName || '-', isAlt),
              createDataCell(supplier?.primaryContact.name || '-', isAlt),
            ]
          : [
              createDataCell(safeFormatTime(slot.startTime), isAlt),
              createDataCell(supplier?.companyName || '-', isAlt),
              createDataCell(supplier?.primaryContact.name || '-', isAlt),
            ],
      });
    });

    sections.push(
      new Table({
        rows: [headerRow, ...dataRows],
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        headers: { default: createDocumentHeader(eventConfig) },
        footers: { default: createDocumentFooter() },
        children: sections,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, 'schedule-by-buyer.docx');
}

/**
 * Export master schedule grid to Word document
 */
export async function exportMasterScheduleToWord(data: ExportData): Promise<void> {
  const { eventConfig, suppliers, buyers, meetings, timeSlots } = data;

  const activeMeetings = meetings.filter(m => m.status !== 'cancelled' && m.status !== 'bumped');
  const meetingSlots = timeSlots.filter(s => !s.isBreak);
  const dates = getUniqueDatesFromSlots(timeSlots);
  const isMultiDay = dates.length > 1;

  const getBuyer = (id: string) => buyers.find(b => b.id === id);

  const sections: (Paragraph | Table)[] = [];

  // Title
  sections.push(
    new Paragraph({
      text: 'Master Schedule Grid',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 400 },
    })
  );

  // Process by day if multi-day
  for (const date of dates) {
    const daySlots = meetingSlots.filter(s => s.date === date);

    if (isMultiDay) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: formatDateReadable(date),
              bold: true,
              size: 24,
            }),
          ],
          spacing: { before: 400, after: 200 },
        })
      );
    }

    // Create header row with Time + all supplier names
    const headerRow = new TableRow({
      children: [
        createHeaderCell('Time', 1200),
        ...suppliers.map(s => createHeaderCell(s.companyName.substring(0, 15), 1400)),
      ],
      tableHeader: true,
    });

    // Create data rows for each time slot
    const dataRows = daySlots.map((slot, index) => {
      const isAlt = index % 2 === 1;

      return new TableRow({
        children: [
          createDataCell(safeFormatTime(slot.startTime), isAlt),
          ...suppliers.map(supplier => {
            const meeting = activeMeetings.find(
              m => m.supplierId === supplier.id && m.timeSlotId === slot.id
            );
            const buyer = meeting ? getBuyer(meeting.buyerId) : null;
            return createDataCell(buyer?.name?.substring(0, 12) || '-', isAlt);
          }),
        ],
      });
    });

    sections.push(
      new Table({
        rows: [headerRow, ...dataRows],
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: 'landscape',
            },
          },
        },
        headers: { default: createDocumentHeader(eventConfig) },
        footers: { default: createDocumentFooter() },
        children: sections,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, 'master-schedule.docx');
}
