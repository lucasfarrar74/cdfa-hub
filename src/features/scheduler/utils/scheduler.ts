import type { Supplier, Buyer, Meeting, TimeSlot, EventConfig } from '../types';
import { generateId, generateTimeSlots, getDateRange } from './timeUtils';

interface ScheduleResult {
  meetings: Meeting[];
  timeSlots: TimeSlot[];
  unscheduledPairs: Array<{ supplierId: string; buyerId: string }>;
}

export function canSupplierMeetBuyer(supplier: Supplier, buyerId: string): boolean {
  switch (supplier.preference) {
    case 'all':
      return true;
    case 'include':
      return supplier.preferenceList.includes(buyerId);
    case 'exclude':
      return !supplier.preferenceList.includes(buyerId);
    default:
      return true;
  }
}

/**
 * Build list of desired meetings based on supplier preferences
 */
function buildDesiredMeetings(
  suppliers: Supplier[],
  buyers: Buyer[]
): Array<{ supplierId: string; buyerId: string; priority: number }> {
  const desiredMeetings: Array<{ supplierId: string; buyerId: string; priority: number }> = [];

  suppliers.forEach(supplier => {
    buyers.forEach(buyer => {
      if (canSupplierMeetBuyer(supplier, buyer.id)) {
        // Priority: include list gets highest priority, then all, then exclude (by count)
        let priority = 1;
        if (supplier.preference === 'include') {
          priority = 3; // Highest - explicitly requested
        } else if (supplier.preference === 'all') {
          priority = 2;
        } else {
          priority = 1; // Exclude list (meeting everyone except some)
        }
        desiredMeetings.push({ supplierId: supplier.id, buyerId: buyer.id, priority });
      }
    });
  });

  // Sort by priority (highest first) then shuffle within same priority for fairness
  desiredMeetings.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return Math.random() - 0.5;
  });

  return desiredMeetings;
}

/**
 * Efficient scheduling: pack meetings at the start (greedy first-available)
 */
function generateEfficientSchedule(
  timeSlots: TimeSlot[],
  suppliers: Supplier[],
  buyers: Buyer[]
): { meetings: Meeting[]; unscheduledPairs: Array<{ supplierId: string; buyerId: string }> } {
  const meetings: Meeting[] = [];
  const unscheduledPairs: Array<{ supplierId: string; buyerId: string }> = [];

  // Get non-break slots only
  const meetingSlots = timeSlots.filter(slot => !slot.isBreak);

  // Track which slots are taken for each supplier and buyer
  const supplierSlots: Map<string, Set<string>> = new Map();
  const buyerSlots: Map<string, Set<string>> = new Map();

  suppliers.forEach(s => supplierSlots.set(s.id, new Set()));
  buyers.forEach(b => buyerSlots.set(b.id, new Set()));

  const desiredMeetings = buildDesiredMeetings(suppliers, buyers);

  // Assign meetings to slots (greedy - first available)
  for (const desired of desiredMeetings) {
    const supplierUsed = supplierSlots.get(desired.supplierId)!;
    const buyerUsed = buyerSlots.get(desired.buyerId)!;

    // Find first available slot where both are free
    const availableSlot = meetingSlots.find(slot =>
      !supplierUsed.has(slot.id) && !buyerUsed.has(slot.id)
    );

    if (availableSlot) {
      meetings.push({
        id: generateId(),
        supplierId: desired.supplierId,
        buyerId: desired.buyerId,
        timeSlotId: availableSlot.id,
        status: 'scheduled',
      });
      supplierUsed.add(availableSlot.id);
      buyerUsed.add(availableSlot.id);
    } else {
      unscheduledPairs.push({
        supplierId: desired.supplierId,
        buyerId: desired.buyerId,
      });
    }
  }

  return { meetings, unscheduledPairs };
}

/**
 * Spaced scheduling: distribute meetings evenly across all days
 * Within each day, meetings can be clustered (greedy)
 */
function generateSpacedSchedule(
  config: EventConfig,
  timeSlots: TimeSlot[],
  suppliers: Supplier[],
  buyers: Buyer[]
): { meetings: Meeting[]; unscheduledPairs: Array<{ supplierId: string; buyerId: string }> } {
  const meetings: Meeting[] = [];
  const unscheduledPairs: Array<{ supplierId: string; buyerId: string }> = [];

  // Get all dates in the event
  const dates = getDateRange(config.startDate, config.endDate);
  const numDays = dates.length;

  // Get non-break slots grouped by date
  const slotsByDate: Map<string, TimeSlot[]> = new Map();
  for (const date of dates) {
    slotsByDate.set(date, timeSlots.filter(s => s.date === date && !s.isBreak));
  }

  // Track which slots are taken for each supplier and buyer
  const supplierSlots: Map<string, Set<string>> = new Map();
  const buyerSlots: Map<string, Set<string>> = new Map();

  suppliers.forEach(s => supplierSlots.set(s.id, new Set()));
  buyers.forEach(b => buyerSlots.set(b.id, new Set()));

  // Track how many meetings each supplier has per day
  const supplierMeetingsPerDay: Map<string, Map<string, number>> = new Map();
  suppliers.forEach(s => {
    const dayMap = new Map<string, number>();
    dates.forEach(d => dayMap.set(d, 0));
    supplierMeetingsPerDay.set(s.id, dayMap);
  });

  const desiredMeetings = buildDesiredMeetings(suppliers, buyers);

  // Calculate target meetings per day for each supplier
  const supplierTotalMeetings: Map<string, number> = new Map();
  for (const supplier of suppliers) {
    const total = desiredMeetings.filter(d => d.supplierId === supplier.id).length;
    supplierTotalMeetings.set(supplier.id, total);
  }

  // Assign meetings, distributing across days
  for (const desired of desiredMeetings) {
    const supplierUsed = supplierSlots.get(desired.supplierId)!;
    const buyerUsed = buyerSlots.get(desired.buyerId)!;
    const supplierDayCount = supplierMeetingsPerDay.get(desired.supplierId)!;

    const totalForSupplier = supplierTotalMeetings.get(desired.supplierId)!;
    const targetPerDay = Math.ceil(totalForSupplier / numDays);

    // Find the day with fewest meetings for this supplier that has available slots
    let bestSlot: TimeSlot | null = null;
    let bestDayCount = Infinity;

    for (const date of dates) {
      const currentDayCount = supplierDayCount.get(date)!;

      // Skip this day if it's already at or above target (unless no better option)
      if (currentDayCount >= targetPerDay && bestSlot !== null) {
        continue;
      }

      const daySlots = slotsByDate.get(date)!;

      // Find first available slot on this day
      const availableSlot = daySlots.find(slot =>
        !supplierUsed.has(slot.id) && !buyerUsed.has(slot.id)
      );

      if (availableSlot && currentDayCount < bestDayCount) {
        bestSlot = availableSlot;
        bestDayCount = currentDayCount;
      }
    }

    if (bestSlot) {
      meetings.push({
        id: generateId(),
        supplierId: desired.supplierId,
        buyerId: desired.buyerId,
        timeSlotId: bestSlot.id,
        status: 'scheduled',
      });
      supplierUsed.add(bestSlot.id);
      buyerUsed.add(bestSlot.id);
      supplierDayCount.set(bestSlot.date, supplierDayCount.get(bestSlot.date)! + 1);
    } else {
      unscheduledPairs.push({
        supplierId: desired.supplierId,
        buyerId: desired.buyerId,
      });
    }
  }

  return { meetings, unscheduledPairs };
}

export function generateSchedule(
  config: EventConfig,
  suppliers: Supplier[],
  buyers: Buyer[]
): ScheduleResult {
  const timeSlots = generateTimeSlots(config);

  const { meetings, unscheduledPairs } = config.schedulingStrategy === 'spaced'
    ? generateSpacedSchedule(config, timeSlots, suppliers, buyers)
    : generateEfficientSchedule(timeSlots, suppliers, buyers);

  return { meetings, timeSlots, unscheduledPairs };
}

export function findAvailableSlotForMeeting(
  supplierId: string,
  buyerId: string,
  timeSlots: TimeSlot[],
  existingMeetings: Meeting[],
  excludeSlotId?: string
): TimeSlot | null {
  const meetingSlots = timeSlots.filter(slot => !slot.isBreak);

  for (const slot of meetingSlots) {
    if (slot.id === excludeSlotId) continue;

    const slotMeetings = existingMeetings.filter(m => m.timeSlotId === slot.id && m.status !== 'cancelled');
    const supplierBusy = slotMeetings.some(m => m.supplierId === supplierId);
    const buyerBusy = slotMeetings.some(m => m.buyerId === buyerId);

    if (!supplierBusy && !buyerBusy) {
      return slot;
    }
  }

  return null;
}

/**
 * Find the next available slot after a specific slot where both supplier and buyer are free
 */
export function findNextAvailableSlotAfter(
  meeting: Meeting,
  timeSlots: TimeSlot[],
  meetings: Meeting[],
  afterSlotId: string
): TimeSlot | null {
  const meetingSlots = timeSlots.filter(slot => !slot.isBreak);

  // Find the index of the "after" slot
  const afterSlotIndex = meetingSlots.findIndex(slot => slot.id === afterSlotId);
  if (afterSlotIndex === -1) return null;

  // Only consider slots after the specified one
  const laterSlots = meetingSlots.slice(afterSlotIndex + 1);

  for (const slot of laterSlots) {
    const slotMeetings = meetings.filter(
      m => m.timeSlotId === slot.id &&
           m.status !== 'cancelled' &&
           m.status !== 'bumped'
    );

    const supplierBusy = slotMeetings.some(m => m.supplierId === meeting.supplierId);
    const buyerBusy = slotMeetings.some(m => m.buyerId === meeting.buyerId);

    if (!supplierBusy && !buyerBusy) {
      return slot;
    }
  }

  return null;
}

/**
 * Bump a meeting to a later slot
 * Returns the updated meetings array and info about what happened
 */
export function bumpMeetingToLaterSlot(
  meetingId: string,
  meetings: Meeting[],
  timeSlots: TimeSlot[]
): {
  updatedMeetings: Meeting[];
  success: boolean;
  newSlotId?: string;
  message: string;
} {
  const meeting = meetings.find(m => m.id === meetingId);
  if (!meeting) {
    return { updatedMeetings: meetings, success: false, message: 'Meeting not found' };
  }

  if (meeting.status === 'cancelled' || meeting.status === 'bumped') {
    return { updatedMeetings: meetings, success: false, message: 'Cannot bump cancelled or already bumped meeting' };
  }

  // Find the next available slot
  const nextSlot = findNextAvailableSlotAfter(meeting, timeSlots, meetings, meeting.timeSlotId);

  if (!nextSlot) {
    return {
      updatedMeetings: meetings,
      success: false,
      message: 'No available slots later in the day for both supplier and buyer'
    };
  }

  const now = new Date().toISOString();

  // Create updated meetings array
  const updatedMeetings = meetings.map(m => {
    if (m.id === meetingId) {
      // Mark original as bumped
      return {
        ...m,
        status: 'bumped' as const,
        delayedAt: now,
      };
    }
    return m;
  });

  // Add new meeting in the later slot
  const newMeeting: Meeting = {
    id: generateId(),
    supplierId: meeting.supplierId,
    buyerId: meeting.buyerId,
    timeSlotId: nextSlot.id,
    status: 'scheduled',
    originalTimeSlotId: meeting.timeSlotId,
    bumpedFrom: meeting.id,
  };

  updatedMeetings.push(newMeeting);

  return {
    updatedMeetings,
    success: true,
    newSlotId: nextSlot.id,
    message: `Meeting bumped to later slot`,
  };
}

/**
 * Get all meetings that would be affected if we bump a meeting
 * (for cascade preview)
 */
export function getConflictingMeetingsForBump(
  meeting: Meeting,
  targetSlotId: string,
  meetings: Meeting[]
): Meeting[] {
  return meetings.filter(
    m => m.timeSlotId === targetSlotId &&
         m.status !== 'cancelled' &&
         m.status !== 'bumped' &&
         (m.supplierId === meeting.supplierId || m.buyerId === meeting.buyerId)
  );
}

export function autoFillCancelledSlots(
  suppliers: Supplier[],
  buyers: Buyer[],
  timeSlots: TimeSlot[],
  meetings: Meeting[]
): Meeting[] {
  const updatedMeetings = [...meetings];
  const meetingSlots = timeSlots.filter(slot => !slot.isBreak);

  // Find cancelled meetings and their slots
  const cancelledMeetings = updatedMeetings.filter(m => m.status === 'cancelled');

  for (const cancelled of cancelledMeetings) {
    const slot = meetingSlots.find(s => s.id === cancelled.timeSlotId);
    if (!slot) continue;

    // Find the supplier for this slot
    const supplier = suppliers.find(s => s.id === cancelled.supplierId);
    if (!supplier) continue;

    // Get current meetings for this slot
    const slotMeetings = updatedMeetings.filter(
      m => m.timeSlotId === slot.id && m.status !== 'cancelled'
    );

    // Find a buyer who:
    // 1. The supplier wants to meet
    // 2. Is not already scheduled at this time
    // 3. Is not already meeting this supplier at another time
    const supplierMeetings = updatedMeetings.filter(
      m => m.supplierId === supplier.id && m.status !== 'cancelled'
    );
    const alreadyMeetingBuyers = new Set(supplierMeetings.map(m => m.buyerId));
    const busyBuyers = new Set(slotMeetings.map(m => m.buyerId));

    const availableBuyer = buyers.find(buyer => {
      if (busyBuyers.has(buyer.id)) return false;
      if (alreadyMeetingBuyers.has(buyer.id)) return false;
      return canSupplierMeetBuyer(supplier, buyer.id);
    });

    if (availableBuyer) {
      // Replace cancelled meeting with new one
      const cancelledIndex = updatedMeetings.findIndex(m => m.id === cancelled.id);
      updatedMeetings[cancelledIndex] = {
        ...cancelled,
        buyerId: availableBuyer.id,
        status: 'scheduled',
      };
    }
  }

  return updatedMeetings;
}
