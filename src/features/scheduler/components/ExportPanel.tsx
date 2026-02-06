import { useSchedule } from '../context/ScheduleContext';
import { formatTime, formatDateRange, formatDateReadable, getUniqueDatesFromSlots } from '../utils/timeUtils';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import {
  exportSupplierScheduleToWord,
  exportBuyerScheduleToWord,
  exportMasterScheduleToWord,
} from '../utils/exportWord';

export default function ExportPanel() {
  const {
    eventConfig,
    suppliers,
    buyers,
    meetings,
    timeSlots,
    exportToJSON,
    importFromJSON,
    resetAllData,
  } = useSchedule();

  const getBuyer = (id: string) => buyers.find(b => b.id === id);
  const getSupplier = (id: string) => suppliers.find(s => s.id === id);
  const getSlot = (id: string) => timeSlots.find(s => s.id === id);

  const meetingSlots = timeSlots.filter(s => !s.isBreak);
  const activeMeetings = meetings.filter(m => m.status !== 'cancelled' && m.status !== 'bumped');
  const dates = getUniqueDatesFromSlots(timeSlots);
  const isMultiDay = dates.length > 1;
  const dateRangeStr = eventConfig ? formatDateRange(eventConfig.startDate, eventConfig.endDate) : '';

  // Helper to add professional header to PDF
  const addPdfHeader = (doc: jsPDF, title: string): number => {
    // Blue header bar
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 220, 20, 'F');

    // Event name in header
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(eventConfig?.name || 'Meeting Schedule', 14, 13);

    // Reset colors
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');

    // Date range and title
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(dateRangeStr, 14, 28);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 34);

    // Section title
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, 48);
    doc.setFont('helvetica', 'normal');

    return 58; // Return starting Y position for content
  };

  // Helper to add page footer
  const addPdfFooter = (doc: jsPDF) => {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(
        `Page ${i} of ${pageCount} | ${eventConfig?.name || 'Meeting Schedule'}`,
        105,
        290,
        { align: 'center' }
      );
    }
  };

  const exportSupplierPDF = () => {
    const doc = new jsPDF();

    suppliers.forEach((supplier, supplierIndex) => {
      // Add new page for each supplier (except first)
      if (supplierIndex > 0) {
        doc.addPage();
      }

      let y = addPdfHeader(doc, 'Schedule by Supplier');

      // Supplier name with subtle background
      doc.setFillColor(243, 244, 246);
      doc.rect(14, y - 5, 182, 8, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(supplier.companyName, 16, y);
      y += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text(
        `Contact: ${supplier.primaryContact.name}${supplier.primaryContact.email ? ` (${supplier.primaryContact.email})` : ''}`,
        16,
        y
      );
      if (supplier.secondaryContact) {
        y += 4;
        doc.text(
          `Secondary: ${supplier.secondaryContact.name}${supplier.secondaryContact.email ? ` (${supplier.secondaryContact.email})` : ''}`,
          16,
          y
        );
      }
      y += 6;

      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      const supplierMeetings = activeMeetings.filter(m => m.supplierId === supplier.id);

      meetingSlots.forEach((slot, slotIndex) => {
        if (y > 280) {
          doc.addPage();
          y = 25;
        }
        const meeting = supplierMeetings.find(m => m.timeSlotId === slot.id);
        const buyer = meeting ? getBuyer(meeting.buyerId) : null;

        // Alternating row colors
        if (slotIndex % 2 === 0) {
          doc.setFillColor(249, 250, 251);
          doc.rect(16, y - 3, 178, 5, 'F');
        }

        const timeStr = isMultiDay
          ? `${formatDateReadable(slot.date).split(',')[0]} ${formatTime(slot.startTime)}`
          : formatTime(slot.startTime);
        doc.text(`${timeStr}: ${buyer?.name || '-'}`, 20, y);
        y += 5;
      });
    });

    addPdfFooter(doc);
    doc.save('schedule-by-supplier.pdf');
  };

  const exportBuyerPDF = () => {
    const doc = new jsPDF();

    buyers.forEach((buyer, buyerIndex) => {
      // Add new page for each buyer (except first)
      if (buyerIndex > 0) {
        doc.addPage();
      }

      let y = addPdfHeader(doc, 'Schedule by Buyer');

      // Buyer name with subtle background
      doc.setFillColor(243, 244, 246);
      doc.rect(14, y - 5, 182, 8, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(`${buyer.name} (${buyer.organization})`, 16, y);
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      const buyerMeetings = activeMeetings.filter(m => m.buyerId === buyer.id);

      meetingSlots.forEach((slot, slotIndex) => {
        if (y > 280) {
          doc.addPage();
          y = 25;
        }
        const meeting = buyerMeetings.find(m => m.timeSlotId === slot.id);
        const supplier = meeting ? getSupplier(meeting.supplierId) : null;

        // Alternating row colors
        if (slotIndex % 2 === 0) {
          doc.setFillColor(249, 250, 251);
          doc.rect(16, y - 3, 178, 5, 'F');
        }

        const timeStr = isMultiDay
          ? `${formatDateReadable(slot.date).split(',')[0]} ${formatTime(slot.startTime)}`
          : formatTime(slot.startTime);
        doc.text(`${timeStr}: ${supplier?.companyName || '-'}`, 20, y);
        y += 5;
      });
    });

    addPdfFooter(doc);
    doc.save('schedule-by-buyer.pdf');
  };

  const exportMasterPDF = () => {
    const doc = new jsPDF('landscape');

    // Professional header for landscape
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 300, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(eventConfig?.name || 'Master Schedule', 14, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(dateRangeStr, 200, 12);

    doc.setTextColor(0, 0, 0);
    let y = 28;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Master Schedule Grid', 14, y);
    doc.setFont('helvetica', 'normal');
    y += 10;

    // Process by day if multi-day
    for (const date of dates) {
      const daySlots = meetingSlots.filter(s => s.date === date);

      if (isMultiDay) {
        if (y > 180) {
          doc.addPage('landscape');
          y = 20;
        }
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(formatDateReadable(date), 14, y);
        doc.setFont('helvetica', 'normal');
        y += 6;
      }

      // Header row with blue background
      const colWidth = Math.min((270 - 30) / suppliers.length, 25);
      doc.setFillColor(37, 99, 235);
      doc.rect(14, y - 4, 270, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('Time', 16, y);
      suppliers.forEach((s, i) => {
        doc.text(s.companyName.substring(0, 10), 35 + i * colWidth, y);
      });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      y += 6;

      // Grid rows
      daySlots.forEach((slot, slotIndex) => {
        if (y > 190) {
          doc.addPage('landscape');
          y = 20;
        }

        // Alternating row colors
        if (slotIndex % 2 === 0) {
          doc.setFillColor(249, 250, 251);
          doc.rect(14, y - 3, 270, 5, 'F');
        }

        doc.setFontSize(7);
        doc.text(formatTime(slot.startTime), 16, y);
        suppliers.forEach((supplier, i) => {
          const meeting = activeMeetings.find(
            m => m.supplierId === supplier.id && m.timeSlotId === slot.id
          );
          const buyer = meeting ? getBuyer(meeting.buyerId) : null;
          doc.text(buyer?.name?.substring(0, 10) || '-', 35 + i * colWidth, y);
        });
        y += 5;
      });

      y += 8;
    }

    addPdfFooter(doc);
    doc.save('master-schedule.pdf');
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Master grid sheet with professional header
    const gridHeader = [
      [eventConfig?.name || 'Meeting Schedule'],
      [dateRangeStr],
      [`Generated: ${new Date().toLocaleDateString()}`],
      [], // Empty row
      [isMultiDay ? 'Date' : '', 'Time', ...suppliers.map(s => s.companyName)].filter(Boolean),
    ];
    const gridRows = meetingSlots.map(slot => {
      const row = [
        formatTime(slot.startTime),
        ...suppliers.map(supplier => {
          const meeting = activeMeetings.find(
            m => m.supplierId === supplier.id && m.timeSlotId === slot.id
          );
          return meeting ? getBuyer(meeting.buyerId)?.name || '' : '';
        }),
      ];
      if (isMultiDay) {
        row.unshift(formatDateReadable(slot.date));
      }
      return row;
    });
    const gridSheet = XLSX.utils.aoa_to_sheet([...gridHeader, ...gridRows]);

    // Set column widths
    gridSheet['!cols'] = [
      ...(isMultiDay ? [{ wch: 18 }] : []),
      { wch: 10 },
      ...suppliers.map(() => ({ wch: 18 })),
    ];

    // Merge title row
    gridSheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: suppliers.length + (isMultiDay ? 1 : 0) } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: suppliers.length + (isMultiDay ? 1 : 0) } },
    ];

    XLSX.utils.book_append_sheet(wb, gridSheet, 'Master Grid');

    // By Supplier sheet with header
    const supplierHeader = [
      [eventConfig?.name || 'Meeting Schedule'],
      ['Schedule by Supplier'],
      [],
      [isMultiDay ? 'Date' : '', 'Time', ...suppliers.map(s => s.companyName)].filter(Boolean),
    ];
    const supplierRows = meetingSlots.map(slot => {
      const row = [
        formatTime(slot.startTime),
        ...suppliers.map(supplier => {
          const meeting = activeMeetings.filter(m => m.supplierId === supplier.id)
            .find(m => m.timeSlotId === slot.id);
          return meeting ? getBuyer(meeting.buyerId)?.name || '' : '';
        }),
      ];
      if (isMultiDay) {
        row.unshift(formatDateReadable(slot.date));
      }
      return row;
    });
    const supplierSheet = XLSX.utils.aoa_to_sheet([...supplierHeader, ...supplierRows]);
    supplierSheet['!cols'] = [
      ...(isMultiDay ? [{ wch: 18 }] : []),
      { wch: 10 },
      ...suppliers.map(() => ({ wch: 18 })),
    ];
    XLSX.utils.book_append_sheet(wb, supplierSheet, 'By Supplier');

    // By Buyer sheet with header
    const buyerHeader = [
      [eventConfig?.name || 'Meeting Schedule'],
      ['Schedule by Buyer'],
      [],
      [isMultiDay ? 'Date' : '', 'Time', ...buyers.map(b => b.name)].filter(Boolean),
    ];
    const buyerRows = meetingSlots.map(slot => {
      const row = [
        formatTime(slot.startTime),
        ...buyers.map(buyer => {
          const meeting = activeMeetings.filter(m => m.buyerId === buyer.id)
            .find(m => m.timeSlotId === slot.id);
          return meeting ? getSupplier(meeting.supplierId)?.companyName || '' : '';
        }),
      ];
      if (isMultiDay) {
        row.unshift(formatDateReadable(slot.date));
      }
      return row;
    });
    const buyerSheet = XLSX.utils.aoa_to_sheet([...buyerHeader, ...buyerRows]);
    buyerSheet['!cols'] = [
      ...(isMultiDay ? [{ wch: 18 }] : []),
      { wch: 10 },
      ...buyers.map(() => ({ wch: 18 })),
    ];
    XLSX.utils.book_append_sheet(wb, buyerSheet, 'By Buyer');

    // All meetings list with detailed info
    const meetingsHeader = [
      [eventConfig?.name || 'Meeting Schedule'],
      ['All Meetings Detail'],
      [],
    ];
    const meetingsList = activeMeetings.map(m => {
      const slot = getSlot(m.timeSlotId);
      const supplier = getSupplier(m.supplierId);
      return {
        ...(isMultiDay ? { Date: slot ? formatDateReadable(slot.date) : '' } : {}),
        Time: slot ? formatTime(slot.startTime) : '',
        Supplier: supplier?.companyName || '',
        'Primary Contact': supplier?.primaryContact.name || '',
        'Primary Email': supplier?.primaryContact.email || '',
        'Secondary Contact': supplier?.secondaryContact?.name || '',
        'Secondary Email': supplier?.secondaryContact?.email || '',
        Buyer: getBuyer(m.buyerId)?.name || '',
        Organization: getBuyer(m.buyerId)?.organization || '',
        Status: m.status,
      };
    });
    const meetingsSheet = XLSX.utils.aoa_to_sheet(meetingsHeader);
    XLSX.utils.sheet_add_json(meetingsSheet, meetingsList, { origin: 'A4' });
    meetingsSheet['!cols'] = [
      ...(isMultiDay ? [{ wch: 18 }] : []),
      { wch: 10 },
      { wch: 20 },
      { wch: 18 },
      { wch: 25 },
      { wch: 18 },
      { wch: 25 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, meetingsSheet, 'All Meetings');

    XLSX.writeFile(wb, 'schedule.xlsx');
  };

  const handleExportJSON = () => {
    const json = exportToJSON();
    const parsed = JSON.parse(json);

    // Log what's being exported for debugging
    console.log('[Export] Exporting project:', {
      name: parsed.name,
      meetingsCount: parsed.meetings?.length ?? 0,
      timeSlotsCount: parsed.timeSlots?.length ?? 0,
      suppliersCount: parsed.suppliers?.length ?? 0,
      buyersCount: parsed.buyers?.length ?? 0,
    });

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${parsed.name || 'schedule'}-backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const json = event.target?.result as string;
        const parsed = JSON.parse(json);

        // Show what will be imported
        const meetingsCount = parsed.meetings?.length ?? 0;
        const suppliersCount = parsed.suppliers?.length ?? 0;
        const buyersCount = parsed.buyers?.length ?? 0;

        importFromJSON(json);

        // Provide detailed feedback
        const details = [
          `${suppliersCount} suppliers`,
          `${buyersCount} buyers`,
          meetingsCount > 0 ? `${meetingsCount} scheduled meetings` : 'no scheduled meetings',
        ].join(', ');

        alert(`Data imported successfully!\n\nImported: ${details}`);
      } catch {
        alert('Failed to import data. Invalid file format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const hasSchedule = meetings.length > 0;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Export Schedule</h2>

        {!hasSchedule ? (
          <p className="text-gray-500 dark:text-gray-400">Generate a schedule first to enable exports.</p>
        ) : (
          <>
            {/* PDF Exports */}
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">PDF Documents</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <button
                onClick={exportSupplierPDF}
                className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
              >
                <div className="text-2xl mb-2">📄</div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Supplier Schedules</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">PDF by supplier</div>
              </button>

              <button
                onClick={exportBuyerPDF}
                className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
              >
                <div className="text-2xl mb-2">📄</div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Buyer Schedules</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">PDF by buyer</div>
              </button>

              <button
                onClick={exportMasterPDF}
                className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
              >
                <div className="text-2xl mb-2">📊</div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Master Grid</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">PDF overview</div>
              </button>
            </div>

            {/* Word Exports */}
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Word Documents</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <button
                onClick={() => eventConfig && exportSupplierScheduleToWord({
                  eventConfig, suppliers, buyers, meetings, timeSlots
                })}
                className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
              >
                <div className="text-2xl mb-2">📘</div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Supplier Schedules</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Word by supplier</div>
              </button>

              <button
                onClick={() => eventConfig && exportBuyerScheduleToWord({
                  eventConfig, suppliers, buyers, meetings, timeSlots
                })}
                className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
              >
                <div className="text-2xl mb-2">📘</div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Buyer Schedules</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Word by buyer</div>
              </button>

              <button
                onClick={() => eventConfig && exportMasterScheduleToWord({
                  eventConfig, suppliers, buyers, meetings, timeSlots
                })}
                className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
              >
                <div className="text-2xl mb-2">📘</div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Master Grid</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Word overview</div>
              </button>
            </div>

            {/* Excel Export */}
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Spreadsheet</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={exportExcel}
                className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
              >
                <div className="text-2xl mb-2">📗</div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Excel Export</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">All data in .xlsx</div>
              </button>
            </div>
          </>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Backup & Restore</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Export your entire configuration (suppliers, buyers, preferences, <strong>and schedule matrix</strong>) as a JSON
          file. Use this to transfer data between devices or keep a backup.
        </p>

        {/* Current state summary */}
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md text-sm">
          <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Current project contains:</p>
          <ul className="text-gray-600 dark:text-gray-400 space-y-0.5">
            <li>{suppliers.length} suppliers</li>
            <li>{buyers.length} buyers</li>
            <li className={hasSchedule ? 'text-green-600 dark:text-green-400 font-medium' : 'text-gray-500 dark:text-gray-500'}>
              {hasSchedule ? `${meetings.length} scheduled meetings (will be included in backup)` : 'No meetings generated yet'}
            </li>
          </ul>
        </div>

        <div className="flex gap-4 flex-wrap">
          <button
            onClick={handleExportJSON}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Export Backup (JSON)
          </button>

          <label className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer">
            Import Backup
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>
        </div>

        {!hasSchedule && (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
            Note: Generate a schedule first if you want to back up your meeting matrix.
          </p>
        )}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md p-4">
        <h3 className="font-medium text-blue-900 dark:text-blue-300 mb-2">Print Tip</h3>
        <p className="text-blue-800 dark:text-blue-400 text-sm">
          You can also print directly from the Schedule tab. Use your browser's print function
          (Ctrl+P / Cmd+P) - the navigation will be hidden automatically.
        </p>
      </div>

      <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-red-900 dark:text-red-300 mb-2">Reset All Data</h2>
        <p className="text-sm text-red-700 dark:text-red-400 mb-4">
          This will permanently delete all suppliers, buyers, preferences, and schedules.
          Consider exporting a backup first.
        </p>
        <button
          onClick={() => {
            if (window.confirm('Are you sure you want to delete ALL data? This cannot be undone.')) {
              resetAllData();
            }
          }}
          className="px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-md hover:bg-red-700 dark:hover:bg-red-600"
        >
          Reset All Data
        </button>
      </div>
    </div>
  );
}
