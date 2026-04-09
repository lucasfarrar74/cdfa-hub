import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import type { Supplier, Buyer, EventConfig, AvailabilityRestriction } from '../types';
import { findBestBuyerMatch } from './matchBuyer';

// --- Types ---

export interface ParsedPreferences {
  supplierId: string;
  supplierName: string;
  preferences: Array<{
    buyerId: string;
    buyerName: string;
    choice: 'meet' | 'exclude' | 'no_preference';
  }>;
  availabilityRestrictions: AvailabilityRestriction[];
}

// --- Generation ---

function buildTimeSlotRows(eventConfig: EventConfig): string[][] {
  const rows: string[][] = [];
  const start = new Date(`2000-01-01T${eventConfig.startTime}`);
  const end = new Date(`2000-01-01T${eventConfig.endTime}`);
  const duration = eventConfig.defaultMeetingDuration;

  // Generate dates in range
  const startDate = new Date(eventConfig.startDate + 'T00:00:00');
  const endDate = new Date(eventConfig.endDate + 'T00:00:00');

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const dateISO = d.toISOString().split('T')[0];

    for (let t = new Date(start); t < end; t.setMinutes(t.getMinutes() + duration)) {
      const slotStart = t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      const slotEnd = new Date(t.getTime() + duration * 60000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

      // Check if this slot overlaps a break
      const isBreak = eventConfig.breaks.some(b => {
        const breakStart = new Date(`2000-01-01T${b.startTime}`);
        const breakEnd = new Date(`2000-01-01T${b.endTime}`);
        return t >= breakStart && t < breakEnd;
      });

      if (!isBreak) {
        rows.push([dateStr, `${slotStart} - ${slotEnd}`, '', '', dateISO]);
      }
    }
  }

  return rows;
}

export function generatePreferenceWorkbook(
  supplier: Supplier,
  buyers: Buyer[],
  eventConfig: EventConfig | null,
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // --- Sheet 1: Preferences ---
  const prefData: (string | number)[][] = [
    ['MEETING PREFERENCE FORM'],
    [],
    ['Supplier:', supplier.companyName],
    ['Contact:', supplier.primaryContact.name],
    ['Email:', supplier.primaryContact.email || ''],
    [],
    ['Instructions: For each buyer below, mark ONE column with an "X" to indicate your preference.'],
    ['  - Meet: You would like to schedule a meeting with this buyer'],
    ['  - Exclude: You do NOT want to meet with this buyer'],
    ['  - No Preference: You have no strong preference (may or may not be scheduled)'],
    [],
    ['Buyer Name', 'Organization', 'Meet', 'Exclude', 'No Preference', '__BUYER_ID__'],
  ];

  for (const buyer of buyers) {
    prefData.push([buyer.name, buyer.organization, '', '', '', buyer.id]);
  }

  // Add metadata row (hidden info for import matching)
  prefData.push([]);
  prefData.push(['__SUPPLIER_ID__', supplier.id, '__FORM_VERSION__', '1']);

  const prefSheet = XLSX.utils.aoa_to_sheet(prefData);

  // Set column widths
  prefSheet['!cols'] = [
    { wch: 30 }, // Buyer Name
    { wch: 30 }, // Organization
    { wch: 12 }, // Meet
    { wch: 12 }, // Exclude
    { wch: 16 }, // No Preference
    { wch: 0, hidden: true }, // Buyer ID (hidden metadata)
  ];

  // Merge title row
  prefSheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];

  XLSX.utils.book_append_sheet(wb, prefSheet, 'Preferences');

  // --- Sheet 2: Availability ---
  if (eventConfig) {
    const availData: string[][] = [
      ['AVAILABILITY / SCHEDULE RESTRICTIONS'],
      [],
      ['Supplier:', supplier.companyName],
      [],
      ['Instructions: Mark any time slots where you are NOT available with an "X" in the "Unavailable" column.'],
      ['You may also add notes (e.g., "arriving late", "must leave by 3pm").'],
      [],
      ['Date', 'Time Slot', 'Unavailable (X)', 'Notes'],
    ];

    const slotRows = buildTimeSlotRows(eventConfig);
    for (const row of slotRows) {
      // row is [dateStr, timeRange, '', '', dateISO] - only push first 4
      availData.push([row[0], row[1], '', '']);
    }

    availData.push([]);
    availData.push(['Additional Notes:']);
    availData.push(['']);

    const availSheet = XLSX.utils.aoa_to_sheet(availData);
    availSheet['!cols'] = [
      { wch: 20 }, // Date
      { wch: 22 }, // Time Slot
      { wch: 16 }, // Unavailable
      { wch: 40 }, // Notes
    ];
    availSheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];

    XLSX.utils.book_append_sheet(wb, availSheet, 'Availability');
  }

  return wb;
}

export function downloadWorkbook(wb: XLSX.WorkBook, filename: string): void {
  XLSX.writeFile(wb, filename);
}

export async function generateAllPreferenceFormsZip(
  suppliers: Supplier[],
  buyers: Buyer[],
  eventConfig: EventConfig | null,
): Promise<Blob> {
  const zip = new JSZip();

  for (const supplier of suppliers) {
    const wb = generatePreferenceWorkbook(supplier, buyers, eventConfig);
    const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const safeName = supplier.companyName.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
    zip.file(`${safeName} - Preferences.xlsx`, data);
  }

  return zip.generateAsync({ type: 'blob' });
}

// --- Parsing / Import ---

export function parsePreferenceWorkbook(
  workbook: XLSX.WorkBook,
  buyers: Buyer[],
): ParsedPreferences | null {
  const prefSheet = workbook.Sheets['Preferences'];
  if (!prefSheet) return null;

  const data = XLSX.utils.sheet_to_json<string[]>(prefSheet, { header: 1 }) as string[][];

  // Find supplier ID from metadata row (search forward and backward for resilience)
  let supplierId = '';
  let supplierName = '';

  for (const row of data) {
    if (row && row[0] === 'Supplier:') {
      supplierName = String(row[1] || '');
    }
  }
  // Search backward for __SUPPLIER_ID__ in case blank rows were inserted
  for (let i = data.length - 1; i >= 0; i--) {
    const row = data[i];
    if (row && row[0] === '__SUPPLIER_ID__') {
      supplierId = String(row[1] || '');
      break;
    }
  }

  // Find the header row (Buyer Name, Organization, Meet, Exclude, No Preference)
  let headerIdx = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === 'Buyer Name' && data[i][1] === 'Organization') {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx < 0) return null;

  // Helper: check if a cell value represents a marked/checked state
  const isMarked = (val: string): boolean => {
    const v = val.trim().toUpperCase();
    return v === 'X' || v === 'YES' || v === 'Y' || v === '1' || v === 'TRUE';
  };

  // Parse preference rows
  const preferences: ParsedPreferences['preferences'] = [];
  for (let i = headerIdx + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue; // skip fully empty rows
    if (row[0] === '__SUPPLIER_ID__') break; // stop at metadata sentinel

    const buyerName = row[0] != null ? String(row[0]).trim() : '';
    if (!buyerName) continue; // skip rows with empty buyer name

    const buyerOrg = row[1] != null ? String(row[1]).trim() : '';
    const meet = String(row[2] || '').trim();
    const exclude = String(row[3] || '').trim();

    // Priority 1: Match by embedded buyer ID (hidden column 5)
    const buyerIdFromForm = row[5] != null ? String(row[5]).trim() : '';
    let buyer: Buyer | undefined;
    if (buyerIdFromForm && buyerIdFromForm !== '__BUYER_ID__') {
      buyer = buyers.find(b => b.id === buyerIdFromForm);
    }
    // Priority 2: Fuzzy match by name + organization
    if (!buyer) {
      const match = findBestBuyerMatch(buyers, buyerName, buyerOrg || undefined);
      buyer = match ? buyers.find(b => b.id === match.id) : undefined;
    }

    let choice: 'meet' | 'exclude' | 'no_preference' = 'no_preference';
    if (isMarked(meet)) choice = 'meet';
    else if (isMarked(exclude)) choice = 'exclude';

    preferences.push({
      buyerId: buyer?.id || '',
      buyerName,
      choice,
    });
  }

  // Parse availability restrictions
  const availabilityRestrictions: AvailabilityRestriction[] = [];
  const availSheet = workbook.Sheets['Availability'];
  if (availSheet) {
    const availData = XLSX.utils.sheet_to_json<string[]>(availSheet, { header: 1 }) as string[][];

    // Find header row
    let availHeaderIdx = -1;
    for (let i = 0; i < availData.length; i++) {
      if (availData[i][0] === 'Date' && availData[i][1] === 'Time Slot') {
        availHeaderIdx = i;
        break;
      }
    }

    if (availHeaderIdx >= 0) {
      for (let i = availHeaderIdx + 1; i < availData.length; i++) {
        const row = availData[i];
        if (!row || !row[0] || row[0] === 'Additional Notes:' || row[0] === '') break;

        const unavailable = String(row[2] || '').trim().toUpperCase();
        const note = String(row[3] || '').trim();

        if (unavailable === 'X' || unavailable === 'YES' || unavailable === 'Y' || note) {
          availabilityRestrictions.push({
            type: unavailable ? 'unavailable_slot' : 'note',
            note: note || `Unavailable: ${row[0]} ${row[1]}`,
          });
        }
      }
    }
  }

  return {
    supplierId,
    supplierName,
    preferences,
    availabilityRestrictions,
  };
}

/**
 * Convert parsed preferences to supplier update fields.
 * Returns the preference type and list for updateSupplier().
 */
export function preferencesToSupplierUpdate(parsed: ParsedPreferences): {
  preference: 'all' | 'include' | 'exclude';
  preferenceList: string[];
  availabilityRestrictions: AvailabilityRestriction[];
} {
  const meetBuyers = parsed.preferences.filter(p => p.choice === 'meet' && p.buyerId);
  const excludeBuyers = parsed.preferences.filter(p => p.choice === 'exclude' && p.buyerId);

  if (meetBuyers.length > 0) {
    return {
      preference: 'include',
      preferenceList: meetBuyers.map(p => p.buyerId),
      availabilityRestrictions: parsed.availabilityRestrictions,
    };
  } else if (excludeBuyers.length > 0) {
    return {
      preference: 'exclude',
      preferenceList: excludeBuyers.map(p => p.buyerId),
      availabilityRestrictions: parsed.availabilityRestrictions,
    };
  } else {
    return {
      preference: 'all',
      preferenceList: [],
      availabilityRestrictions: parsed.availabilityRestrictions,
    };
  }
}
