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
  CheckBox,
} from 'docx';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import type { Supplier, Buyer, EventConfig } from '../types';

const HEADER_COLOR = '1C4C37';
const HEADER_TEXT_COLOR = 'FFFFFF';
const ALT_ROW_COLOR = 'E8F1ED';

function createHeaderCell(text: string, width?: number): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, color: HEADER_TEXT_COLOR, size: 20, font: 'Calibri' })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 60 },
      }),
    ],
    shading: { type: ShadingType.SOLID, color: HEADER_COLOR },
    verticalAlign: VerticalAlign.CENTER,
    width: width ? { size: width, type: WidthType.DXA } : undefined,
  });
}

function createCheckboxCell(shading?: string): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new CheckBox({ checked: false, checkedState: { value: '2612' }, uncheckedState: { value: '2610' } }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 40 },
      }),
    ],
    verticalAlign: VerticalAlign.CENTER,
    shading: shading ? { type: ShadingType.SOLID, color: shading } : undefined,
  });
}

export function generatePreferenceDoc(
  supplier: Supplier,
  buyers: Buyer[],
  eventConfig: EventConfig | null,
  eventTitle?: string,
): Document {
  const title = eventTitle || eventConfig?.name || 'Meeting Preference Form';

  // Contact name: use primaryContact name, fall back to companyName
  const contactName = supplier.primaryContact.name && supplier.primaryContact.name !== supplier.companyName
    ? supplier.primaryContact.name : '';
  const contactEmail = supplier.primaryContact.email || '';

  // --- Buyer preference table ---
  const prefRows: TableRow[] = [];

  // Header row
  prefRows.push(new TableRow({
    children: [
      createHeaderCell('Organization / Buyer', 6000),
      createHeaderCell('Meet', 1100),
      createHeaderCell('Exclude', 1100),
    ],
    tableHeader: true,
  }));

  // Use compact row sizes to fit on one page
  const fontSize = buyers.length > 20 ? 16 : 18;

  buyers.forEach((buyer, i) => {
    const shading = i % 2 === 1 ? ALT_ROW_COLOR : undefined;
    const orgText = buyer.organization || buyer.name;
    const nameText = buyer.organization && buyer.name !== buyer.organization ? buyer.name : '';

    prefRows.push(new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: orgText, bold: true, size: fontSize, font: 'Calibri' }),
                ...(nameText ? [new TextRun({ text: `  (${nameText})`, size: fontSize - 2, color: '6B7280', font: 'Calibri' })] : []),
              ],
              spacing: { before: 20, after: 20 },
            }),
          ],
          verticalAlign: VerticalAlign.CENTER,
          shading: shading ? { type: ShadingType.SOLID, color: shading } : undefined,
        }),
        createCheckboxCell(shading),
        createCheckboxCell(shading),
      ],
    }));
  });

  const prefTable = new Table({
    rows: prefRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  // --- Build single-page document ---
  const children = [
    // Title
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 28, color: HEADER_COLOR, font: 'Calibri' })],
      spacing: { after: 40 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Meeting Preference Form', bold: true, size: 22, color: '111827', font: 'Calibri' })],
      spacing: { after: 120 },
    }),

    // Supplier info — compact inline
    new Paragraph({
      children: [
        new TextRun({ text: 'Company: ', bold: true, size: 18, font: 'Calibri' }),
        new TextRun({ text: supplier.companyName, size: 18, font: 'Calibri' }),
        ...(contactName ? [
          new TextRun({ text: '    Contact: ', bold: true, size: 18, font: 'Calibri' }),
          new TextRun({ text: contactName, size: 18, font: 'Calibri' }),
        ] : []),
        ...(contactEmail ? [
          new TextRun({ text: '    Email: ', bold: true, size: 18, font: 'Calibri' }),
          new TextRun({ text: contactEmail, size: 18, font: 'Calibri' }),
        ] : []),
      ],
      spacing: { after: 120 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' } },
    }),

    // "Meet with everyone" checkbox
    new Paragraph({
      children: [
        new CheckBox({ checked: false, checkedState: { value: '2612' }, uncheckedState: { value: '2610' } }),
        new TextRun({ text: '  I would like to meet with ALL buyers listed below', bold: true, size: 20, font: 'Calibri' }),
      ],
      spacing: { before: 120, after: 60 },
    }),

    // Instructions — compact
    new Paragraph({
      children: [
        new TextRun({ text: 'Or mark individual preferences below:  ', size: 17, color: '374151', font: 'Calibri' }),
        new TextRun({ text: 'Meet', bold: true, size: 17, font: 'Calibri' }),
        new TextRun({ text: ' = schedule a meeting  ·  ', size: 17, color: '6B7280', font: 'Calibri' }),
        new TextRun({ text: 'Exclude', bold: true, size: 17, font: 'Calibri' }),
        new TextRun({ text: ' = do not schedule', size: 17, color: '6B7280', font: 'Calibri' }),
      ],
      spacing: { after: 100 },
    }),

    // Preferences table
    prefTable,

    // Metadata — supplier ID
    new Paragraph({
      children: [new TextRun({ text: `[SUPPLIER_ID:${supplier.id}]`, size: 8, color: 'E5E7EB', font: 'Calibri' })],
      spacing: { before: 80 },
    }),
    // Metadata — buyer IDs for reliable round-trip matching
    new Paragraph({
      children: [new TextRun({
        text: `[BUYER_IDS:${buyers.map(b => `${(b.organization || b.name).replace(/[|=\[\]]/g, '')}=${b.id}`).join('|')}]`,
        size: 4, color: 'F9FAFB', font: 'Calibri',
      })],
    }),
  ];

  return new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 720, right: 720 }, // 0.5 inch margins
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({ children: [] })], // minimal header
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: `${supplier.companyName}`, size: 14, color: '9CA3AF', font: 'Calibri' }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
      },
      children,
    }],
  });
}

export async function downloadPreferenceDoc(
  supplier: Supplier,
  buyers: Buyer[],
  eventConfig: EventConfig | null,
  eventTitle?: string,
): Promise<void> {
  const doc = generatePreferenceDoc(supplier, buyers, eventConfig, eventTitle);
  const blob = await Packer.toBlob(doc);
  const safeName = supplier.companyName.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
  saveAs(blob, `${safeName} - Preference Form.docx`);
}

export async function downloadAllPreferenceDocsZip(
  suppliers: Supplier[],
  buyers: Buyer[],
  eventConfig: EventConfig | null,
  eventTitle?: string,
): Promise<void> {
  const zip = new JSZip();

  for (const supplier of suppliers) {
    const doc = generatePreferenceDoc(supplier, buyers, eventConfig, eventTitle);
    const blob = await Packer.toBlob(doc);
    const safeName = supplier.companyName.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
    zip.file(`${safeName} - Preference Form.docx`, blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveAs(zipBlob, `Preference Forms - ${eventTitle || eventConfig?.name || 'Event'}.zip`);
}

// --- Word Preference Form Parser ---

export interface ParsedWordPreferences {
  supplierId: string;
  supplierName: string;
  meetAll: boolean;
  preferences: Array<{
    organizationName: string;
    contactName: string;
    choice: 'meet' | 'exclude' | 'none';
    buyerIdFromMeta: string;
  }>;
}

/**
 * Parse a completed Word preference form (.docx) back into preference data.
 * Reads checkbox states from the docx XML.
 * Supports multiple checkbox serialization formats for cross-editor compatibility.
 */
export async function parsePreferenceDocx(file: File): Promise<ParsedWordPreferences | null> {
  try {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file('word/document.xml')?.async('string');
    if (!docXml) return null;

    // Extract supplier ID from [SUPPLIER_ID:xxx]
    const idMatch = docXml.match(/\[SUPPLIER_ID:([^\]]+)\]/);
    const supplierId = idMatch ? idMatch[1] : '';

    // Extract buyer ID map from [BUYER_IDS:orgname=id|...] metadata
    const buyerIdsMatch = docXml.match(/\[BUYER_IDS:([^\]]+)\]/);
    const buyerIdMap = new Map<string, string>();
    if (buyerIdsMatch) {
      for (const pair of buyerIdsMatch[1].split('|')) {
        const eqIdx = pair.indexOf('=');
        if (eqIdx > 0) {
          const key = pair.slice(0, eqIdx).toLowerCase().trim();
          const id = pair.slice(eqIdx + 1).trim();
          if (key && id) buyerIdMap.set(key, id);
        }
      }
    }

    // Extract supplier company name — try multiple patterns for resilience
    let supplierName = '';
    const companyPatterns = [
      /Company:\s*<\/w:t>[\s\S]*?<w:t[^>]*>([^<]+)/,
      /Company:<\/w:t>[\s\S]*?<w:t[^>]*>\s*([^<]+)/,
      /Company:\s*([^<]+)<\/w:t>/,
    ];
    for (const pattern of companyPatterns) {
      const match = docXml.match(pattern);
      if (match && match[1].trim()) {
        supplierName = match[1].trim();
        break;
      }
    }
    // Fallback: extract from footer
    if (!supplierName) {
      const footerXml = await zip.file('word/footer1.xml')?.async('string');
      if (footerXml) {
        const footerTextMatch = footerXml.match(/<w:t[^>]*>([^<]+)<\/w:t>/);
        if (footerTextMatch && footerTextMatch[1].trim()) {
          supplierName = footerTextMatch[1].trim();
        }
      }
    }

    // --- Multi-strategy checkbox detection ---
    const checkboxStates: boolean[] = [];

    // Strategy 1: w14:checkbox SDT blocks (generated by the docx library)
    const sdtCheckboxPattern = /<w14:checkbox>[\s\S]*?<\/w14:checkbox>/g;
    let sdtMatch;
    while ((sdtMatch = sdtCheckboxPattern.exec(docXml)) !== null) {
      const block = sdtMatch[0];
      const checkedMatch = block.match(/w14:checked\s*(?:w14:val\s*=\s*"([^"]*)")?/);
      if (checkedMatch) {
        const val = checkedMatch[1];
        checkboxStates.push(val === '1' || val === 'true' || val === undefined);
      } else {
        checkboxStates.push(false);
      }
    }

    // Strategy 2: legacy form fields (<w:checkBox>)
    if (checkboxStates.length === 0) {
      const legacyPattern = /<w:checkBox>[\s\S]*?<\/w:checkBox>/g;
      let legacyMatch;
      while ((legacyMatch = legacyPattern.exec(docXml)) !== null) {
        const block = legacyMatch[0];
        const checkedMatch = block.match(/<w:checked\s*(?:w:val\s*=\s*"([^"]*)")?/);
        if (checkedMatch) {
          const val = checkedMatch[1];
          checkboxStates.push(val !== '0' && val !== 'false');
        } else {
          checkboxStates.push(false);
        }
      }
    }

    // Strategy 3: Unicode checkbox characters in text
    if (checkboxStates.length === 0) {
      const textPattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      let tMatch;
      while ((tMatch = textPattern.exec(docXml)) !== null) {
        const text = tMatch[1];
        if (text.includes('\u2612')) checkboxStates.push(true);
        else if (text.includes('\u2610')) checkboxStates.push(false);
      }
    }

    // First checkbox is "Meet ALL"
    const meetAll = checkboxStates.length > 0 ? checkboxStates[0] : false;

    // Remaining checkboxes are in pairs: [Meet, Exclude] for each buyer row
    const preferences: ParsedWordPreferences['preferences'] = [];

    // Find table rows
    const rowPattern = /<w:tr\b[\s\S]*?<\/w:tr>/g;
    const allRows: string[] = [];
    let rowMatch;
    while ((rowMatch = rowPattern.exec(docXml)) !== null) {
      allRows.push(rowMatch[0]);
    }

    // Filter to data rows (those containing checkbox SDTs or legacy checkboxes)
    const dataRows = allRows.filter(row =>
      row.includes('w14:checkbox') || row.includes('w:checkBox') ||
      row.includes('\u2612') || row.includes('\u2610')
    );

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];

      // Extract text from FIRST table cell only (before second <w:tc>)
      const cells = row.split(/<w:tc[ >]/);
      const firstCellXml = cells.length > 1 ? cells[1] : '';

      const textRuns: string[] = [];
      const textPattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      let tMatch;
      while ((tMatch = textPattern.exec(firstCellXml)) !== null) {
        const text = tMatch[1].trim();
        // Filter out checkbox Unicode characters
        if (text && text !== '\u2610' && text !== '\u2612') {
          textRuns.push(text);
        }
      }

      // First text run is org name (bold), second might be contact name in parens
      const orgName = textRuns[0] || '';
      const contactRaw = textRuns.length > 1 ? textRuns[1] : '';
      const contactName = contactRaw.replace(/^\s*\(/, '').replace(/\)\s*$/, '').trim();

      // Checkbox pair index: meetAll is index 0, then pairs start at index 1
      const meetIdx = 1 + i * 2;
      const excludeIdx = 2 + i * 2;
      const isMeet = meetIdx < checkboxStates.length ? checkboxStates[meetIdx] : false;
      const isExclude = excludeIdx < checkboxStates.length ? checkboxStates[excludeIdx] : false;

      let choice: 'meet' | 'exclude' | 'none' = 'none';
      if (isMeet) choice = 'meet';
      else if (isExclude) choice = 'exclude';

      if (orgName) {
        // Attach buyer ID from embedded metadata if available
        const buyerIdFromMeta = buyerIdMap.get(orgName.toLowerCase()) || '';
        preferences.push({ organizationName: orgName, contactName, choice, buyerIdFromMeta });
      }
    }

    return { supplierId, supplierName, meetAll, preferences };
  } catch {
    return null;
  }
}
