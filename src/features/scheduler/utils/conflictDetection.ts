import type { Meeting, Supplier, Buyer, TimeSlot } from '../types';
import { canSupplierMeetBuyer } from './scheduler';

export interface ConflictInfo {
  type: 'supplier_busy' | 'buyer_busy' | 'preference_violation';
  severity: 'error' | 'warning';
  description: string;
  affectedMeetingId?: string;
  affectedPartyName: string;
}

export interface ConflictCheckResult {
  hasConflicts: boolean;
  conflicts: ConflictInfo[];
  hasErrors: boolean;  // Hard errors that must block
  hasWarnings: boolean; // Warnings that allow proceed
}

/**
 * Check if a buyer is available at a specific time slot
 */
export function isBuyerAvailableAtSlot(
  buyerId: string,
  slotId: string,
  meetings: Meeting[],
  excludeMeetingId?: string
): boolean {
  return !meetings.some(
    m =>
      m.buyerId === buyerId &&
      m.timeSlotId === slotId &&
      m.status !== 'cancelled' &&
      m.status !== 'bumped' &&
      m.id !== excludeMeetingId
  );
}

/**
 * Check if a supplier is available at a specific time slot
 */
export function isSupplierAvailableAtSlot(
  supplierId: string,
  slotId: string,
  meetings: Meeting[],
  excludeMeetingId?: string
): boolean {
  return !meetings.some(
    m =>
      m.supplierId === supplierId &&
      m.timeSlotId === slotId &&
      m.status !== 'cancelled' &&
      m.status !== 'bumped' &&
      m.id !== excludeMeetingId
  );
}

/**
 * Check if a meeting violates a supplier's preference
 */
export function checkPreferenceViolation(
  supplier: Supplier,
  buyerId: string
): boolean {
  return !canSupplierMeetBuyer(supplier, buyerId);
}

/**
 * Get the meeting that conflicts with a buyer at a specific slot
 */
export function getConflictingBuyerMeeting(
  buyerId: string,
  slotId: string,
  meetings: Meeting[],
  excludeMeetingId?: string
): Meeting | undefined {
  return meetings.find(
    m =>
      m.buyerId === buyerId &&
      m.timeSlotId === slotId &&
      m.status !== 'cancelled' &&
      m.status !== 'bumped' &&
      m.id !== excludeMeetingId
  );
}

/**
 * Get the meeting that conflicts with a supplier at a specific slot
 */
export function getConflictingSupplierMeeting(
  supplierId: string,
  slotId: string,
  meetings: Meeting[],
  excludeMeetingId?: string
): Meeting | undefined {
  return meetings.find(
    m =>
      m.supplierId === supplierId &&
      m.timeSlotId === slotId &&
      m.status !== 'cancelled' &&
      m.status !== 'bumped' &&
      m.id !== excludeMeetingId
  );
}

/**
 * Check all conflicts for moving a meeting to a new slot
 */
export function checkMoveConflicts(
  meeting: Meeting,
  targetSlotId: string,
  meetings: Meeting[],
  suppliers: Supplier[],
  buyers: Buyer[]
): ConflictCheckResult {
  const conflicts: ConflictInfo[] = [];

  const supplier = suppliers.find(s => s.id === meeting.supplierId);
  const buyer = buyers.find(b => b.id === meeting.buyerId);

  if (!supplier || !buyer) {
    return { hasConflicts: false, conflicts: [], hasErrors: false, hasWarnings: false };
  }

  // Check if supplier is busy at target slot (excluding the meeting being moved)
  const supplierConflictMeeting = getConflictingSupplierMeeting(
    meeting.supplierId,
    targetSlotId,
    meetings,
    meeting.id
  );

  if (supplierConflictMeeting) {
    const conflictingBuyer = buyers.find(b => b.id === supplierConflictMeeting.buyerId);
    conflicts.push({
      type: 'supplier_busy',
      severity: 'error',
      description: `${supplier.companyName} already has a meeting at this time with ${conflictingBuyer?.name || 'another buyer'}`,
      affectedMeetingId: supplierConflictMeeting.id,
      affectedPartyName: supplier.companyName,
    });
  }

  // Check if buyer is busy at target slot (excluding the meeting being moved)
  const buyerConflictMeeting = getConflictingBuyerMeeting(
    meeting.buyerId,
    targetSlotId,
    meetings,
    meeting.id
  );

  if (buyerConflictMeeting) {
    const conflictingSupplier = suppliers.find(s => s.id === buyerConflictMeeting.supplierId);
    conflicts.push({
      type: 'buyer_busy',
      severity: 'warning',
      description: `${buyer.name} already has a meeting at this time with ${conflictingSupplier?.companyName || 'another supplier'}`,
      affectedMeetingId: buyerConflictMeeting.id,
      affectedPartyName: buyer.name,
    });
  }

  const hasErrors = conflicts.some(c => c.severity === 'error');
  const hasWarnings = conflicts.some(c => c.severity === 'warning');

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    hasErrors,
    hasWarnings,
  };
}

/**
 * Check all conflicts for adding a new meeting
 */
export function checkAddMeetingConflicts(
  supplierId: string,
  buyerId: string,
  slotId: string,
  meetings: Meeting[],
  suppliers: Supplier[],
  buyers: Buyer[]
): ConflictCheckResult {
  const conflicts: ConflictInfo[] = [];

  const supplier = suppliers.find(s => s.id === supplierId);
  const buyer = buyers.find(b => b.id === buyerId);

  if (!supplier || !buyer) {
    return { hasConflicts: false, conflicts: [], hasErrors: false, hasWarnings: false };
  }

  // Check supplier availability
  const supplierConflictMeeting = getConflictingSupplierMeeting(supplierId, slotId, meetings);
  if (supplierConflictMeeting) {
    const conflictingBuyer = buyers.find(b => b.id === supplierConflictMeeting.buyerId);
    conflicts.push({
      type: 'supplier_busy',
      severity: 'error',
      description: `${supplier.companyName} already has a meeting at this time with ${conflictingBuyer?.name || 'another buyer'}`,
      affectedMeetingId: supplierConflictMeeting.id,
      affectedPartyName: supplier.companyName,
    });
  }

  // Check buyer availability
  const buyerConflictMeeting = getConflictingBuyerMeeting(buyerId, slotId, meetings);
  if (buyerConflictMeeting) {
    const conflictingSupplier = suppliers.find(s => s.id === buyerConflictMeeting.supplierId);
    conflicts.push({
      type: 'buyer_busy',
      severity: 'warning',
      description: `${buyer.name} already has a meeting at this time with ${conflictingSupplier?.companyName || 'another supplier'}`,
      affectedMeetingId: buyerConflictMeeting.id,
      affectedPartyName: buyer.name,
    });
  }

  // Check preference violation
  if (checkPreferenceViolation(supplier, buyerId)) {
    conflicts.push({
      type: 'preference_violation',
      severity: 'warning',
      description: `This meeting violates ${supplier.companyName}'s preference settings for ${buyer.name}`,
      affectedPartyName: supplier.companyName,
    });
  }

  const hasErrors = conflicts.some(c => c.severity === 'error');
  const hasWarnings = conflicts.some(c => c.severity === 'warning');

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    hasErrors,
    hasWarnings,
  };
}

/**
 * Get all conflicts for a specific meeting
 */
export function getConflictsForMeeting(
  meeting: Meeting,
  meetings: Meeting[],
  suppliers: Supplier[],
  buyers: Buyer[]
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];

  const supplier = suppliers.find(s => s.id === meeting.supplierId);
  const buyer = buyers.find(b => b.id === meeting.buyerId);

  if (!supplier || !buyer || meeting.status === 'cancelled' || meeting.status === 'bumped') {
    return conflicts;
  }

  // Check if buyer is double-booked at this slot
  const buyerConflicts = meetings.filter(
    m =>
      m.id !== meeting.id &&
      m.buyerId === meeting.buyerId &&
      m.timeSlotId === meeting.timeSlotId &&
      m.status !== 'cancelled' &&
      m.status !== 'bumped'
  );

  for (const conflictMeeting of buyerConflicts) {
    const conflictingSupplier = suppliers.find(s => s.id === conflictMeeting.supplierId);
    conflicts.push({
      type: 'buyer_busy',
      severity: 'warning',
      description: `${buyer.name} is double-booked - also meeting with ${conflictingSupplier?.companyName || 'another supplier'}`,
      affectedMeetingId: conflictMeeting.id,
      affectedPartyName: buyer.name,
    });
  }

  // Check preference violation
  if (checkPreferenceViolation(supplier, meeting.buyerId)) {
    conflicts.push({
      type: 'preference_violation',
      severity: 'warning',
      description: `Violates ${supplier.companyName}'s preference settings`,
      affectedPartyName: supplier.companyName,
    });
  }

  return conflicts;
}

/**
 * Get all meetings that have conflicts in the schedule
 */
export function getMeetingsWithConflicts(
  meetings: Meeting[],
  suppliers: Supplier[],
  buyers: Buyer[]
): Map<string, ConflictInfo[]> {
  const conflictMap = new Map<string, ConflictInfo[]>();

  for (const meeting of meetings) {
    if (meeting.status === 'cancelled' || meeting.status === 'bumped') {
      continue;
    }

    const conflicts = getConflictsForMeeting(meeting, meetings, suppliers, buyers);
    if (conflicts.length > 0) {
      conflictMap.set(meeting.id, conflicts);
    }
  }

  return conflictMap;
}

/**
 * Get a summary of all conflicts in the schedule
 */
export function getScheduleConflictsSummary(
  meetings: Meeting[],
  suppliers: Supplier[],
  buyers: Buyer[],
  timeSlots: TimeSlot[]
): {
  buyerDoubleBookings: Array<{
    buyerId: string;
    buyerName: string;
    slotId: string;
    slotTime: string;
    meetingIds: string[];
    supplierNames: string[];
  }>;
  preferenceViolations: Array<{
    meetingId: string;
    supplierId: string;
    supplierName: string;
    buyerId: string;
    buyerName: string;
  }>;
  totalConflicts: number;
} {
  const buyerDoubleBookings: Array<{
    buyerId: string;
    buyerName: string;
    slotId: string;
    slotTime: string;
    meetingIds: string[];
    supplierNames: string[];
  }> = [];

  const preferenceViolations: Array<{
    meetingId: string;
    supplierId: string;
    supplierName: string;
    buyerId: string;
    buyerName: string;
  }> = [];

  // Build a map of buyer -> slot -> meetings
  const buyerSlotMap = new Map<string, Map<string, Meeting[]>>();

  for (const meeting of meetings) {
    if (meeting.status === 'cancelled' || meeting.status === 'bumped') {
      continue;
    }

    // Check for preference violations
    const supplier = suppliers.find(s => s.id === meeting.supplierId);
    const buyer = buyers.find(b => b.id === meeting.buyerId);

    if (supplier && buyer && checkPreferenceViolation(supplier, meeting.buyerId)) {
      preferenceViolations.push({
        meetingId: meeting.id,
        supplierId: supplier.id,
        supplierName: supplier.companyName,
        buyerId: buyer.id,
        buyerName: buyer.name,
      });
    }

    // Track buyer meetings per slot
    if (!buyerSlotMap.has(meeting.buyerId)) {
      buyerSlotMap.set(meeting.buyerId, new Map());
    }
    const slotMap = buyerSlotMap.get(meeting.buyerId)!;
    if (!slotMap.has(meeting.timeSlotId)) {
      slotMap.set(meeting.timeSlotId, []);
    }
    slotMap.get(meeting.timeSlotId)!.push(meeting);
  }

  // Find buyer double bookings
  for (const [buyerId, slotMap] of buyerSlotMap) {
    const buyer = buyers.find(b => b.id === buyerId);
    if (!buyer) continue;

    for (const [slotId, slotMeetings] of slotMap) {
      if (slotMeetings.length > 1) {
        const slot = timeSlots.find(s => s.id === slotId);
        const supplierNames = slotMeetings.map(m => {
          const supplier = suppliers.find(s => s.id === m.supplierId);
          return supplier?.companyName || 'Unknown';
        });

        buyerDoubleBookings.push({
          buyerId,
          buyerName: buyer.name,
          slotId,
          slotTime: slot ? slot.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unknown',
          meetingIds: slotMeetings.map(m => m.id),
          supplierNames,
        });
      }
    }
  }

  return {
    buyerDoubleBookings,
    preferenceViolations,
    totalConflicts: buyerDoubleBookings.length + preferenceViolations.length,
  };
}

/**
 * Get buyer availability status for a specific slot
 */
export function getBuyerAvailabilityForSlot(
  buyerId: string,
  supplierId: string,
  slotId: string,
  meetings: Meeting[],
  suppliers: Supplier[],
  buyers: Buyer[]
): {
  available: boolean;
  conflictType: 'none' | 'busy' | 'preference';
  conflictDescription?: string;
} {
  const supplier = suppliers.find(s => s.id === supplierId);
  const buyer = buyers.find(b => b.id === buyerId);

  if (!supplier || !buyer) {
    return { available: false, conflictType: 'busy', conflictDescription: 'Invalid supplier or buyer' };
  }

  // Check if buyer is busy
  const isBusy = !isBuyerAvailableAtSlot(buyerId, slotId, meetings);
  if (isBusy) {
    const conflictMeeting = getConflictingBuyerMeeting(buyerId, slotId, meetings);
    const conflictingSupplier = conflictMeeting
      ? suppliers.find(s => s.id === conflictMeeting.supplierId)
      : null;
    return {
      available: false,
      conflictType: 'busy',
      conflictDescription: `Already meeting with ${conflictingSupplier?.companyName || 'another supplier'}`,
    };
  }

  // Check preference violation
  if (checkPreferenceViolation(supplier, buyerId)) {
    return {
      available: true, // Still available, just violates preference
      conflictType: 'preference',
      conflictDescription: `Violates ${supplier.companyName}'s preferences`,
    };
  }

  return { available: true, conflictType: 'none' };
}
