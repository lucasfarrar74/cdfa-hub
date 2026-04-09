import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useSchedule } from '../context/ScheduleContext';
import {
  generatePreferenceWorkbook,
  downloadWorkbook,
  generateAllPreferenceFormsZip,
  parsePreferenceWorkbook,
  preferencesToSupplierUpdate,
  type ParsedPreferences,
} from '../utils/preferenceExcel';
import {
  downloadPreferenceDoc,
  downloadAllPreferenceDocsZip,
  parsePreferenceDocx,
} from '../utils/preferenceWord';
import { findBestBuyerMatch } from '../utils/matchBuyer';

export default function PreferenceFormPanel() {
  const { suppliers, buyers, eventConfig, updateSupplier } = useSchedule();

  const [mode, setMode] = useState<'generate' | 'import'>('generate');
  const [format, setFormat] = useState<'word' | 'excel'>('word');
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<Array<{
    supplierName: string;
    matched: boolean;
    meetCount: number;
    excludeCount: number;
    noPrefCount: number;
    unmatchedBuyers: number;
  }> | null>(null);
  const [parsedFiles, setParsedFiles] = useState<ParsedPreferences[]>([]);
  const [generating, setGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadSingle = async (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;

    if (format === 'word') {
      await downloadPreferenceDoc(supplier, buyers, eventConfig, eventConfig?.name);
    } else {
      const wb = generatePreferenceWorkbook(supplier, buyers, eventConfig);
      const safeName = supplier.companyName.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
      downloadWorkbook(wb, `${safeName} - Preferences.xlsx`);
    }
  };

  const handleDownloadAll = async () => {
    if (suppliers.length === 0) return;
    setGenerating(true);

    try {
      if (format === 'word') {
        await downloadAllPreferenceDocsZip(suppliers, buyers, eventConfig, eventConfig?.name);
      } else {
        const blob = await generateAllPreferenceFormsZip(suppliers, buyers, eventConfig);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Preference Forms - ${eventConfig?.name || 'Event'}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setImporting(true);
    setImportResults(null);
    const parsed: ParsedPreferences[] = [];

    for (const file of Array.from(files)) {
      try {
        const ext = file.name.split('.').pop()?.toLowerCase();

        if (ext === 'docx') {
          // Parse Word preference form
          const wordResult = await parsePreferenceDocx(file);
          if (wordResult) {
            // Convert Word parsed result to the common ParsedPreferences format
            const prefs: ParsedPreferences['preferences'] = [];

            if (wordResult.meetAll) {
              // "Meet ALL" checked — mark all buyers as meet
              for (const buyer of buyers) {
                prefs.push({ buyerId: buyer.id, buyerName: buyer.name, choice: 'meet' });
              }
            } else {
              for (const wp of wordResult.preferences) {
                // Priority 1: Match by embedded buyer ID metadata
                let buyer = wp.buyerIdFromMeta
                  ? buyers.find(b => b.id === wp.buyerIdFromMeta)
                  : undefined;
                // Priority 2: Fuzzy match by organization/contact name
                if (!buyer) {
                  const match = findBestBuyerMatch(buyers, wp.organizationName, wp.contactName || undefined);
                  buyer = match ? buyers.find(b => b.id === match.id) : undefined;
                }
                prefs.push({
                  buyerId: buyer?.id || '',
                  buyerName: wp.organizationName,
                  choice: wp.choice === 'none' ? 'no_preference' : wp.choice,
                });
              }
            }

            parsed.push({
              supplierId: wordResult.supplierId,
              supplierName: wordResult.supplierName,
              preferences: prefs,
              availabilityRestrictions: [],
            });
          }
        } else {
          // Parse Excel preference form
          const buffer = await file.arrayBuffer();
          const wb = XLSX.read(buffer);
          const result = parsePreferenceWorkbook(wb, buyers);
          if (result) {
            parsed.push(result);
          }
        }
      } catch {
        // Skip unparseable files
      }
    }

    setParsedFiles(parsed);
    setImporting(false);

    // Build preview results
    const results = parsed.map(p => {
      const matched = !!suppliers.find(s =>
        s.id === p.supplierId || s.companyName.toLowerCase() === p.supplierName.toLowerCase()
      );
      return {
        supplierName: p.supplierName,
        matched,
        meetCount: p.preferences.filter(pr => pr.choice === 'meet').length,
        excludeCount: p.preferences.filter(pr => pr.choice === 'exclude').length,
        noPrefCount: p.preferences.filter(pr => pr.choice === 'no_preference').length,
        unmatchedBuyers: p.preferences.filter(pr => !pr.buyerId && pr.choice !== 'no_preference').length,
      };
    });
    setImportResults(results);

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleApplyImport = () => {
    for (const parsed of parsedFiles) {
      // Match supplier by ID first, then by name
      const supplier = suppliers.find(s => s.id === parsed.supplierId)
        || suppliers.find(s => s.companyName.toLowerCase() === parsed.supplierName.toLowerCase());

      if (!supplier) continue;

      const update = preferencesToSupplierUpdate(parsed);
      updateSupplier(supplier.id, {
        preference: update.preference,
        preferenceList: update.preferenceList,
        availabilityRestrictions: update.availabilityRestrictions,
      });
    }

    setParsedFiles([]);
    setImportResults(null);
  };

  const hasBuyers = buyers.length > 0;
  const hasSuppliers = suppliers.length > 0;

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
          <button
            onClick={() => setMode('generate')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === 'generate'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Generate Forms
          </button>
          <button
            onClick={() => setMode('import')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === 'import'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Import Responses
          </button>
        </div>
      </div>

      {mode === 'generate' && (
        <div className="space-y-4">
          {!hasBuyers && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200">
              Add buyers first — the preference forms list all buyers for suppliers to choose from.
            </div>
          )}

          {!hasSuppliers && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200">
              Add suppliers to generate preference forms for.
            </div>
          )}

          {hasBuyers && hasSuppliers && (
            <>
              {/* Format selector + summary */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Generate preference forms for <span className="font-semibold text-gray-900 dark:text-gray-100">{suppliers.length}</span> suppliers
                    with <span className="font-semibold text-gray-900 dark:text-gray-100">{buyers.length}</span> buyers listed.
                    {eventConfig && (
                      <> Event: <span className="font-semibold text-gray-900 dark:text-gray-100">{eventConfig.name}</span></>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Format:</span>
                  <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                    <button
                      onClick={() => setFormat('word')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        format === 'word'
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      Word (.docx)
                    </button>
                    <button
                      onClick={() => setFormat('excel')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        format === 'excel'
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      Excel (.xlsx)
                    </button>
                  </div>
                  {format === 'word' && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">Professional format with checkboxes</span>
                  )}
                  {format === 'excel' && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">Spreadsheet format, supports auto-import</span>
                  )}
                </div>
              </div>

              {/* Download all */}
              <button
                onClick={handleDownloadAll}
                disabled={generating}
                className="w-full px-4 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {generating ? 'Generating...' : `Download All Forms (ZIP)`}
              </button>

              {/* Individual downloads */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Or download individually
                  </p>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {suppliers.map(supplier => (
                    <div key={supplier.id} className="px-4 py-2.5 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {supplier.companyName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {supplier.primaryContact.name}
                          {supplier.primaryContact.email && ` · ${supplier.primaryContact.email}`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDownloadSingle(supplier.id)}
                        className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors shrink-0"
                      >
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {mode === 'import' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Upload completed preference forms (.docx or .xlsx). You can select multiple files at once.
            </p>

            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div className="flex flex-col items-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {importing ? 'Processing...' : 'Click to select files or drag & drop'}
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.docx"
                multiple
                onChange={handleFilesSelected}
              />
            </label>
          </div>

          {/* Import results preview */}
          {importResults && importResults.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Parsed {importResults.length} {importResults.length === 1 ? 'file' : 'files'}
                </h3>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Supplier</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">Matched</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-green-600 dark:text-green-400">Meet</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-red-600 dark:text-red-400">Exclude</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">No Pref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {importResults.map((r, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{r.supplierName}</td>
                      <td className="px-4 py-2 text-center">
                        {r.matched ? (
                          <span className="text-green-600 dark:text-green-400 text-xs font-medium">Yes</span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400 text-xs font-medium">Not found</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-green-600 dark:text-green-400">{r.meetCount}</td>
                      <td className="px-4 py-2 text-right text-sm text-red-600 dark:text-red-400">{r.excludeCount}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-500 dark:text-gray-400">{r.noPrefCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {importResults.some(r => !r.matched) && (
                <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-xs text-amber-700 dark:text-amber-300">
                  Unmatched suppliers will be skipped. Ensure the supplier company name matches exactly.
                </div>
              )}

              {importResults.some(r => r.unmatchedBuyers > 0) && (
                <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-xs text-amber-700 dark:text-amber-300">
                  Some buyer preferences couldn&apos;t be matched to buyers in the system ({importResults.reduce((sum, r) => sum + r.unmatchedBuyers, 0)} total). These preferences will be ignored.
                </div>
              )}

              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                <button
                  onClick={() => { setParsedFiles([]); setImportResults(null); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyImport}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Apply Preferences ({importResults.filter(r => r.matched).length} suppliers)
                </button>
              </div>
            </div>
          )}

          {importResults && importResults.length === 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200">
              No valid preference forms found in the uploaded files. Make sure the files were generated by this tool.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
