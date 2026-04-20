import { useState } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { formatTime, formatDateRange, formatDateReadable, formatDateFull, formatMonthYear, getUniqueDatesFromSlots } from '../utils/timeUtils';
import { registerWusataFonts, FONT_TITLE, FONT_BODY } from '../utils/wusataFonts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  exportSupplierScheduleToWord,
  exportBuyerScheduleToWord,
  exportMasterScheduleToWord,
} from '../utils/exportWord';
import { downloadSignInSheets } from '../utils/signInSheetWord';
import { loadWusataImages, loadWusataLogo } from '../utils/wusataAssets';

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

  const [exportError, setExportError] = useState<string | null>(null);
  const [wusataPanel, setWusataPanel] = useState<'supplier' | 'buyer' | null>(null);

  const getBuyer = (id: string) => buyers.find(b => b.id === id);
  const getSupplier = (id: string) => suppliers.find(s => s.id === id);
  const getSlot = (id: string) => timeSlots.find(s => s.id === id);

  const meetingSlots = (timeSlots || []).filter(s => !s.isBreak);
  const activeMeetings = (meetings || []).filter(m => m.status !== 'cancelled' && m.status !== 'bumped');
  const dates = getUniqueDatesFromSlots(timeSlots || []);
  const isMultiDay = dates.length > 1;

  let dateRangeStr = '';
  try {
    if (eventConfig?.startDate && eventConfig?.endDate) {
      dateRangeStr = formatDateRange(eventConfig.startDate, eventConfig.endDate);
    }
  } catch {
    dateRangeStr = '';
  }

  // Helper to add professional header to PDF
  const addPdfHeader = (doc: jsPDF, title: string): number => {
    // Blue header bar
    doc.setFillColor(28, 76, 55);
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
    setExportError(null);
    try {
    const doc = new jsPDF();

    suppliers.forEach((supplier, supplierIndex) => {
      if (supplierIndex > 0) {
        doc.addPage();
      }

      let y = addPdfHeader(doc, 'Schedule by Supplier');

      // Supplier name
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(supplier.companyName, 16, y);
      y += 5;

      // Contact info
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      const contactStr = `Contact: ${supplier.primaryContact.name}${supplier.primaryContact.email ? ` (${supplier.primaryContact.email})` : ''}`;
      doc.text(contactStr, 16, y);
      if (supplier.secondaryContact) {
        y += 5;
        doc.text(
          `Secondary: ${supplier.secondaryContact.name}${supplier.secondaryContact.email ? ` (${supplier.secondaryContact.email})` : ''}`,
          16,
          y
        );
      }
      y += 4;

      // Build table data
      const supplierMeetings = activeMeetings.filter(m => m.supplierId === supplier.id);
      const columns = isMultiDay
        ? [{ header: 'Date', dataKey: 'date' }, { header: 'Time', dataKey: 'time' }, { header: 'Buyer', dataKey: 'buyer' }, { header: 'Organization', dataKey: 'org' }]
        : [{ header: 'Time', dataKey: 'time' }, { header: 'Buyer', dataKey: 'buyer' }, { header: 'Organization', dataKey: 'org' }];

      const rows = meetingSlots.map(slot => {
        const meeting = supplierMeetings.find(m => m.timeSlotId === slot.id);
        const buyer = meeting ? getBuyer(meeting.buyerId) : null;
        return {
          date: formatDateReadable(slot.date).split(',')[0],
          time: safeFormatTime(slot.startTime),
          buyer: buyer?.name || '-',
          org: buyer?.organization || '-',
        };
      });

      autoTable(doc, {
        startY: y,
        columns,
        body: rows,
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [28, 76, 55], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [232, 241, 237] },
        margin: { left: 14, right: 14 },
      });
    });

    addPdfFooter(doc);
    doc.save('schedule-by-supplier.pdf');
    } catch (err) {
      console.error('Supplier PDF export failed:', err);
      setExportError(`Supplier PDF export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const exportBuyerPDF = () => {
    setExportError(null);
    try {
    const doc = new jsPDF();

    buyers.forEach((buyer, buyerIndex) => {
      if (buyerIndex > 0) {
        doc.addPage();
      }

      let y = addPdfHeader(doc, 'Schedule by Buyer');

      // Buyer name
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(`${buyer.name} (${buyer.organization})`, 16, y);
      y += 6;

      // Build table data
      const buyerMeetings = activeMeetings.filter(m => m.buyerId === buyer.id);
      const columns = isMultiDay
        ? [{ header: 'Date', dataKey: 'date' }, { header: 'Time', dataKey: 'time' }, { header: 'Supplier', dataKey: 'supplier' }, { header: 'Contact', dataKey: 'contact' }]
        : [{ header: 'Time', dataKey: 'time' }, { header: 'Supplier', dataKey: 'supplier' }, { header: 'Contact', dataKey: 'contact' }];

      const rows = meetingSlots.map(slot => {
        const meeting = buyerMeetings.find(m => m.timeSlotId === slot.id);
        const supplier = meeting ? getSupplier(meeting.supplierId) : null;
        return {
          date: formatDateReadable(slot.date).split(',')[0],
          time: safeFormatTime(slot.startTime),
          supplier: supplier?.companyName || '-',
          contact: supplier?.primaryContact.name || '-',
        };
      });

      autoTable(doc, {
        startY: y,
        columns,
        body: rows,
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [28, 76, 55], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [232, 241, 237] },
        margin: { left: 14, right: 14 },
      });
    });

    addPdfFooter(doc);
    doc.save('schedule-by-buyer.pdf');
    } catch (err) {
      console.error('Buyer PDF export failed:', err);
      setExportError(`Buyer PDF export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const exportMasterPDF = () => {
    setExportError(null);
    try {
    const doc = new jsPDF('landscape');

    // Professional header bar
    doc.setFillColor(28, 76, 55);
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
    y += 8;

    const maxColsPerPage = 7;

    // Process by day
    for (const date of dates) {
      const daySlots = meetingSlots.filter(s => s.date === date);

      // Filter to only suppliers with meetings on this day
      const daySuppliers = suppliers.filter(supplier =>
        daySlots.some(slot =>
          activeMeetings.some(m => m.supplierId === supplier.id && m.timeSlotId === slot.id)
        )
      );

      if (daySuppliers.length === 0) continue;

      // Split filtered suppliers into readable groups
      const supplierGroups: typeof suppliers[] = [];
      for (let i = 0; i < daySuppliers.length; i += maxColsPerPage) {
        supplierGroups.push(daySuppliers.slice(i, i + maxColsPerPage));
      }

      if (isMultiDay) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(formatDateReadable(date), 14, y);
        doc.setFont('helvetica', 'normal');
        y += 4;
      }

      // Render one table per supplier group
      for (let groupIdx = 0; groupIdx < supplierGroups.length; groupIdx++) {
        const group = supplierGroups[groupIdx];

        // Add page break between groups (except first)
        if (groupIdx > 0) {
          doc.addPage('landscape');
          y = 20;
          // Repeat day header on new page
          if (isMultiDay) {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(formatDateReadable(date), 14, y);
            doc.setFont('helvetica', 'normal');
            y += 4;
          }
          // Show group label
          doc.setFontSize(8);
          doc.setTextColor(107, 114, 128);
          doc.text(`Suppliers ${groupIdx * maxColsPerPage + 1}-${Math.min((groupIdx + 1) * maxColsPerPage, daySuppliers.length)} of ${daySuppliers.length}`, 14, y);
          doc.setTextColor(0, 0, 0);
          y += 4;
        }

        const columns = [
          { header: 'Time', dataKey: 'time' },
          ...group.map(s => ({ header: s.companyName, dataKey: s.id })),
        ];

        const rows = daySlots.map(slot => {
          const row: Record<string, string> = { time: safeFormatTime(slot.startTime) };
          group.forEach(supplier => {
            const meeting = activeMeetings.find(
              m => m.supplierId === supplier.id && m.timeSlotId === slot.id
            );
            const buyer = meeting ? getBuyer(meeting.buyerId) : null;
            row[supplier.id] = buyer?.name || '-';
          });
          return row;
        });

        autoTable(doc, {
          startY: y,
          columns,
          body: rows,
          styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
          headStyles: { fillColor: [28, 76, 55], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
          alternateRowStyles: { fillColor: [232, 241, 237] },
          columnStyles: { time: { cellWidth: 22, fontStyle: 'bold' } },
          margin: { left: 10, right: 10 },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        y = (doc as any).lastAutoTable?.finalY + 8 || y + 20;
      }
    }

    addPdfFooter(doc);
    doc.save('master-schedule.pdf');
    } catch (err) {
      console.error('Master PDF export failed:', err);
      setExportError(`Master PDF export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const exportWusataSupplierPDF = async (supplierId?: string) => {
    setExportError(null);
    try {
      const targetSuppliers = supplierId ? suppliers.filter(s => s.id === supplierId) : suppliers;
      if (targetSuppliers.length === 0) return;
      const [images, logoDataUrl] = await Promise.all([loadWusataImages(), loadWusataLogo()]);
      const doc = new jsPDF('portrait');
      await registerWusataFonts(doc);
      const pageW = doc.internal.pageSize.getWidth(); // 210mm
      const pageH = doc.internal.pageSize.getHeight(); // 297mm

      // Layout constants matching WUSATA template
      const photoColW = 63.5; // left photo column width in mm (from template)
      const contentX = photoColW + 6; // right content area start
      const contentW = pageW - contentX - 10; // right content area width
      const textColor: [number, number, number] = [70, 93, 118]; // #465D76
      const lineColor: [number, number, number] = [51, 51, 51]; // #333333

      // Photo slots matching template proportions with even spacing
      // Template ratios: 42.3, 76.9, 35.6, 73.0, 39.8 = 267.6mm total image height
      // Page height = 297mm. With 6mm top/bottom margin and 3mm gaps: 297 - 12 - 12 = 273mm usable
      const gap = 3;
      const topMargin = 6;
      const totalGaps = 4 * gap; // 4 gaps between 5 images
      const usableH = pageH - topMargin * 2 - totalGaps;
      const ratios = [42.3, 76.9, 35.6, 73.0, 39.8];
      const totalRatio = ratios.reduce((a, b) => a + b, 0);
      const heights = ratios.map(r => (r / totalRatio) * usableH);
      const srcOrder = [1, 2, 3, 4, 0]; // image2, image3, image4, image5, image1

      let slotY = topMargin;
      const photoSlots = heights.map((h, i) => {
        const slot = { y: slotY, h, srcIdx: srcOrder[i] };
        slotY += h + gap;
        return slot;
      });

      // Pre-render photos cropped to "cover" each slot at 300 DPI
      const dpi = 11.81; // px per mm at 300 DPI
      const croppedImagePromises = photoSlots.map(async (slot) => {
        const imgData = images[slot.srcIdx];
        if (!imgData) return null;

        const slotWpx = Math.round(photoColW * dpi);
        const slotHpx = Math.round(slot.h * dpi);
        const canvas = document.createElement('canvas');
        canvas.width = slotWpx;
        canvas.height = slotHpx;
        const ctx = canvas.getContext('2d')!;

        const htmlImg = new Image();
        htmlImg.src = imgData.dataUrl;
        await new Promise<void>((resolve) => { htmlImg.onload = () => resolve(); });

        // "Cover" logic: scale to fill, crop overflow from center
        const imgAspect = htmlImg.naturalWidth / htmlImg.naturalHeight;
        const slotAspect = slotWpx / slotHpx;
        let sx = 0, sy = 0, sw = htmlImg.naturalWidth, sh = htmlImg.naturalHeight;
        if (imgAspect > slotAspect) {
          sw = htmlImg.naturalHeight * slotAspect;
          sx = (htmlImg.naturalWidth - sw) / 2;
        } else {
          sh = htmlImg.naturalWidth / slotAspect;
          sy = (htmlImg.naturalHeight - sh) / 2;
        }
        ctx.drawImage(htmlImg, sx, sy, sw, sh, 0, 0, slotWpx, slotHpx);
        return canvas.toDataURL('image/jpeg', 0.95);
      });

      const croppedImages = (await Promise.all(croppedImagePromises)).filter((img): img is string => img !== null);

      targetSuppliers.forEach((supplier, supplierIndex) => {
        if (supplierIndex > 0) {
          doc.addPage();
        }

        const firstPageNum = doc.getNumberOfPages();

        // Draw left photo column — each photo in its template-matched slot
        photoSlots.forEach((slot, i) => {
          if (croppedImages[i]) {
            try {
              doc.addImage(croppedImages[i], 'JPEG', 0, slot.y, photoColW, slot.h);
            } catch {
              doc.setFillColor(200, 200, 200);
              doc.rect(0, slot.y, photoColW, slot.h, 'F');
            }
          }
        });

        // Right content area
        let y = 18;

        // WUSATA logo (rendered from SVG)
        try {
          const logoW = 38;
          const logoH = logoW * (152 / 211); // maintain SVG aspect ratio
          doc.addImage(logoDataUrl, 'PNG', pageW - logoW - 8, 6, logoW, logoH);
        } catch {
          // Fallback to text if logo fails
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(70, 93, 118);
          doc.text('WUSATA', pageW - 12, 12, { align: 'right' });
        }

        // Event name in script font
        doc.setFontSize(24);
        doc.setFont(FONT_TITLE, 'normal');
        doc.setTextColor(...textColor);
        const eventName = eventConfig?.name || 'Meeting Schedule';
        const nameLines = doc.splitTextToSize(eventName, contentW);
        doc.text(nameLines, contentX, y);
        y += nameLines.length * 10 + 6;

        // Month & Year
        if (eventConfig?.startDate) {
          doc.setFontSize(13);
          doc.setFont(FONT_BODY, 'normal');
          doc.text(formatMonthYear(eventConfig.startDate), contentX, y);
          y += 4;
        }

        // Supplier company name
        y += 4;
        doc.setFontSize(13);
        doc.setFont(FONT_BODY, 'bold');
        const supplierLines = doc.splitTextToSize(supplier.companyName, contentW);
        doc.text(supplierLines, contentX, y);
        y += supplierLines.length * 5.5 + 1;

        // Primary contact name
        if (supplier.primaryContact?.name) {
          doc.setFontSize(10);
          doc.setFont(FONT_BODY, 'normal');
          doc.text(supplier.primaryContact.name, contentX, y);
          y += 4;
        }

        // Secondary contact name
        if (supplier.secondaryContact?.name) {
          doc.setFontSize(10);
          doc.setFont(FONT_BODY, 'normal');
          doc.text(supplier.secondaryContact.name, contentX, y);
          y += 4;
        }

        // Horizontal divider
        y += 2;
        doc.setDrawColor(...lineColor);
        doc.setLineWidth(0.5);
        doc.line(contentX, y, pageW - 10, y);
        y += 6;

        // Get supplier's meetings
        const supplierMeetings = activeMeetings.filter(m => m.supplierId === supplier.id);

        // Group by day
        for (let dayIdx = 0; dayIdx < dates.length; dayIdx++) {
          const date = dates[dayIdx];
          const allDaySlots = (timeSlots || []).filter(s => s.date === date);
          const dayMeetingSlots = allDaySlots.filter(s => !s.isBreak);
          const dayMeetings = supplierMeetings.filter(m =>
            dayMeetingSlots.some(s => s.id === m.timeSlotId)
          );

          // Skip days with no meetings for this supplier
          if (dayMeetings.length === 0) continue;

          // Check if we need a new page (if less than 40mm remaining)
          if (y > pageH - 40) {
            doc.addPage();
            // Redraw photos on new page
            photoSlots.forEach((slot, i) => {
              if (croppedImages[i]) {
                try {
                  doc.addImage(croppedImages[i], 'JPEG', 0, slot.y, photoColW, slot.h);
                } catch {
                  doc.setFillColor(200, 200, 200);
                  doc.rect(0, slot.y, photoColW, slot.h, 'F');
                }
              }
            });
            y = 15;
          }

          // Day header — full date
          doc.setFontSize(10);
          doc.setFont(FONT_BODY, 'bold');
          doc.setTextColor(...textColor);
          const dayLabel = formatDateFull(date);
          doc.text(dayLabel, contentX, y);
          y += 7;

          // Meeting and break rows
          for (const slot of allDaySlots) {
            // Check page overflow
            if (y > pageH - 25) {
              doc.addPage();
              photoSlots.forEach((pSlot, i) => {
                if (croppedImages[i]) {
                  try {
                    doc.addImage(croppedImages[i], 'JPEG', 0, pSlot.y, photoColW, pSlot.h);
                  } catch {
                    doc.setFillColor(200, 200, 200);
                    doc.rect(0, pSlot.y, photoColW, pSlot.h, 'F');
                  }
                }
              });
              y = 15;
            }

            if (slot.isBreak) {
              // Break row with fill color
              const breakH = 7;
              doc.setFillColor(230, 235, 240);
              doc.roundedRect(contentX, y - 4, contentW, breakH, 1.5, 1.5, 'F');
              doc.setFontSize(9);
              doc.setFont(FONT_BODY, 'bold');
              doc.setTextColor(100, 110, 120);
              const breakLabel = slot.breakName || 'Break';
              const breakTime = `${safeFormatTime(slot.startTime)} - ${safeFormatTime(slot.endTime)}`;
              doc.text(breakLabel, contentX + 4, y);
              doc.text(breakTime, contentX + contentW - 4, y, { align: 'right' });
              doc.setTextColor(...textColor);
              y += breakH + 2;
              continue;
            }

            const meeting = dayMeetings.find(m => m.timeSlotId === slot.id);
            if (!meeting) continue;

            const buyer = getBuyer(meeting.buyerId);
            if (!buyer) continue;

            const timeStr = safeFormatTime(slot.startTime);
            doc.setFontSize(10);
            doc.setFont(FONT_BODY, 'normal');
            doc.setTextColor(...textColor);
            doc.text(timeStr, contentX + 4, y);
            doc.text(buyer.name, contentX + 28, y);
            y += 4.5;

            // Organization on second line in bold
            doc.setFontSize(9);
            doc.setFont(FONT_BODY, 'bold');
            doc.text(buyer.organization, contentX + 28, y);
            y += 5;

            y += 3; // spacing between meetings
          }

          y += 4; // spacing between days
        }

        // If no meetings at all, show message
        if (supplierMeetings.length === 0) {
          doc.setFontSize(11);
          doc.setFont(FONT_BODY, 'normal');
          doc.setTextColor(...textColor);
          doc.text('No meetings scheduled', contentX, y);
          y += 8;
        }

        // Bottom divider
        const bottomY = Math.max(y + 4, pageH - 20);
        doc.setDrawColor(...lineColor);
        doc.setLineWidth(0.5);
        doc.line(contentX, bottomY, pageW - 10, bottomY);

        // Footer
        doc.setFontSize(9);
        doc.setFont(FONT_BODY, 'normal');
        doc.setTextColor(...textColor);
        doc.text('wusata.org', contentX + contentW / 2, bottomY + 5, { align: 'center' });

        // Add "Continued on Next Page..." on the first page
        doc.setPage(firstPageNum);
        doc.setFontSize(9);
        doc.setFont(FONT_BODY, 'normal');
        doc.setTextColor(140, 140, 140);
        doc.text('Continued on Next Page...', contentX + contentW / 2, pageH - 8, { align: 'center' });
        doc.setPage(doc.getNumberOfPages());

        // Pad to even page count for duplex printing
        const supplierPages = doc.getNumberOfPages() - firstPageNum + 1;
        if (supplierPages % 2 !== 0) {
          doc.addPage();
          // Branded blank page — photos only
          photoSlots.forEach((slot, i) => {
            if (croppedImages[i]) {
              try {
                doc.addImage(croppedImages[i], 'JPEG', 0, slot.y, photoColW, slot.h);
              } catch {
                doc.setFillColor(200, 200, 200);
                doc.rect(0, slot.y, photoColW, slot.h, 'F');
              }
            }
          });
        }
      });

      const filename = supplierId
        ? `wusata-${targetSuppliers[0].companyName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.pdf`
        : 'wusata-supplier-schedules.pdf';
      doc.save(filename);
    } catch (err) {
      console.error('WUSATA PDF export failed:', err);
      setExportError(`WUSATA PDF export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const exportWusataBuyerPDF = async (buyerId?: string) => {
    setExportError(null);
    try {
      const targetBuyers = buyerId ? buyers.filter(b => b.id === buyerId) : buyers;
      if (targetBuyers.length === 0) return;
      const [images, logoDataUrl] = await Promise.all([loadWusataImages(), loadWusataLogo()]);
      const doc = new jsPDF('portrait');
      await registerWusataFonts(doc);
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      const photoColW = 63.5;
      const contentX = photoColW + 6;
      const contentW = pageW - contentX - 10;
      const textColor: [number, number, number] = [70, 93, 118];
      const lineColor: [number, number, number] = [51, 51, 51];

      const gap = 3;
      const topMargin = 6;
      const totalGaps = 4 * gap;
      const usableH = pageH - topMargin * 2 - totalGaps;
      const ratios = [42.3, 76.9, 35.6, 73.0, 39.8];
      const totalRatio = ratios.reduce((a, b) => a + b, 0);
      const heights = ratios.map(r => (r / totalRatio) * usableH);
      const srcOrder = [1, 2, 3, 4, 0];

      let slotY = topMargin;
      const photoSlots = heights.map((h, i) => {
        const slot = { y: slotY, h, srcIdx: srcOrder[i] };
        slotY += h + gap;
        return slot;
      });

      const dpi = 11.81;
      const croppedImagePromises = photoSlots.map(async (slot) => {
        const imgData = images[slot.srcIdx];
        if (!imgData) return null;
        const slotWpx = Math.round(photoColW * dpi);
        const slotHpx = Math.round(slot.h * dpi);
        const canvas = document.createElement('canvas');
        canvas.width = slotWpx;
        canvas.height = slotHpx;
        const ctx = canvas.getContext('2d')!;
        const htmlImg = new Image();
        htmlImg.src = imgData.dataUrl;
        await new Promise<void>((resolve) => { htmlImg.onload = () => resolve(); });
        const imgAspect = htmlImg.naturalWidth / htmlImg.naturalHeight;
        const slotAspect = slotWpx / slotHpx;
        let sx = 0, sy = 0, sw = htmlImg.naturalWidth, sh = htmlImg.naturalHeight;
        if (imgAspect > slotAspect) {
          sw = htmlImg.naturalHeight * slotAspect;
          sx = (htmlImg.naturalWidth - sw) / 2;
        } else {
          sh = htmlImg.naturalWidth / slotAspect;
          sy = (htmlImg.naturalHeight - sh) / 2;
        }
        ctx.drawImage(htmlImg, sx, sy, sw, sh, 0, 0, slotWpx, slotHpx);
        return canvas.toDataURL('image/jpeg', 0.95);
      });

      const croppedImages = (await Promise.all(croppedImagePromises)).filter((img): img is string => img !== null);

      const drawPhotos = (d: jsPDF) => {
        photoSlots.forEach((slot, i) => {
          if (croppedImages[i]) {
            try {
              d.addImage(croppedImages[i], 'JPEG', 0, slot.y, photoColW, slot.h);
            } catch {
              d.setFillColor(200, 200, 200);
              d.rect(0, slot.y, photoColW, slot.h, 'F');
            }
          }
        });
      };

      targetBuyers.forEach((buyer, buyerIndex) => {
        if (buyerIndex > 0) {
          doc.addPage();
        }

        const firstPageNum = doc.getNumberOfPages();

        drawPhotos(doc);

        let y = 18;

        // WUSATA logo
        try {
          const logoW = 38;
          const logoH = logoW * (152 / 211);
          doc.addImage(logoDataUrl, 'PNG', pageW - logoW - 8, 6, logoW, logoH);
        } catch {
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(70, 93, 118);
          doc.text('WUSATA', pageW - 12, 12, { align: 'right' });
        }

        // Event name in script font
        doc.setFontSize(24);
        doc.setFont(FONT_TITLE, 'normal');
        doc.setTextColor(...textColor);
        const eventName = eventConfig?.name || 'Meeting Schedule';
        const nameLines = doc.splitTextToSize(eventName, contentW);
        doc.text(nameLines, contentX, y);
        y += nameLines.length * 10 + 6;

        // Month & Year
        if (eventConfig?.startDate) {
          doc.setFontSize(13);
          doc.setFont(FONT_BODY, 'normal');
          doc.text(formatMonthYear(eventConfig.startDate), contentX, y);
          y += 4;
        }

        // Buyer name
        y += 4;
        doc.setFontSize(13);
        doc.setFont(FONT_BODY, 'bold');
        doc.text(buyer.name, contentX, y);
        y += 5.5;

        // Buyer organization
        if (buyer.organization) {
          doc.setFontSize(10);
          doc.setFont(FONT_BODY, 'normal');
          doc.text(buyer.organization, contentX, y);
          y += 4;
        }

        // Horizontal divider
        y += 2;
        doc.setDrawColor(...lineColor);
        doc.setLineWidth(0.5);
        doc.line(contentX, y, pageW - 10, y);
        y += 6;

        // Get buyer's meetings
        const buyerMeetings = activeMeetings.filter(m => m.buyerId === buyer.id);

        // Group by day
        for (let dayIdx = 0; dayIdx < dates.length; dayIdx++) {
          const date = dates[dayIdx];
          const allDaySlots = (timeSlots || []).filter(s => s.date === date);
          const dayMeetingSlots = allDaySlots.filter(s => !s.isBreak);
          const dayMeetings = buyerMeetings.filter(m =>
            dayMeetingSlots.some(s => s.id === m.timeSlotId)
          );

          if (dayMeetings.length === 0) continue;

          // Check if we need a new page
          if (y > pageH - 40) {
            doc.addPage();
            drawPhotos(doc);
            y = 15;
          }

          // Day header — full date
          doc.setFontSize(10);
          doc.setFont(FONT_BODY, 'bold');
          doc.setTextColor(...textColor);
          const dayLabel = formatDateFull(date);
          doc.text(dayLabel, contentX, y);
          y += 7;

          // Meeting and break rows
          for (const slot of allDaySlots) {
            // Check page overflow
            if (y > pageH - 25) {
              doc.addPage();
              drawPhotos(doc);
              y = 15;
            }

            if (slot.isBreak) {
              const breakH = 7;
              doc.setFillColor(230, 235, 240);
              doc.roundedRect(contentX, y - 4, contentW, breakH, 1.5, 1.5, 'F');
              doc.setFontSize(9);
              doc.setFont(FONT_BODY, 'bold');
              doc.setTextColor(100, 110, 120);
              const breakLabel = slot.breakName || 'Break';
              const breakTime = `${safeFormatTime(slot.startTime)} - ${safeFormatTime(slot.endTime)}`;
              doc.text(breakLabel, contentX + 4, y);
              doc.text(breakTime, contentX + contentW - 4, y, { align: 'right' });
              doc.setTextColor(...textColor);
              y += breakH + 2;
              continue;
            }

            const meeting = dayMeetings.find(m => m.timeSlotId === slot.id);
            if (!meeting) continue;

            const supplier = getSupplier(meeting.supplierId);
            if (!supplier) continue;

            const timeStr = safeFormatTime(slot.startTime);
            doc.setFontSize(10);
            doc.setFont(FONT_BODY, 'normal');
            doc.setTextColor(...textColor);
            doc.text(timeStr, contentX + 4, y);
            doc.text(supplier.companyName, contentX + 28, y);
            y += 4.5;

            // Contact name on second line in bold
            if (supplier.primaryContact?.name) {
              doc.setFontSize(9);
              doc.setFont(FONT_BODY, 'bold');
              doc.text(supplier.primaryContact.name, contentX + 28, y);
              y += 5;
            }

            y += 3;
          }

          y += 4;
        }

        // If no meetings at all
        if (buyerMeetings.length === 0) {
          doc.setFontSize(11);
          doc.setFont(FONT_BODY, 'normal');
          doc.setTextColor(...textColor);
          doc.text('No meetings scheduled', contentX, y);
          y += 8;
        }

        // Bottom divider
        const bottomY = Math.max(y + 4, pageH - 20);
        doc.setDrawColor(...lineColor);
        doc.setLineWidth(0.5);
        doc.line(contentX, bottomY, pageW - 10, bottomY);

        // Footer
        doc.setFontSize(9);
        doc.setFont(FONT_BODY, 'normal');
        doc.setTextColor(...textColor);
        doc.text('wusata.org', contentX + contentW / 2, bottomY + 5, { align: 'center' });

        // Add "Continued on Next Page..." on the first page
        doc.setPage(firstPageNum);
        doc.setFontSize(9);
        doc.setFont(FONT_BODY, 'normal');
        doc.setTextColor(140, 140, 140);
        doc.text('Continued on Next Page...', contentX + contentW / 2, pageH - 8, { align: 'center' });
        doc.setPage(doc.getNumberOfPages());

        // Pad to even page count for duplex printing
        const buyerPages = doc.getNumberOfPages() - firstPageNum + 1;
        if (buyerPages % 2 !== 0) {
          doc.addPage();
          drawPhotos(doc);
        }
      });

      const filename = buyerId
        ? `wusata-${targetBuyers[0].name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.pdf`
        : 'wusata-buyer-schedules.pdf';
      doc.save(filename);
    } catch (err) {
      console.error('WUSATA Buyer PDF export failed:', err);
      setExportError(`WUSATA Buyer PDF export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const exportExcel = () => {
    setExportError(null);
    try {
    const wb = XLSX.utils.book_new();

    // Master grid and By Supplier sheets — split by day, filter empty suppliers
    const excelMaxCols = 7;
    let gridSheetCount = 0;
    let supplierSheetCount = 0;

    for (const date of dates) {
      const daySlots = meetingSlots.filter(s => s.date === date);
      const dateLabel = isMultiDay ? formatDateReadable(date).split(',')[0] : '';

      // Filter to only suppliers with meetings on this day
      const daySuppliers = suppliers.filter(supplier =>
        daySlots.some(slot =>
          activeMeetings.some(m => m.supplierId === supplier.id && m.timeSlotId === slot.id)
        )
      );

      if (daySuppliers.length === 0) continue;

      // Split into groups
      const groups: typeof suppliers[] = [];
      for (let i = 0; i < daySuppliers.length; i += excelMaxCols) {
        groups.push(daySuppliers.slice(i, i + excelMaxCols));
      }

      // Master Grid sheets
      groups.forEach((group, groupIdx) => {
        gridSheetCount++;
        const sheetName = dates.length === 1 && groups.length === 1
          ? 'Master Grid'
          : `Grid${isMultiDay ? ' ' + dateLabel : ''}${groups.length > 1 ? ' ' + (groupIdx + 1) : ''}`.trim();

        const gridHeader = [
          [eventConfig?.name || 'Meeting Schedule'],
          [isMultiDay ? `${formatDateReadable(date)}` : dateRangeStr],
          [`Generated: ${new Date().toLocaleDateString()}`],
          [],
          ['Time', ...group.map(s => s.companyName)],
        ];
        const gridRows = daySlots.map(slot => [
          safeFormatTime(slot.startTime),
          ...group.map(supplier => {
            const meeting = activeMeetings.find(
              m => m.supplierId === supplier.id && m.timeSlotId === slot.id
            );
            return meeting ? getBuyer(meeting.buyerId)?.name || '' : '';
          }),
        ]);
        const gridSheet = XLSX.utils.aoa_to_sheet([...gridHeader, ...gridRows]);
        gridSheet['!cols'] = [
          { wch: 10 },
          ...group.map(s => ({ wch: Math.max(14, Math.min(28, s.companyName.length + 2)) })),
        ];
        gridSheet['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: group.length } },
          { s: { r: 1, c: 0 }, e: { r: 1, c: group.length } },
        ];
        XLSX.utils.book_append_sheet(wb, gridSheet, sheetName.substring(0, 31));
      });

      // By Supplier sheets
      groups.forEach((group, groupIdx) => {
        supplierSheetCount++;
        const sheetName = dates.length === 1 && groups.length === 1
          ? 'By Supplier'
          : `Supplier${isMultiDay ? ' ' + dateLabel : ''}${groups.length > 1 ? ' ' + (groupIdx + 1) : ''}`.trim();

        const supplierHeader = [
          [eventConfig?.name || 'Meeting Schedule'],
          ['Schedule by Supplier'],
          [],
          ['Time', ...group.map(s => s.companyName)],
        ];
        const supplierRows = daySlots.map(slot => [
          safeFormatTime(slot.startTime),
          ...group.map(supplier => {
            const meeting = activeMeetings.filter(m => m.supplierId === supplier.id)
              .find(m => m.timeSlotId === slot.id);
            return meeting ? getBuyer(meeting.buyerId)?.name || '' : '';
          }),
        ]);
        const supplierSheet = XLSX.utils.aoa_to_sheet([...supplierHeader, ...supplierRows]);
        supplierSheet['!cols'] = [
          { wch: 10 },
          ...group.map(s => ({ wch: Math.max(14, Math.min(28, s.companyName.length + 2)) })),
        ];
        XLSX.utils.book_append_sheet(wb, supplierSheet, sheetName.substring(0, 31));
      });
    }

    // By Buyer sheet with header
    const buyerHeader = [
      [eventConfig?.name || 'Meeting Schedule'],
      ['Schedule by Buyer'],
      [],
      [isMultiDay ? 'Date' : '', 'Time', ...buyers.map(b => b.name)].filter(Boolean),
    ];
    const buyerRows = meetingSlots.map(slot => {
      const row = [
        safeFormatTime(slot.startTime),
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
      ...buyers.map(b => ({ wch: Math.max(12, Math.min(25, b.name.length + 2)) })),
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
        Time: slot ? safeFormatTime(slot.startTime) : '',
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
    } catch (err) {
      console.error('Excel export failed:', err);
      setExportError(`Excel export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleExportJSON = () => {
    const json = exportToJSON();
    const parsed = JSON.parse(json);

    // Validate export completeness
    const exportInfo = {
      name: parsed.name ?? '(missing)',
      id: parsed.id ?? '(missing)',
      createdAt: parsed.createdAt ?? '(missing)',
      suppliersCount: parsed.suppliers?.length ?? 0,
      buyersCount: parsed.buyers?.length ?? 0,
      meetingsCount: parsed.meetings?.length ?? 0,
      timeSlotsCount: parsed.timeSlots?.length ?? 0,
      unscheduledPairsCount: parsed.unscheduledPairs?.length ?? 0,
      hasEventConfig: !!parsed.eventConfig,
    };
    console.log('[Export] Exporting project:', exportInfo);

    // Warn if critical data is missing
    const warnings: string[] = [];
    if (!parsed.id || !parsed.name || !parsed.createdAt) {
      warnings.push('Project metadata (id/name/date) is incomplete');
    }
    if (!parsed.eventConfig) {
      warnings.push('No event configuration found');
    }
    if (exportInfo.suppliersCount === 0) {
      warnings.push('No suppliers in export');
    }
    if (exportInfo.buyersCount === 0) {
      warnings.push('No buyers in export');
    }
    if (exportInfo.meetingsCount === 0 && exportInfo.timeSlotsCount > 0) {
      warnings.push('No meetings found — generate schedule before exporting if you want to include meetings');
    }

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${parsed.name || 'schedule'}-backup.json`;
    a.click();
    URL.revokeObjectURL(url);

    // Show export summary
    const summary = [
      `${exportInfo.suppliersCount} suppliers`,
      `${exportInfo.buyersCount} buyers`,
      `${exportInfo.meetingsCount} meetings`,
      `${exportInfo.timeSlotsCount} time slots`,
    ].join(', ');

    if (warnings.length > 0) {
      alert(`Backup exported with warnings:\n\n${summary}\n\nWarnings:\n- ${warnings.join('\n- ')}`);
    }
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const json = event.target?.result as string;
        const parsed = JSON.parse(json);

        // Validate required fields before import
        const missingFields: string[] = [];
        if (!parsed.id) missingFields.push('id');
        if (!parsed.name) missingFields.push('name');
        if (!parsed.createdAt) missingFields.push('createdAt');

        // Check if it's a legacy format (no id/name/createdAt but has suppliers/eventConfig)
        const isLegacyFormat = !parsed.id && (parsed.suppliers || parsed.eventConfig);

        if (missingFields.length > 0 && !isLegacyFormat) {
          alert(
            `Invalid backup file. Missing required fields: ${missingFields.join(', ')}\n\n` +
            'This file may not be a valid CDFA Hub backup. Please ensure you are importing a file exported from the "Export Backup (JSON)" button.'
          );
          return;
        }

        console.log('[Import] Pre-import validation:', {
          id: parsed.id,
          name: parsed.name,
          isLegacyFormat,
          suppliersCount: parsed.suppliers?.length ?? 0,
          buyersCount: parsed.buyers?.length ?? 0,
          meetingsCount: parsed.meetings?.length ?? 0,
          timeSlotsCount: parsed.timeSlots?.length ?? 0,
          unscheduledPairsCount: parsed.unscheduledPairs?.length ?? 0,
          hasEventConfig: !!parsed.eventConfig,
        });

        importFromJSON(json);

        // Provide detailed feedback
        const details = [
          `${parsed.suppliers?.length ?? 0} suppliers`,
          `${parsed.buyers?.length ?? 0} buyers`,
          `${parsed.meetings?.length ?? 0} meetings`,
          `${parsed.timeSlots?.length ?? 0} time slots`,
          parsed.eventConfig ? `event: ${parsed.eventConfig.name || parsed.name}` : 'no event config',
        ].join('\n- ');

        alert(
          `Data imported successfully!\n\n` +
          `Project "${parsed.name || 'Imported Project'}" is now active.\n\n` +
          `Imported:\n- ${details}`
        );
      } catch (err) {
        console.error('[Import] Failed:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        alert(
          `Failed to import data.\n\n` +
          `Error: ${message}\n\n` +
          'Please ensure you are importing a valid JSON backup file exported from CDFA Hub.'
        );
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const hasSchedule = meetings.length > 0;

  return (
    <div className="space-y-6">
      {exportError && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="flex justify-between items-start">
            <p className="text-sm text-red-700 dark:text-red-400">{exportError}</p>
            <button
              onClick={() => setExportError(null)}
              className="text-red-500 hover:text-red-700 dark:hover:text-red-300 ml-4"
            >
              &times;
            </button>
          </div>
        </div>
      )}

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

            {/* WUSATA Branded */}
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">WUSATA Branded</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <button
                onClick={() => setWusataPanel(wusataPanel === 'supplier' ? null : 'supplier')}
                className={`p-4 border-2 border-dashed rounded-lg transition-colors ${
                  wusataPanel === 'supplier'
                    ? 'border-amber-500 dark:border-amber-400 bg-amber-50 dark:bg-amber-900/30'
                    : 'border-gray-300 dark:border-gray-600 hover:border-amber-500 dark:hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30'
                }`}
              >
                <div className="text-2xl mb-2">🌾</div>
                <div className="font-medium text-gray-900 dark:text-gray-100">WUSATA Supplier Schedules</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">PDF by supplier (branded)</div>
              </button>

              <button
                onClick={() => setWusataPanel(wusataPanel === 'buyer' ? null : 'buyer')}
                className={`p-4 border-2 border-dashed rounded-lg transition-colors ${
                  wusataPanel === 'buyer'
                    ? 'border-amber-500 dark:border-amber-400 bg-amber-50 dark:bg-amber-900/30'
                    : 'border-gray-300 dark:border-gray-600 hover:border-amber-500 dark:hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30'
                }`}
              >
                <div className="text-2xl mb-2">🌾</div>
                <div className="font-medium text-gray-900 dark:text-gray-100">WUSATA Buyer Schedules</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">PDF by buyer (branded)</div>
              </button>
            </div>

            {wusataPanel && (
              <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium text-amber-900 dark:text-amber-200">
                    Download {wusataPanel === 'supplier' ? 'Supplier' : 'Buyer'} Schedules
                  </h4>
                  <button
                    onClick={() => setWusataPanel(null)}
                    className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200"
                  >
                    &times;
                  </button>
                </div>
                <div className="space-y-1">
                  <button
                    onClick={async () => {
                      if (wusataPanel === 'supplier') await exportWusataSupplierPDF();
                      else await exportWusataBuyerPDF();
                      setWusataPanel(null);
                    }}
                    className="w-full text-left px-3 py-2 rounded-md bg-amber-100 dark:bg-amber-800/40 hover:bg-amber-200 dark:hover:bg-amber-800/60 text-amber-900 dark:text-amber-100 text-sm font-medium transition-colors"
                  >
                    All {wusataPanel === 'supplier' ? 'Suppliers' : 'Buyers'} (combined PDF)
                  </button>
                  <div className="border-t border-amber-200 dark:border-amber-700 my-2" />
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {(wusataPanel === 'supplier' ? suppliers : buyers).map(item => {
                      const name = wusataPanel === 'supplier' ? (item as typeof suppliers[0]).companyName : (item as typeof buyers[0]).name;
                      const id = item.id;
                      return (
                        <button
                          key={id}
                          onClick={async () => {
                            if (wusataPanel === 'supplier') await exportWusataSupplierPDF(id);
                            else await exportWusataBuyerPDF(id);
                          }}
                          className="w-full text-left px-3 py-1.5 rounded-md hover:bg-amber-100 dark:hover:bg-amber-800/40 text-gray-800 dark:text-gray-200 text-sm transition-colors"
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Word Exports */}
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Word Documents</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <button
                onClick={async () => {
                  if (!eventConfig) return;
                  setExportError(null);
                  try {
                    await exportSupplierScheduleToWord({ eventConfig, suppliers, buyers, meetings, timeSlots });
                  } catch (err) {
                    console.error('Supplier Word export failed:', err);
                    setExportError(`Word export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
                  }
                }}
                className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
              >
                <div className="text-2xl mb-2">📘</div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Supplier Schedules</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Word by supplier</div>
              </button>

              <button
                onClick={async () => {
                  if (!eventConfig) return;
                  setExportError(null);
                  try {
                    await exportBuyerScheduleToWord({ eventConfig, suppliers, buyers, meetings, timeSlots });
                  } catch (err) {
                    console.error('Buyer Word export failed:', err);
                    setExportError(`Word export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
                  }
                }}
                className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
              >
                <div className="text-2xl mb-2">📘</div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Buyer Schedules</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Word by buyer</div>
              </button>

              <button
                onClick={async () => {
                  if (!eventConfig) return;
                  setExportError(null);
                  try {
                    await exportMasterScheduleToWord({ eventConfig, suppliers, buyers, meetings, timeSlots });
                  } catch (err) {
                    console.error('Master Word export failed:', err);
                    setExportError(`Word export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
                  }
                }}
                className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
              >
                <div className="text-2xl mb-2">📘</div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Master Grid</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Word overview</div>
              </button>

              <button
                onClick={async () => {
                  if (!eventConfig) return;
                  setExportError(null);
                  try {
                    await downloadSignInSheets(suppliers, eventConfig);
                  } catch (err) {
                    console.error('Sign-in sheet export failed:', err);
                    setExportError(`Sign-in sheet export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
                  }
                }}
                className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
              >
                <div className="text-2xl mb-2">📋</div>
                <div className="font-medium text-gray-900 dark:text-gray-100">Sign-In Sheets</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Per-day supplier check-in</div>
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
