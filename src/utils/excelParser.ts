import * as XLSX from 'xlsx';

// Types for Excel parsing
export interface ParsedRow {
  [key: string]: string | number | undefined;
}

export interface ExcelParseResult {
  headers: string[];
  headerRowIndex: number;
  rows: ParsedRow[];
  sheetNames: string[];
  activeSheet: string;
  rawData: (string | number | undefined)[][];
}

export interface ColumnMapping {
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  website: string | null;
  products: string | null;
}

export interface MappedSupplier {
  id: string;
  companyName: string;
  primaryContact: {
    name: string;
    email?: string;
  };
  meetingDuration: number;
  preference: 'all' | 'include' | 'exclude';
  preferenceList: string[];
}

// Header patterns for auto-detection
const HEADER_PATTERNS: Record<keyof ColumnMapping, string[]> = {
  companyName: ['company', 'company name', 'organization', 'org', 'business', 'firm'],
  firstName: ['first', 'first name', 'firstname', 'given name'],
  lastName: ['last', 'last name', 'lastname', 'surname', 'family name'],
  email: ['email', 'e-mail', 'mail', 'primary contact', 'contact email'],
  website: ['website', 'web', 'url', 'site'],
  products: ['product', 'products', 'items', 'goods', 'services'],
};

/**
 * Generate a unique ID for suppliers
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Detect the header row in the Excel data
 * Looks for rows containing known header patterns
 */
export function detectHeaderRow(rows: (string | number | undefined)[][]): number {
  const headerKeywords = ['company', 'name', 'first', 'last', 'email', 'contact', 'organization'];

  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const row = rows[i];
    if (!row) continue;

    // Convert row to lowercase strings for matching
    const rowStrings = row.map(cell => String(cell ?? '').toLowerCase().trim());

    // Count how many header keywords match
    const matches = headerKeywords.filter(keyword =>
      rowStrings.some(cell => cell.includes(keyword))
    );

    // If we find at least 2 header keywords, this is likely the header row
    if (matches.length >= 2) {
      return i;
    }
  }

  // Default to row 0 if no headers detected
  return 0;
}

/**
 * Check if a row is a data row (not empty, not a section header)
 */
function isDataRow(row: (string | number | undefined)[], _headerIndex: number): boolean {
  if (!row) return false;

  // Count non-empty cells
  const nonEmptyCells = row.filter(cell => {
    const val = String(cell ?? '').trim();
    return val !== '' && val !== 'undefined' && val !== 'null';
  });

  // Skip rows with less than 2 non-empty cells (likely section headers or empty)
  if (nonEmptyCells.length < 2) return false;

  // Skip rows that look like section headers (e.g., "General Attendees")
  // These typically have only one or two cells filled
  // and the first cell doesn't look like a row number or company name
  const firstCell = String(row[0] ?? '').trim().toLowerCase();
  if (nonEmptyCells.length <= 2 &&
      (firstCell.includes('attendee') ||
       firstCell.includes('section') ||
       firstCell.includes('category') ||
       firstCell === '')) {
    return false;
  }

  return true;
}

/**
 * Parse an Excel file and extract structured data
 */
export function parseExcelFile(file: File): Promise<ExcelParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const sheetNames = workbook.SheetNames;
        // Prefer sheet named "Participating Companies" if it exists
        let activeSheet = sheetNames.find(name =>
          name.toLowerCase().includes('participat') ||
          name.toLowerCase().includes('compan')
        ) || sheetNames[0];

        const worksheet = workbook.Sheets[activeSheet];

        // Convert to array of arrays
        const rawData = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(worksheet, {
          header: 1,
          defval: undefined,
        });

        // Detect header row
        const headerRowIndex = detectHeaderRow(rawData);

        // Extract headers
        const headerRow = rawData[headerRowIndex] || [];
        const headers = headerRow.map(cell => String(cell ?? '').trim());

        // Extract data rows (after header)
        const dataRows: ParsedRow[] = [];
        for (let i = headerRowIndex + 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || !isDataRow(row, headerRowIndex)) continue;

          const parsedRow: ParsedRow = {};
          headers.forEach((header, index) => {
            if (header) {
              parsedRow[header] = row[index];
            }
          });

          // Only add rows that have at least some meaningful data
          const hasData = Object.values(parsedRow).some(val =>
            val !== undefined && String(val).trim() !== ''
          );
          if (hasData) {
            dataRows.push(parsedRow);
          }
        }

        resolve({
          headers,
          headerRowIndex,
          rows: dataRows,
          sheetNames,
          activeSheet,
          rawData,
        });
      } catch (error) {
        reject(new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Auto-detect column mappings based on header names
 */
export function autoDetectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    companyName: null,
    firstName: null,
    lastName: null,
    email: null,
    website: null,
    products: null,
  };

  for (const header of headers) {
    const headerLower = header.toLowerCase().trim();

    for (const [field, patterns] of Object.entries(HEADER_PATTERNS)) {
      if (mapping[field as keyof ColumnMapping] !== null) continue;

      for (const pattern of patterns) {
        if (headerLower === pattern || headerLower.includes(pattern)) {
          mapping[field as keyof ColumnMapping] = header;
          break;
        }
      }
    }
  }

  return mapping;
}

/**
 * Transform parsed Excel rows into Supplier objects
 */
export function transformToSuppliers(
  rows: ParsedRow[],
  mapping: ColumnMapping,
  defaultMeetingDuration: number = 15
): MappedSupplier[] {
  const suppliers: MappedSupplier[] = [];

  for (const row of rows) {
    // Get company name (required)
    const companyName = mapping.companyName
      ? String(row[mapping.companyName] ?? '').trim()
      : '';

    if (!companyName) continue; // Skip rows without company name

    // Get contact name (combine first and last if available)
    let contactName = '';
    if (mapping.firstName && mapping.lastName) {
      const firstName = String(row[mapping.firstName] ?? '').trim();
      const lastName = String(row[mapping.lastName] ?? '').trim();
      contactName = [firstName, lastName].filter(Boolean).join(' ');
    } else if (mapping.firstName) {
      contactName = String(row[mapping.firstName] ?? '').trim();
    } else if (mapping.lastName) {
      contactName = String(row[mapping.lastName] ?? '').trim();
    }

    // Get email (optional)
    const email = mapping.email
      ? String(row[mapping.email] ?? '').trim()
      : undefined;

    suppliers.push({
      id: generateId(),
      companyName,
      primaryContact: {
        name: contactName || 'Contact',
        email: email || undefined,
      },
      meetingDuration: defaultMeetingDuration,
      preference: 'all',
      preferenceList: [],
    });
  }

  return suppliers;
}

/**
 * Parse Excel and get sheet data for a specific sheet
 */
export function parseSheet(workbook: XLSX.WorkBook, sheetName: string): ExcelParseResult {
  const worksheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(worksheet, {
    header: 1,
    defval: undefined,
  });

  const headerRowIndex = detectHeaderRow(rawData);
  const headerRow = rawData[headerRowIndex] || [];
  const headers = headerRow.map(cell => String(cell ?? '').trim());

  const dataRows: ParsedRow[] = [];
  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || !isDataRow(row, headerRowIndex)) continue;

    const parsedRow: ParsedRow = {};
    headers.forEach((header, index) => {
      if (header) {
        parsedRow[header] = row[index];
      }
    });

    const hasData = Object.values(parsedRow).some(val =>
      val !== undefined && String(val).trim() !== ''
    );
    if (hasData) {
      dataRows.push(parsedRow);
    }
  }

  return {
    headers,
    headerRowIndex,
    rows: dataRows,
    sheetNames: workbook.SheetNames,
    activeSheet: sheetName,
    rawData,
  };
}
