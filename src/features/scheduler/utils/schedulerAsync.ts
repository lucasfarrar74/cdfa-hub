import type { Supplier, Buyer, Meeting, TimeSlot, EventConfig } from '../types';
import { generateId, generateTimeSlots } from './timeUtils';

interface ScheduleResult {
  meetings: Meeting[];
  timeSlots: TimeSlot[];
  unscheduledPairs: Array<{ supplierId: string; buyerId: string }>;
}

function canSupplierMeetBuyer(supplier: Supplier, buyerId: string): boolean {
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
 * Async schedule generator that yields to the browser periodically
 * to prevent UI freezing. Processes meetings in chunks.
 */
export async function generateScheduleAsync(
  config: EventConfig,
  suppliers: Supplier[],
  buyers: Buyer[],
  onProgress?: (current: number, total: number) => void
): Promise<ScheduleResult> {
  const timeSlots = generateTimeSlots(config);
  const meetings: Meeting[] = [];
  const unscheduledPairs: Array<{ supplierId: string; buyerId: string }> = [];

  // Get non-break slots only
  const meetingSlots = timeSlots.filter(slot => !slot.isBreak);
  const slotIds = meetingSlots.map(s => s.id);

  // Track which slots are taken for each supplier and buyer
  const supplierSlots: Map<string, Set<string>> = new Map();
  const buyerSlots: Map<string, Set<string>> = new Map();

  suppliers.forEach(s => supplierSlots.set(s.id, new Set()));
  buyers.forEach(b => buyerSlots.set(b.id, new Set()));

  // Create list of desired meetings based on preferences
  const desiredMeetings: Array<{ supplierId: string; buyerId: string; priority: number }> = [];

  suppliers.forEach(supplier => {
    buyers.forEach(buyer => {
      if (canSupplierMeetBuyer(supplier, buyer.id)) {
        let priority = 1;
        if (supplier.preference === 'include') {
          priority = 3;
        } else if (supplier.preference === 'all') {
          priority = 2;
        }
        desiredMeetings.push({ supplierId: supplier.id, buyerId: buyer.id, priority });
      }
    });
  });

  // Sort by priority (highest first) with stable randomization
  desiredMeetings.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    // Use a deterministic tiebreaker based on IDs for stability
    return (a.supplierId + a.buyerId).localeCompare(b.supplierId + b.buyerId);
  });

  const total = desiredMeetings.length;
  const CHUNK_SIZE = 100; // Process 100 meetings, then yield

  // Process in chunks to prevent UI blocking
  for (let i = 0; i < total; i++) {
    const desired = desiredMeetings[i];
    const supplierUsed = supplierSlots.get(desired.supplierId)!;
    const buyerUsed = buyerSlots.get(desired.buyerId)!;

    // Find first available slot where both are free
    let foundSlot: TimeSlot | undefined;
    for (const slotId of slotIds) {
      if (!supplierUsed.has(slotId) && !buyerUsed.has(slotId)) {
        foundSlot = meetingSlots.find(s => s.id === slotId);
        break;
      }
    }

    if (foundSlot) {
      meetings.push({
        id: generateId(),
        supplierId: desired.supplierId,
        buyerId: desired.buyerId,
        timeSlotId: foundSlot.id,
        status: 'scheduled',
      });
      supplierUsed.add(foundSlot.id);
      buyerUsed.add(foundSlot.id);
    } else {
      unscheduledPairs.push({
        supplierId: desired.supplierId,
        buyerId: desired.buyerId,
      });
    }

    // Yield to browser every CHUNK_SIZE iterations
    if (i > 0 && i % CHUNK_SIZE === 0) {
      onProgress?.(i, total);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  onProgress?.(total, total);
  return { meetings, timeSlots, unscheduledPairs };
}
