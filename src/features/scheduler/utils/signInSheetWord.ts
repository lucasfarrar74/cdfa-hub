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
  ShadingType,
  VerticalAlign,
  BorderStyle,
  PageOrientation,
  TabStopPosition,
  TabStopType,
} from 'docx';
import { saveAs } from 'file-saver';
import type { Supplier, EventConfig } from '../types';
import { getEnabledDates } from './timeUtils';

// CDFA green color scheme
const HEADER_COLOR = '1C4C37';     // CDFA Standout
const HEADER_TEXT_COLOR = 'FFFFFF';
const ALT_ROW_COLOR = 'E8F1ED';    // CDFA Understated
const ACCENT_COLOR = '457862';     // CDFA Primary
const ACCENT_LIGHT = 'E8F1ED';    // CDFA Understated
const LIGHT_BORDER = 'D1D5DB';
const TABLE_BORDER = '6B7280';

function headerCell(text: string, width?: number): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, color: HEADER_TEXT_COLOR, size: 22, font: 'Calibri' })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 80 },
      }),
    ],
    shading: { type: ShadingType.SOLID, color: HEADER_COLOR },
    verticalAlign: VerticalAlign.CENTER,
    width: width ? { size: width, type: WidthType.DXA } : undefined,
  });
}

function dataCell(text: string, options?: {
  bold?: boolean;
  shading?: string;
  size?: number;
  color?: string;
  alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
}): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({
          text,
          bold: options?.bold,
          color: options?.color,
          size: options?.size ?? 21,
          font: 'Calibri',
        })],
        alignment: options?.alignment ?? AlignmentType.LEFT,
        spacing: { before: 60, after: 60 },
      }),
    ],
    verticalAlign: VerticalAlign.CENTER,
    shading: options?.shading ? { type: ShadingType.SOLID, color: options.shading } : undefined,
  });
}

function signatureCell(shading?: string): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        spacing: { before: 60, after: 60 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: TABLE_BORDER, space: 1 } },
      }),
    ],
    verticalAlign: VerticalAlign.BOTTOM,
    shading: shading ? { type: ShadingType.SOLID, color: shading } : undefined,
  });
}

function getSuppliersForDate(suppliers: Supplier[], date: string): Supplier[] {
  return suppliers
    .filter(s => {
      if (!s.selectedDays || s.selectedDays.length === 0) return true;
      return s.selectedDays.includes(date);
    })
    .sort((a, b) => a.companyName.localeCompare(b.companyName));
}

/** Return the contact name only if it's a real name (not a duplicate of the company) */
function getRepName(supplier: Supplier, contact: { name?: string } | undefined): string {
  const name = contact?.name?.trim() || '';
  if (!name) return '';
  if (name.toLowerCase() === supplier.companyName.toLowerCase()) return '';
  return name;
}

export async function downloadSignInSheets(
  suppliers: Supplier[],
  eventConfig: EventConfig,
): Promise<void> {
  const dates = getEnabledDates(eventConfig);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sections: any[] = [];

  for (const date of dates) {
    const dateObj = new Date(date + 'T00:00:00');
    const dateLabel = dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const shortDate = dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const daySuppliers = getSuppliersForDate(suppliers, date);

    // Table rows
    const rows: TableRow[] = [
      new TableRow({
        children: [
          headerCell('#', 500),
          headerCell('Company Name', 4200),
          headerCell('Representative', 3200),
          headerCell('Signature', 4200),
        ],
        tableHeader: true,
      }),
    ];

    let rowNum = 1;
    daySuppliers.forEach((supplier, i) => {
      const shading = i % 2 === 0 ? undefined : ALT_ROW_COLOR;
      const repName = getRepName(supplier, supplier.primaryContact);

      rows.push(new TableRow({
        children: [
          dataCell(`${rowNum}`, { alignment: AlignmentType.CENTER, shading, size: 18, color: '6B7280' }),
          dataCell(supplier.companyName, { bold: true, shading }),
          dataCell(repName, { shading }),
          signatureCell(shading),
        ],
      }));
      rowNum++;

      if (supplier.secondaryContact?.name) {
        const secName = getRepName(supplier, supplier.secondaryContact);
        if (secName) {
          rows.push(new TableRow({
            children: [
              dataCell(`${rowNum}`, { alignment: AlignmentType.CENTER, shading, size: 18, color: '6B7280' }),
              dataCell('  〃', { shading, size: 18, color: '9CA3AF' }),
              dataCell(secName, { shading }),
              signatureCell(shading),
            ],
          }));
          rowNum++;
        }
      }
    });

    // Blank rows for walk-ins
    for (let i = 0; i < 5; i++) {
      const shading = (rowNum - 1) % 2 === 1 ? ALT_ROW_COLOR : undefined;
      rows.push(new TableRow({
        children: [
          dataCell(`${rowNum}`, { alignment: AlignmentType.CENTER, shading, size: 18, color: '6B7280' }),
          dataCell('', { shading }),
          dataCell('', { shading }),
          signatureCell(shading),
        ],
      }));
      rowNum++;
    }

    sections.push({
      properties: {
        page: {
          margin: { top: 600, bottom: 600, left: 720, right: 720 },
          size: { orientation: PageOrientation.LANDSCAPE },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: eventConfig.name, bold: true, size: 16, color: ACCENT_COLOR, font: 'Calibri' }),
                new TextRun({ text: `\t${shortDate}`, size: 16, color: '9CA3AF', font: 'Calibri' }),
              ],
              tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
              border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: ACCENT_LIGHT, space: 4 } },
              spacing: { after: 100 },
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: `${eventConfig.name} — Supplier Sign-In — ${dateLabel}`, size: 14, color: '9CA3AF', font: 'Calibri' }),
              ],
              alignment: AlignmentType.CENTER,
              border: { top: { style: BorderStyle.SINGLE, size: 1, color: ACCENT_LIGHT, space: 4 } },
            }),
          ],
        }),
      },
      children: [
        // Title banner
        new Table({
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'SUPPLIER SIGN-IN', bold: true, size: 30, color: HEADER_TEXT_COLOR, font: 'Calibri' }),
                      ],
                      spacing: { before: 80, after: 20 },
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({ text: dateLabel, size: 22, color: ACCENT_LIGHT, font: 'Calibri' }),
                      ],
                      spacing: { before: 0, after: 80 },
                    }),
                  ],
                  shading: { type: ShadingType.SOLID, color: HEADER_COLOR },
                  verticalAlign: VerticalAlign.CENTER,
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: `${daySuppliers.length}`, bold: true, size: 36, color: HEADER_TEXT_COLOR, font: 'Calibri' }),
                      ],
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 40, after: 0 },
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'companies', size: 16, color: ACCENT_LIGHT, font: 'Calibri' }),
                      ],
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 0, after: 40 },
                    }),
                  ],
                  shading: { type: ShadingType.SOLID, color: HEADER_COLOR },
                  verticalAlign: VerticalAlign.CENTER,
                  width: { size: 1800, type: WidthType.DXA },
                }),
              ],
            }),
          ],
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE, size: 0 },
            bottom: { style: BorderStyle.NONE, size: 0 },
            left: { style: BorderStyle.NONE, size: 0 },
            right: { style: BorderStyle.NONE, size: 0 },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: ACCENT_COLOR },
            insideHorizontal: { style: BorderStyle.NONE, size: 0 },
          },
        }),

        new Paragraph({ spacing: { before: 200, after: 100 } }),

        // Sign-in table
        new Table({
          rows,
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: TABLE_BORDER },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: TABLE_BORDER },
            left: { style: BorderStyle.SINGLE, size: 1, color: TABLE_BORDER },
            right: { style: BorderStyle.SINGLE, size: 1, color: TABLE_BORDER },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_BORDER },
          },
        }),
      ],
    });
  }

  const doc = new Document({ sections });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Sign-In Sheets - ${eventConfig.name}.docx`);
}
