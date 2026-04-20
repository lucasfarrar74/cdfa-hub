import { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useSchedule } from '../context/ScheduleContext';
import type { Supplier, Buyer, ContactPerson } from '../types';
import { generateId } from '../utils/timeUtils';
import { BUYER_COLORS, getBuyerColor } from '../utils/colors';
import Papa from 'papaparse';

export default function ParticipantsPanel() {
  const {
    suppliers,
    buyers,
    eventConfig,
    addSupplier,
    updateSupplier,
    removeSupplier,
    addBuyer,
    updateBuyer,
    removeBuyer,
    importSuppliers,
    importBuyers,
    autoAssignBuyerColors,
  } = useSchedule();

  // Compute event days for multi-day events
  const eventDays = useMemo(() => {
    if (!eventConfig?.startDate || !eventConfig?.endDate) return [];
    const days: Array<{ date: string; label: string; short: string }> = [];
    const start = new Date(eventConfig.startDate + 'T00:00:00');
    const end = new Date(eventConfig.endDate + 'T00:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        date: dateStr,
        label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        short: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      });
    }
    return days;
  }, [eventConfig?.startDate, eventConfig?.endDate]);
  const isMultiDay = eventDays.length > 1;

  const [activeList, setActiveList] = useState<'suppliers' | 'buyers'>('suppliers');
  const [showForm, setShowForm] = useState(false);
  const [showSecondary, setShowSecondary] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const repairFileRef = useRef<HTMLInputElement>(null);
  const [repairResult, setRepairResult] = useState<{ updated: number; notFound: string[] } | null>(null);

  // Supplier form state
  const [companyName, setCompanyName] = useState('');
  const [primaryName, setPrimaryName] = useState('');
  const [primaryEmail, setPrimaryEmail] = useState('');
  const [primaryTitle, setPrimaryTitle] = useState('');
  const [secondaryName, setSecondaryName] = useState('');
  const [secondaryEmail, setSecondaryEmail] = useState('');
  const [secondaryTitle, setSecondaryTitle] = useState('');
  const [duration, setDuration] = useState(eventConfig?.defaultMeetingDuration || 15);

  // Buyer form state
  const [buyerName, setBuyerName] = useState('');
  const [buyerOrg, setBuyerOrg] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [editingBuyerId, setEditingBuyerId] = useState<string | null>(null);

  const resetForm = () => {
    setCompanyName('');
    setPrimaryName('');
    setPrimaryEmail('');
    setPrimaryTitle('');
    setSecondaryName('');
    setSecondaryEmail('');
    setSecondaryTitle('');
    setDuration(eventConfig?.defaultMeetingDuration || 15);
    setBuyerName('');
    setBuyerOrg('');
    setBuyerEmail('');
    setShowSecondary(false);
    setShowForm(false);
    setEditingSupplierId(null);
    setEditingBuyerId(null);
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplierId(supplier.id);
    setCompanyName(supplier.companyName);
    setPrimaryName(supplier.primaryContact.name);
    setPrimaryEmail(supplier.primaryContact.email || '');
    setPrimaryTitle(supplier.primaryContact.title || '');
    if (supplier.secondaryContact) {
      setShowSecondary(true);
      setSecondaryName(supplier.secondaryContact.name);
      setSecondaryEmail(supplier.secondaryContact.email || '');
      setSecondaryTitle(supplier.secondaryContact.title || '');
    } else {
      setShowSecondary(false);
      setSecondaryName('');
      setSecondaryEmail('');
      setSecondaryTitle('');
    }
    setDuration(supplier.meetingDuration);
    setShowForm(true);
  };

  const handleSaveSupplier = () => {
    if (!companyName || !primaryName) return;

    const primaryContact: ContactPerson = {
      name: primaryName,
      email: primaryEmail || undefined,
      title: primaryTitle || undefined,
    };

    const secondaryContact: ContactPerson | undefined =
      secondaryName
        ? {
            name: secondaryName,
            email: secondaryEmail || undefined,
            title: secondaryTitle || undefined,
          }
        : undefined;

    if (editingSupplierId) {
      // Update existing supplier (preserves ID and meeting associations)
      updateSupplier(editingSupplierId, {
        companyName,
        primaryContact,
        secondaryContact,
        meetingDuration: duration,
      });
    } else {
      // Add new supplier
      const supplier: Supplier = {
        id: generateId(),
        companyName,
        primaryContact,
        secondaryContact,
        meetingDuration: duration,
        preference: 'all',
        preferenceList: [],
      };
      addSupplier(supplier);
    }

    resetForm();
  };

  const handleEditBuyer = (buyer: Buyer) => {
    setEditingBuyerId(buyer.id);
    setBuyerName(buyer.name);
    setBuyerOrg(buyer.organization);
    setBuyerEmail(buyer.email || '');
    setActiveList('buyers');
    setShowForm(true);
  };

  const handleAddBuyer = () => {
    if (!buyerName) return;

    if (editingBuyerId) {
      updateBuyer(editingBuyerId, {
        name: buyerName,
        organization: buyerOrg,
        email: buyerEmail || undefined,
      });
    } else {
      const buyer: Buyer = {
        id: generateId(),
        name: buyerName,
        organization: buyerOrg,
        email: buyerEmail || undefined,
      };
      addBuyer(buyer);
    }

    resetForm();
  };

  // Extract a date from a Selection string like "Full Day Event - Los Angeles, April 17"
  // Uses the event year from eventConfig, or current year as fallback
  const parseDateFromSelection = (selection: string): string | null => {
    if (!selection) return null;
    // Match patterns like "April 17", "March 5", "Jun 22"
    const monthMatch = selection.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/i);
    if (!monthMatch) return null;
    const year = eventConfig?.startDate ? new Date(eventConfig.startDate + 'T00:00:00').getFullYear() : new Date().getFullYear();
    const parsed = new Date(`${monthMatch[0]}, ${year}`);
    if (isNaN(parsed.getTime())) return null;
    return parsed.toISOString().split('T')[0];
  };

  // Parse rows (from CSV or Excel) into suppliers or buyers
  const processImportRows = (rows: Record<string, string>[]) => {
    if (activeList === 'suppliers') {
      // Group rows by company name to handle duplicates and additional participants
      const companyMap = new Map<string, {
        primary: { name: string; email?: string; phone?: string; title?: string };
        secondary?: { name: string; email?: string; phone?: string; title?: string };
        companyName: string;
        selectedDays: string[];
        duration: number;
      }>();

      for (const row of rows) {
        const company = row['Company Name'] || row.company || row.Company || row.companyName || row.organization || row.Organization || '';
        const firstName = row['First Name'] || row.firstName || '';
        const lastName = row['Last Name'] || row.lastName || '';
        const fullName = (firstName && lastName) ? `${firstName} ${lastName}`.trim()
          : row.contact1_name || row.name || row.Name || row['Primary Contact'] || '';
        const email = row.Email || row.email || row.contact1_email || '';
        const phone = row.Phone || row.phone || row['Work Phone'] || row['Cell Phone'] || '';
        const title = row.title || row.contact1_title || row.Title || '';

        if (!company && !fullName) continue;

        const companyKey = (company || fullName).toLowerCase().trim();

        // Parse day selection from "Selection" column
        const selection = row.Selection || row.selection || '';
        const rowDays: string[] = [];
        if (selection) {
          const parts = selection.split(',').map(s => s.trim());
          for (const part of parts) {
            const date = parseDateFromSelection(part);
            if (date && !rowDays.includes(date)) rowDays.push(date);
          }
        }

        const existing = companyMap.get(companyKey);
        if (existing) {
          // Duplicate company row — add as secondary contact and merge days
          if (!existing.secondary && fullName && fullName !== existing.primary.name) {
            existing.secondary = {
              name: fullName,
              email: email || undefined,
              phone: phone || undefined,
              title: title || undefined,
            };
          }
          // Merge day selections
          for (const day of rowDays) {
            if (!existing.selectedDays.includes(day)) existing.selectedDays.push(day);
          }
        } else {
          companyMap.set(companyKey, {
            companyName: company || fullName,
            primary: {
              name: fullName,
              email: email || undefined,
              phone: phone || undefined,
              title: title || undefined,
            },
            selectedDays: rowDays,
            duration: Number(row.duration || row.Duration) || eventConfig?.defaultMeetingDuration || 15,
          });
        }
      }

      // Build supplier list, skipping companies that already exist in the project
      const existingNames = new Set(suppliers.map(s => s.companyName.toLowerCase().trim()));

      const parsed: Supplier[] = [];
      for (const entry of companyMap.values()) {
        if (existingNames.has(entry.companyName.toLowerCase().trim())) continue;

        parsed.push({
          id: generateId(),
          companyName: entry.companyName,
          primaryContact: entry.primary,
          secondaryContact: entry.secondary,
          meetingDuration: entry.duration,
          preference: 'all',
          preferenceList: [],
          selectedDays: entry.selectedDays.length > 0 ? entry.selectedDays : undefined,
        });
      }

      importSuppliers(parsed);
    } else {
      const existingBuyerNames = new Set(buyers.map(b => b.name.toLowerCase().trim()));

      const parsed: Buyer[] = rows
        .map(row => {
          const firstName = row['First Name'] || row.firstName || '';
          const lastName = row['Last Name'] || row.lastName || '';
          const name = (firstName && lastName) ? `${firstName} ${lastName}`.trim()
            : row.name || row.Name || '';
          return {
            id: generateId(),
            name,
            organization: row.organization || row.Organization || row.company || row.Company || row['Company Name'] || '',
            email: row.email || row.Email || undefined,
          };
        })
        .filter(b => b.name && !existingBuyerNames.has(b.name.toLowerCase().trim()));

      importBuyers(parsed);
    }
  };

  // Repair contact names from Excel/CSV — only updates primaryContact.name on matching suppliers
  const handleRepairFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const processRepairRows = (rows: Record<string, string>[]) => {
      let updated = 0;
      const notFound: string[] = [];

      // Build lookup by normalized company name
      const supplierMap = new Map<string, typeof suppliers[number]>();
      for (const s of suppliers) {
        supplierMap.set(s.companyName.toLowerCase().trim(), s);
      }

      // Group rows by company to capture primary + secondary contacts
      const companyContacts = new Map<string, string[]>();
      for (const row of rows) {
        const company = (row['Company Name'] || row.company || row.Company || row.companyName || row.organization || row.Organization || '').trim();
        const firstName = (row['First Name'] || row.firstName || '').trim();
        const lastName = (row['Last Name'] || row.lastName || '').trim();
        const fullName = (firstName && lastName) ? `${firstName} ${lastName}`
          : (row.contact1_name || row.name || row.Name || row['Primary Contact'] || '').trim();

        if (!company || !fullName) continue;

        const key = company.toLowerCase().trim();
        const existing = companyContacts.get(key) || [];
        if (!existing.includes(fullName)) existing.push(fullName);
        companyContacts.set(key, existing);
      }

      for (const [key, names] of companyContacts) {
        const supplier = supplierMap.get(key);
        if (!supplier) {
          notFound.push(names[0] ? `${key}` : key);
          continue;
        }

        const updates: Partial<typeof supplier> = {};
        if (names[0]) {
          updates.primaryContact = { ...supplier.primaryContact, name: names[0] };
        }
        if (names[1]) {
          updates.secondaryContact = { ...(supplier.secondaryContact || { name: '' }), name: names[1] };
        }
        updateSupplier(supplier.id, updates);
        updated++;
      }

      setRepairResult({ updated, notFound });
      if (repairFileRef.current) repairFileRef.current.value = '';
    };

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: result => processRepairRows(result.data as Record<string, string>[]),
      });
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const rawData = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[sheetName], { header: 1 }) as string[][];
        const headerIdx = findHeaderRow(rawData);
        const headers = rawData[headerIdx].map(h => String(h || '').trim());
        const rows: Record<string, string>[] = rawData.slice(headerIdx + 1)
          .filter(row => row.some(cell => cell && String(cell).trim()))
          .map(row => {
            const obj: Record<string, string> = {};
            headers.forEach((h, i) => { if (h) obj[h] = String(row[i] ?? '').trim(); });
            return obj;
          })
          .filter(isDataRow);
        processRepairRows(rows);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // Detect header row in Excel data (array of arrays)
  const findHeaderRow = (data: string[][]): number => {
    const knownHeaders = ['company', 'company name', 'first name', 'last name', 'name', 'email', 'organization', 'phone'];
    for (let i = 0; i < Math.min(15, data.length); i++) {
      const row = (data[i] || []).map(cell => String(cell || '').toLowerCase().trim());
      const matches = row.filter(cell => knownHeaders.some(h => cell.includes(h)));
      if (matches.length >= 2) return i;
    }
    return 0;
  };

  // Filter out section headers and empty rows from Excel data
  const isDataRow = (row: Record<string, string>): boolean => {
    const values = Object.values(row).filter(v => v && String(v).trim());
    if (values.length < 2) return false;
    // Skip rows that look like section headers (only first column has data, and it's not a number)
    const firstVal = String(Object.values(row)[0] || '').trim();
    if (values.length <= 1 && isNaN(Number(firstVal))) return false;
    return true;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      // CSV parsing via PapaParse
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: result => {
          processImportRows(result.data as Record<string, string>[]);
          if (fileInputRef.current) fileInputRef.current.value = '';
        },
      });
    } else {
      // Excel parsing via xlsx
      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = evt.target?.result;
        if (!data) return;

        const wb = XLSX.read(data, { type: 'array' });

        // Pick the best sheet: prefer one with "Selection" column, fall back to first
        let sheetName = wb.SheetNames[0];
        for (const name of wb.SheetNames) {
          const s = wb.Sheets[name];
          const peek = XLSX.utils.sheet_to_json<string[]>(s, { header: 1 }) as string[][];
          for (let r = 0; r < Math.min(10, peek.length); r++) {
            const row = peek[r] || [];
            if (row.some(cell => String(cell || '').trim().toLowerCase() === 'selection')) {
              sheetName = name;
              break;
            }
          }
          if (sheetName === name && name !== wb.SheetNames[0]) break;
        }

        const sheet = wb.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 }) as string[][];

        // Find header row
        const headerIdx = findHeaderRow(rawData);
        const headers = rawData[headerIdx].map(h => String(h || '').trim());

        // Convert to array of objects using detected headers
        const rows: Record<string, string>[] = [];
        for (let i = headerIdx + 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0) continue;
          const obj: Record<string, string> = {};
          headers.forEach((h, j) => {
            if (h) obj[h] = String(row[j] ?? '').trim();
          });
          if (isDataRow(obj)) {
            rows.push(obj);
          }
        }

        processImportRows(rows);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsArrayBuffer(file);
    }
  };

  return (
    <div className="space-y-6">
      {!eventConfig && (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
          <p className="text-yellow-800 dark:text-yellow-300 text-sm">
            Please configure the event first in the "Event Setup" tab.
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex">
            <button
              onClick={() => {
                setActiveList('suppliers');
                resetForm();
              }}
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                activeList === 'suppliers'
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Suppliers ({suppliers.length})
            </button>
            <button
              onClick={() => {
                setActiveList('buyers');
                resetForm();
              }}
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                activeList === 'buyers'
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Buyers ({buyers.length})
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="flex gap-3 mb-4">
            <button
              onClick={() => setShowForm(true)}
              className="px-3 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-md hover:bg-blue-600 dark:hover:bg-blue-700 text-sm"
            >
              + Add {activeList === 'suppliers' ? 'Supplier' : 'Buyer'}
            </button>
            <label className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 text-sm cursor-pointer">
              Import File
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            {activeList === 'suppliers' && suppliers.length > 0 && (
              <label className="px-3 py-2 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 rounded-md hover:bg-amber-200 dark:hover:bg-amber-800 text-sm cursor-pointer">
                Repair Contact Names
                <input
                  ref={repairFileRef}
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  onChange={handleRepairFile}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {repairResult && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-md text-sm">
              <div className="font-medium text-amber-800 dark:text-amber-200">
                Repair complete: {repairResult.updated} supplier{repairResult.updated !== 1 ? 's' : ''} updated
              </div>
              {repairResult.notFound.length > 0 && (
                <div className="mt-1 text-amber-700 dark:text-amber-300">
                  Not matched ({repairResult.notFound.length}): {repairResult.notFound.join(', ')}
                </div>
              )}
              <button
                onClick={() => setRepairResult(null)}
                className="mt-2 text-xs text-amber-600 dark:text-amber-400 underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {showForm && activeList === 'suppliers' && (
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-md space-y-4">
              {editingSupplierId && (
                <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-600">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">Edit Supplier</h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Meetings will be preserved</span>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="Acme Corporation"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Meeting Duration (min)
                  </label>
                  <input
                    type="number"
                    value={duration}
                    onChange={e => setDuration(Number(e.target.value))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Primary Contact *</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={primaryName}
                    onChange={e => setPrimaryName(e.target.value)}
                    placeholder="Name *"
                    className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                  />
                  <input
                    type="email"
                    value={primaryEmail}
                    onChange={e => setPrimaryEmail(e.target.value)}
                    placeholder="Email"
                    className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                  />
                  <input
                    type="text"
                    value={primaryTitle}
                    onChange={e => setPrimaryTitle(e.target.value)}
                    placeholder="Title (e.g., Sales Director)"
                    className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              {!showSecondary ? (
                <button
                  onClick={() => setShowSecondary(true)}
                  className="text-blue-600 dark:text-blue-400 text-sm hover:underline"
                >
                  + Add Secondary Contact
                </button>
              ) : (
                <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium text-gray-700 dark:text-gray-300">Secondary Contact</h4>
                    <button
                      onClick={() => {
                        setShowSecondary(false);
                        setSecondaryName('');
                        setSecondaryEmail('');
                        setSecondaryTitle('');
                      }}
                      className="text-gray-500 dark:text-gray-400 text-sm hover:text-red-600 dark:hover:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={secondaryName}
                      onChange={e => setSecondaryName(e.target.value)}
                      placeholder="Name"
                      className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                    />
                    <input
                      type="email"
                      value={secondaryEmail}
                      onChange={e => setSecondaryEmail(e.target.value)}
                      placeholder="Email"
                      className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                    />
                    <input
                      type="text"
                      value={secondaryTitle}
                      onChange={e => setSecondaryTitle(e.target.value)}
                      placeholder="Title"
                      className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSaveSupplier}
                  disabled={!companyName || !primaryName}
                  className="px-4 py-2 bg-green-500 dark:bg-green-600 text-white rounded-md hover:bg-green-600 dark:hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-sm"
                >
                  {editingSupplierId ? 'Save Changes' : 'Add Supplier'}
                </button>
                <button
                  onClick={resetForm}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {showForm && activeList === 'buyers' && (
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <input
                  type="text"
                  value={buyerName}
                  onChange={e => setBuyerName(e.target.value)}
                  placeholder="Name *"
                  className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                />
                <input
                  type="text"
                  value={buyerOrg}
                  onChange={e => setBuyerOrg(e.target.value)}
                  placeholder="Organization"
                  className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                />
                <input
                  type="email"
                  value={buyerEmail}
                  onChange={e => setBuyerEmail(e.target.value)}
                  placeholder="Email"
                  className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddBuyer}
                  disabled={!buyerName}
                  className="px-4 py-2 bg-green-500 dark:bg-green-600 text-white rounded-md hover:bg-green-600 dark:hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-sm"
                >
                  {editingBuyerId ? 'Save Buyer' : 'Add Buyer'}
                </button>
                <button
                  onClick={resetForm}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {activeList === 'suppliers' ? (
            suppliers.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                No suppliers added yet. Click "Add Supplier" or "Import CSV" above.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                      <th className="pb-2 font-medium text-gray-900 dark:text-gray-100">Company</th>
                      <th className="pb-2 font-medium text-gray-900 dark:text-gray-100">Primary Contact</th>
                      {isMultiDay && (
                        <th className="pb-2 font-medium text-gray-900 dark:text-gray-100">Days</th>
                      )}
                      <th className="pb-2 font-medium text-gray-900 dark:text-gray-100">Available</th>
                      <th className="pb-2 font-medium text-gray-900 dark:text-gray-100">Duration</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map(supplier => (
                      <tr key={supplier.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="py-2 font-medium text-gray-900 dark:text-gray-100">{supplier.companyName}</td>
                        <td className="py-2 text-gray-900 dark:text-gray-100">
                          <div>{supplier.primaryContact.name}</div>
                          {supplier.primaryContact.email && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {supplier.primaryContact.email}
                            </div>
                          )}
                        </td>
                        {isMultiDay && (
                          <td className="py-2">
                            <div className="flex flex-wrap gap-1">
                              {eventDays.map(day => {
                                const isDayDisabled = eventConfig?.disabledDays?.includes(day.date);
                                const isSelected = supplier.selectedDays?.includes(day.date);
                                const noSelection = !supplier.selectedDays || supplier.selectedDays.length === 0;
                                return (
                                  <button
                                    key={day.date}
                                    disabled={isDayDisabled}
                                    onClick={() => {
                                      if (isDayDisabled) return;
                                      const current = supplier.selectedDays || [];
                                      const updated = isSelected
                                        ? current.filter(d => d !== day.date)
                                        : [...current, day.date];
                                      updateSupplier(supplier.id, { selectedDays: updated.length > 0 ? updated : undefined });
                                    }}
                                    className={`px-2 py-0.5 text-xs rounded-full font-medium transition-colors ${
                                      isDayDisabled
                                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed line-through'
                                        : isSelected
                                          ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                                          : noSelection
                                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 opacity-50'
                                    }`}
                                    title={isDayDisabled ? `${day.label} (disabled)` : `${isSelected ? 'Remove from' : 'Add to'} ${day.label}`}
                                  >
                                    {day.short}
                                  </button>
                                );
                              })}
                              {!supplier.selectedDays?.length && (
                                <span className="text-xs text-gray-400 dark:text-gray-500">All days</span>
                              )}
                            </div>
                          </td>
                        )}
                        <td className="py-2">
                          <div className="flex items-center gap-1">
                            <input
                              type="time"
                              value={supplier.availableFrom || ''}
                              onChange={e => updateSupplier(supplier.id, { availableFrom: e.target.value || undefined })}
                              className="w-[5.5rem] px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              title="Available from"
                            />
                            <span className="text-xs text-gray-400">–</span>
                            <input
                              type="time"
                              value={supplier.availableTo || ''}
                              onChange={e => updateSupplier(supplier.id, { availableTo: e.target.value || undefined })}
                              className="w-[5.5rem] px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              title="Available until"
                            />
                            {(supplier.availableFrom || supplier.availableTo) && (
                              <button
                                onClick={() => updateSupplier(supplier.id, { availableFrom: undefined, availableTo: undefined })}
                                className="text-gray-400 hover:text-red-500 text-xs ml-0.5"
                                title="Clear time restriction"
                              >
                                x
                              </button>
                            )}
                          </div>
                          {!supplier.availableFrom && !supplier.availableTo && (
                            <span className="text-xs text-gray-400 dark:text-gray-500">All day</span>
                          )}
                        </td>
                        <td className="py-2 text-gray-900 dark:text-gray-100">{supplier.meetingDuration} min</td>
                        <td className="py-2">
                          <button
                            onClick={() => handleEditSupplier(supplier)}
                            className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mr-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => removeSupplier(supplier.id)}
                            className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : buyers.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No buyers added yet. Click "Add Buyer" or "Import CSV" above.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  onClick={autoAssignBuyerColors}
                  className="px-3 py-1.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50"
                >
                  Auto-assign Colors
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                      <th className="pb-2 font-medium text-gray-900 dark:text-gray-100 w-12">Color</th>
                      <th className="pb-2 font-medium text-gray-900 dark:text-gray-100">Name</th>
                      <th className="pb-2 font-medium text-gray-900 dark:text-gray-100">Organization</th>
                      <th className="pb-2 font-medium text-gray-900 dark:text-gray-100">Email</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {buyers.map((buyer, index) => (
                      <tr key={buyer.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="py-2">
                          <button
                            onClick={() => setColorPickerOpen(colorPickerOpen === buyer.id ? null : buyer.id)}
                            className="w-6 h-6 rounded border-2 border-gray-200 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                            style={{ backgroundColor: buyer.color || getBuyerColor(index) }}
                            title="Click to change color"
                          />
                        </td>
                        <td className="py-2 text-gray-900 dark:text-gray-100">{buyer.name}</td>
                        <td className="py-2 text-gray-900 dark:text-gray-100">{buyer.organization || '-'}</td>
                        <td className="py-2 text-gray-900 dark:text-gray-100">{buyer.email || '-'}</td>
                        <td className="py-2">
                          <button
                            onClick={() => handleEditBuyer(buyer)}
                            className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mr-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => removeBuyer(buyer.id)}
                            className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Color picker modal — rendered outside table to avoid overflow clipping */}
              {colorPickerOpen && (
                <div className="fixed inset-0 z-50" onClick={() => setColorPickerOpen(null)}>
                  <div
                    className="absolute bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl dark:shadow-gray-900/50 p-3"
                    style={{
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                      {buyers.find(b => b.id === colorPickerOpen)?.name}
                    </p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {BUYER_COLORS.map(color => (
                        <button
                          key={color}
                          onClick={() => {
                            updateBuyer(colorPickerOpen, { color });
                            setColorPickerOpen(null);
                          }}
                          className={`w-7 h-7 rounded border-2 hover:scale-110 transition-transform ${
                            buyers.find(b => b.id === colorPickerOpen)?.color === color
                              ? 'border-gray-800 dark:border-gray-200'
                              : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        updateBuyer(colorPickerOpen, { color: undefined });
                        setColorPickerOpen(null);
                      }}
                      className="mt-2 w-full text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      Reset to auto
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md p-4">
        <h3 className="font-medium text-blue-900 dark:text-blue-300 mb-2">CSV Format</h3>
        {activeList === 'suppliers' ? (
          <p className="text-blue-800 dark:text-blue-400 text-sm">
            Headers: <code className="bg-blue-100 dark:bg-blue-800/50 px-1">company, contact1_name, contact1_email, contact1_title, contact2_name, contact2_email, contact2_title, duration</code>
          </p>
        ) : (
          <p className="text-blue-800 dark:text-blue-400 text-sm">
            Headers: <code className="bg-blue-100 dark:bg-blue-800/50 px-1">name, organization, email</code>
          </p>
        )}
      </div>
    </div>
  );
}
