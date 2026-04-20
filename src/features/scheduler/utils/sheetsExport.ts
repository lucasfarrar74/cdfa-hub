// Google Sheets REST API client.
//
// Takes the format-agnostic sheet structure from buildScheduleWorkbook and
// creates or updates a Google Sheets spreadsheet. The caller handles OAuth
// (see src/lib/googleAuth.ts) and passes in a short-lived access token.

import type { WorkbookSheet, SheetMerge, CellFill } from './buildScheduleWorkbook';

function hexToSheetColor(hex: string): { red: number; green: number; blue: number } {
  const clean = hex.replace('#', '');
  return {
    red: parseInt(clean.slice(0, 2), 16) / 255,
    green: parseInt(clean.slice(2, 4), 16) / 255,
    blue: parseInt(clean.slice(4, 6), 16) / 255,
  };
}

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

interface SheetProperties {
  sheetId: number;
  title: string;
}

async function sheetsFetch<T>(url: string, init: RequestInit, accessToken: string): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Sheets API ${res.status}: ${body.slice(0, 400)}`);
  }
  return res.json() as Promise<T>;
}

/** Escape a sheet name for use in an A1 range reference. */
function escapeRangeName(name: string): string {
  // Sheet names with spaces or special chars must be wrapped in single quotes,
  // and literal single quotes inside are doubled.
  return `'${name.replace(/'/g, "''")}'`;
}

function buildValueUpdates(sheets: WorkbookSheet[]): Array<{ range: string; values: string[][] }> {
  return sheets.map(s => ({
    range: `${escapeRangeName(s.name)}!A1`,
    values: s.rows,
  }));
}

function buildFormattingRequests(
  sheets: WorkbookSheet[],
  sheetIdByName: Map<string, number>,
): object[] {
  const requests: object[] = [];

  for (const sheet of sheets) {
    const sheetId = sheetIdByName.get(sheet.name);
    if (sheetId === undefined) continue;

    const rowCount = sheet.rows.length;
    const colCount = sheet.rows.reduce((max, r) => Math.max(max, r.length), 0);

    // Column widths (Excel wch → px at ~7 px per char).
    if (sheet.columnWidths?.length) {
      sheet.columnWidths.forEach((wch, idx) => {
        requests.push({
          updateDimensionProperties: {
            range: {
              sheetId,
              dimension: 'COLUMNS',
              startIndex: idx,
              endIndex: idx + 1,
            },
            properties: { pixelSize: Math.round(wch * 7) },
            fields: 'pixelSize',
          },
        });
      });
    }

    // Merged ranges.
    if (sheet.merges?.length) {
      for (const m of sheet.merges) {
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: m.startRow,
              endRowIndex: m.endRow + 1,
              startColumnIndex: m.startCol,
              endColumnIndex: m.endCol + 1,
            },
            mergeType: 'MERGE_ALL',
          },
        });
      }
    }

    // Base formatting across the entire data area: wrap, 11pt, vertically
    // centered. This keeps long buyer/supplier names readable without
    // manual row-height tweaking.
    if (rowCount > 0 && colCount > 0) {
      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: rowCount,
            startColumnIndex: 0,
            endColumnIndex: colCount,
          },
          cell: {
            userEnteredFormat: {
              wrapStrategy: sheet.wrapText ? 'WRAP' : 'OVERFLOW_CELL',
              verticalAlignment: 'MIDDLE',
              textFormat: { fontSize: 11 },
            },
          },
          fields: 'userEnteredFormat(wrapStrategy,verticalAlignment,textFormat.fontSize)',
        },
      });
    }

    // Title row — bold, larger, centered.
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, fontSize: 16 },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(textFormat.bold,textFormat.fontSize,horizontalAlignment)',
      },
    });

    // Date / subtitle row — bold, centered, smaller than title.
    if (rowCount >= 2) {
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 1, endRowIndex: 2 },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true, fontSize: 12 },
              horizontalAlignment: 'CENTER',
            },
          },
          fields: 'userEnteredFormat(textFormat.bold,textFormat.fontSize,horizontalAlignment)',
        },
      });
    }

    // Per-cell background fills for buyer-colored meetings and header banners.
    if (sheet.cellFills?.length) {
      for (const fill of sheet.cellFills) {
        requests.push({
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: fill.row,
              endRowIndex: fill.row + 1,
              startColumnIndex: fill.col,
              endColumnIndex: fill.col + 1,
            },
            cell: {
              userEnteredFormat: { backgroundColor: hexToSheetColor(fill.color) },
            },
            fields: 'userEnteredFormat.backgroundColor',
          },
        });
      }
    }

    // Freeze header rows so they stay visible when scrolling.
    if (sheet.frozenRows && sheet.frozenRows > 0) {
      requests.push({
        updateSheetProperties: {
          properties: { sheetId, gridProperties: { frozenRowCount: sheet.frozenRows } },
          fields: 'gridProperties.frozenRowCount',
        },
      });
    }

    // Auto-resize rows to fit wrapped content after everything else is set.
    if (rowCount > 0) {
      requests.push({
        autoResizeDimensions: {
          dimensions: {
            sheetId,
            dimension: 'ROWS',
            startIndex: 0,
            endIndex: rowCount,
          },
        },
      });
    }
  }

  return requests;
}

// Re-export so consumers don't need to import from buildScheduleWorkbook directly.
export type { CellFill };

/**
 * Create a new Google Spreadsheet with all the given sheets populated.
 * Returns the spreadsheetId and URL.
 */
export async function createScheduleSheet(
  sheets: WorkbookSheet[],
  title: string,
  accessToken: string,
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  if (sheets.length === 0) {
    throw new Error('No sheets to export — schedule appears empty.');
  }

  // Step 1: create the spreadsheet with empty sheets matching our names.
  type CreateRes = {
    spreadsheetId: string;
    spreadsheetUrl: string;
    sheets: Array<{ properties: SheetProperties }>;
  };
  const created = await sheetsFetch<CreateRes>(
    SHEETS_API,
    {
      method: 'POST',
      body: JSON.stringify({
        properties: { title },
        sheets: sheets.map(s => ({ properties: { title: s.name } })),
      }),
    },
    accessToken,
  );

  const sheetIdByName = new Map<string, number>();
  for (const s of created.sheets) {
    sheetIdByName.set(s.properties.title, s.properties.sheetId);
  }

  // Step 2: bulk-populate values.
  await sheetsFetch(
    `${SHEETS_API}/${created.spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: buildValueUpdates(sheets),
      }),
    },
    accessToken,
  );

  // Step 3: apply column widths, merges, and header formatting.
  const formattingRequests = buildFormattingRequests(sheets, sheetIdByName);
  if (formattingRequests.length > 0) {
    await sheetsFetch(
      `${SHEETS_API}/${created.spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        body: JSON.stringify({ requests: formattingRequests }),
      },
      accessToken,
    );
  }

  return {
    spreadsheetId: created.spreadsheetId,
    spreadsheetUrl: created.spreadsheetUrl,
  };
}

/**
 * Update an existing spreadsheet with new sheet data. Clears each target
 * sheet first, then re-writes values. Does not touch tabs in the sheet
 * that aren't in our `sheets` list, so manual annotations in a side tab
 * survive a refresh.
 */
export async function updateScheduleSheet(
  sheets: WorkbookSheet[],
  spreadsheetId: string,
  accessToken: string,
): Promise<void> {
  if (sheets.length === 0) return;

  // Look up the current sheet IDs so we know which of ours already exist.
  type GetRes = { sheets: Array<{ properties: SheetProperties }> };
  const current = await sheetsFetch<GetRes>(
    `${SHEETS_API}/${spreadsheetId}?fields=sheets.properties`,
    { method: 'GET' },
    accessToken,
  );
  const existingIds = new Map<string, number>();
  for (const s of current.sheets) {
    existingIds.set(s.properties.title, s.properties.sheetId);
  }

  // Create any missing sheets, then collect their ids.
  const addRequests: object[] = [];
  for (const s of sheets) {
    if (!existingIds.has(s.name)) {
      addRequests.push({ addSheet: { properties: { title: s.name } } });
    }
  }
  if (addRequests.length > 0) {
    type BatchRes = { replies: Array<{ addSheet?: { properties: SheetProperties } }> };
    const res = await sheetsFetch<BatchRes>(
      `${SHEETS_API}/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        body: JSON.stringify({ requests: addRequests }),
      },
      accessToken,
    );
    for (const reply of res.replies ?? []) {
      const props = reply.addSheet?.properties;
      if (props) existingIds.set(props.title, props.sheetId);
    }
  }

  // Clear existing data in each target sheet.
  const clearRanges = sheets
    .filter(s => existingIds.has(s.name))
    .map(s => escapeRangeName(s.name));
  if (clearRanges.length > 0) {
    await sheetsFetch(
      `${SHEETS_API}/${spreadsheetId}/values:batchClear`,
      {
        method: 'POST',
        body: JSON.stringify({ ranges: clearRanges }),
      },
      accessToken,
    );
  }

  // Write fresh values.
  await sheetsFetch(
    `${SHEETS_API}/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: buildValueUpdates(sheets),
      }),
    },
    accessToken,
  );

  // Re-apply formatting (column widths, merges). Safe to re-apply.
  const formattingRequests = buildFormattingRequests(sheets, existingIds);
  if (formattingRequests.length > 0) {
    await sheetsFetch(
      `${SHEETS_API}/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        body: JSON.stringify({ requests: formattingRequests }),
      },
      accessToken,
    );
  }
}

// Re-export for convenience so callers only need one import.
export type { WorkbookSheet, SheetMerge };
