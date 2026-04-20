import type { Supplier, Buyer, Meeting, TimeSlot, EventConfig } from '../types';
import type { ScheduleScore } from './scheduleScoring';
import { generateId, generateTimeSlots, getEnabledDates } from './timeUtils';
import { generateOptimizedSchedule } from './scheduleOptimizer';

export interface ScheduleResult {
  meetings: Meeting[];
  timeSlots: TimeSlot[];
  unscheduledPairs: Array<{ supplierId: string; buyerId: string }>;
  score?: ScheduleScore;
}

/**
 * Check if a time slot falls within a supplier's available time window.
 * Returns true if the supplier has no time restrictions or the slot is within bounds.
 */
export function isSlotInSupplierWindow(slot: TimeSlot, supplier: Supplier): boolean {
  if (!supplier.availableFrom && !supplier.availableTo) return true;

  // Compare using HH:mm strings against the slot's start time
  const slotStart = slot.startTime instanceof Date ? slot.startTime : new Date(slot.startTime);
  const slotHHMM = slotStart.toTimeString().substring(0, 5); // "HH:MM"

  if (supplier.availableFrom && slotHHMM < supplier.availableFrom) return false;
  if (supplier.availableTo && slotHHMM >= supplier.availableTo) return false;

  return true;
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
export function buildDesiredMeetings(
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

    // Find first available slot where both are free and supplier is available on that day
    const supplier = suppliers.find(s => s.id === desired.supplierId);
    const supplierDays = supplier?.selectedDays;

    const availableSlot = meetingSlots.find(slot => {
      if (supplierUsed.has(slot.id) || buyerUsed.has(slot.id)) return false;
      // If supplier has day restrictions, only allow slots on those days
      if (supplierDays && supplierDays.length > 0 && !supplierDays.includes(slot.date)) return false;
      // Check supplier's available time window
      if (supplier && !isSlotInSupplierWindow(slot, supplier)) return false;
      return true;
    });

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
  const dates = getEnabledDates(config);

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

    // If supplier has day restrictions, only consider those days
    const supplier = suppliers.find(s => s.id === desired.supplierId);
    const supplierDays = supplier?.selectedDays;
    const allowedDates = (supplierDays && supplierDays.length > 0)
      ? dates.filter(d => supplierDays.includes(d))
      : dates;

    // Find the day with fewest meetings for this supplier that has available slots
    let bestSlot: TimeSlot | null = null;
    let bestDayCount = Infinity;

    const effectiveNumDays = allowedDates.length || 1;
    const totalForSupplierSpaced = supplierTotalMeetings.get(desired.supplierId)!;
    const effectiveTargetPerDay = Math.ceil(totalForSupplierSpaced / effectiveNumDays);

    for (const date of allowedDates) {
      const currentDayCount = supplierDayCount.get(date)!;

      // Skip this day if it's already at or above target (unless no better option)
      if (currentDayCount >= effectiveTargetPerDay && bestSlot !== null) {
        continue;
      }

      const daySlots = slotsByDate.get(date)!;

      // Find first available slot on this day
      const availableSlot = daySlots.find(slot =>
        !supplierUsed.has(slot.id) && !buyerUsed.has(slot.id)
        && (supplier ? isSlotInSupplierWindow(slot, supplier) : true)
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

/**
 * Equitable scheduling: ensures every supplier's meetings span the full day.
 * Target positions are calculated so first meeting is near the start and last is near the end.
 * Meetings cluster naturally around target positions when conflicts push them to nearby slots.
 */
export function generateEquitableSchedule(
  config: EventConfig,
  timeSlots: TimeSlot[],
  suppliers: Supplier[],
  buyers: Buyer[],
  desiredMeetings?: Array<{ supplierId: string; buyerId: string; priority: number }>
): { meetings: Meeting[]; unscheduledPairs: Array<{ supplierId: string; buyerId: string }> } {
  const meetings: Meeting[] = [];
  const unscheduledPairs: Array<{ supplierId: string; buyerId: string }> = [];
  const dates = getEnabledDates(config);

  const desired = desiredMeetings || buildDesiredMeetings(suppliers, buyers);

  // Track occupancy
  const buyerUsed = new Set<string>(); // "buyerId:slotId"

  // Group non-break slots by date
  const slotsByDate = new Map<string, TimeSlot[]>();
  for (const date of dates) {
    slotsByDate.set(date, timeSlots.filter(s => s.date === date && !s.isBreak));
  }

  // Phase 1: Distribute desired meetings across days evenly
  const meetingsByDay = new Map<string, Array<{ supplierId: string; buyerId: string; priority: number }>>();
  for (const date of dates) meetingsByDay.set(date, []);

  const supplierDayCount = new Map<string, Map<string, number>>();
  for (const d of desired) {
    if (!supplierDayCount.has(d.supplierId)) {
      const m = new Map<string, number>();
      for (const date of dates) m.set(date, 0);
      supplierDayCount.set(d.supplierId, m);
    }
  }

  for (const d of desired) {
    const supplier = suppliers.find(s => s.id === d.supplierId);
    const supplierDays = supplier?.selectedDays;
    const allowedDates = (supplierDays && supplierDays.length > 0)
      ? dates.filter(dt => supplierDays.includes(dt))
      : dates;

    if (allowedDates.length === 0) {
      unscheduledPairs.push({ supplierId: d.supplierId, buyerId: d.buyerId });
      continue;
    }

    // Pick day with fewest meetings for this supplier
    const counts = supplierDayCount.get(d.supplierId)!;
    let bestDate = allowedDates[0];
    let bestCount = counts.get(bestDate) ?? 0;
    for (const date of allowedDates) {
      const c = counts.get(date) ?? 0;
      if (c < bestCount) { bestDate = date; bestCount = c; }
    }

    meetingsByDay.get(bestDate)!.push(d);
    counts.set(bestDate, bestCount + 1);
  }

  // Phase 2: Within each day, calculate targets and assign
  for (const date of dates) {
    const daySlots = slotsByDate.get(date) || [];
    const dayMeetings = meetingsByDay.get(date) || [];
    if (daySlots.length === 0 || dayMeetings.length === 0) continue;

    // Group by supplier
    const bySupplier = new Map<string, Array<{ buyerId: string; priority: number }>>();
    for (const m of dayMeetings) {
      if (!bySupplier.has(m.supplierId)) bySupplier.set(m.supplierId, []);
      bySupplier.get(m.supplierId)!.push({ buyerId: m.buyerId, priority: m.priority });
    }

    // Calculate target positions per supplier
    // Use proportional window: spread based on the busiest supplier's density
    const supplierTargets = new Map<string, Array<{ buyerId: string; targetIndex: number }>>();
    let maxMeetingsPerSupplier = 0;
    let maxMeetingsCount = 0;

    // First pass: find the max meetings any supplier has this day
    for (const [, suplMeetings] of bySupplier) {
      maxMeetingsCount = Math.max(maxMeetingsCount, suplMeetings.length);
    }

    // Track which slots are occupied by each supplier (prevent double-booking)
    const supplierSlotSet = new Map<string, Set<string>>(); // supplierId → Set<slotId>

    for (const [supplierId, suplMeetings] of bySupplier) {
      const supplier = suppliers.find(s => s.id === supplierId);
      const availableIndices: number[] = [];
      for (let i = 0; i < daySlots.length; i++) {
        if (!supplier || isSlotInSupplierWindow(daySlots[i], supplier)) {
          availableIndices.push(i);
        }
      }

      const M = availableIndices.length;
      const N = suplMeetings.length;
      if (M === 0 || N === 0) {
        for (const sm of suplMeetings) unscheduledPairs.push({ supplierId, buyerId: sm.buyerId });
        continue;
      }

      // Proportional window: scale the spread based on meeting count relative to the busiest supplier
      // The busiest supplier spans the full day; others span proportionally less
      // This keeps gap sizes similar across suppliers
      const windowRatio = maxMeetingsCount > 0 ? N / maxMeetingsCount : 1;
      const windowSize = Math.max(N, Math.ceil(M * windowRatio));
      const effectiveM = Math.min(windowSize, M);

      const targets: number[] = [];
      if (N === 1) {
        targets.push(availableIndices[Math.floor(effectiveM / 2)]);
      } else {
        for (let i = 0; i < N; i++) {
          const idx = Math.round(i * (effectiveM - 1) / (N - 1));
          targets.push(availableIndices[Math.min(idx, M - 1)]);
        }
      }

      const entries = targets.map((t, i) => ({ buyerId: suplMeetings[i].buyerId, targetIndex: t }));
      supplierTargets.set(supplierId, entries);
      maxMeetingsPerSupplier = Math.max(maxMeetingsPerSupplier, N);
      supplierSlotSet.set(supplierId, new Set());
    }

    // Round-robin assignment with double-booking prevention
    const supplierIds = Array.from(supplierTargets.keys());

    const assignMeeting = (supplierId: string, buyerId: string, targetIndex: number): boolean => {
      const supplier = suppliers.find(s => s.id === supplierId);
      const mySlots = supplierSlotSet.get(supplierId)!;

      for (let radius = 0; radius < daySlots.length; radius++) {
        const offsets = radius === 0 ? [0] : [radius, -radius];
        for (const offset of offsets) {
          const idx = targetIndex + offset;
          if (idx < 0 || idx >= daySlots.length) continue;

          const slot = daySlots[idx];

          // Prevent double-booking: supplier already has a meeting in this slot
          if (mySlots.has(slot.id)) continue;

          const bKey = `${buyerId}:${slot.id}`;
          if (buyerUsed.has(bKey)) continue;
          if (supplier && !isSlotInSupplierWindow(slot, supplier)) continue;

          meetings.push({
            id: generateId(),
            supplierId,
            buyerId,
            timeSlotId: slot.id,
            status: 'scheduled',
          });
          mySlots.add(slot.id);
          buyerUsed.add(bKey);
          return true;
        }
      }
      return false;
    };

    for (let round = 0; round < maxMeetingsPerSupplier; round++) {
      // Reverse supplier order on odd rounds for fairness
      const orderedIds = round % 2 === 0 ? supplierIds : [...supplierIds].reverse();

      for (const supplierId of orderedIds) {
        const targets = supplierTargets.get(supplierId);
        if (!targets || round >= targets.length) continue;

        const { buyerId, targetIndex } = targets[round];
        if (!assignMeeting(supplierId, buyerId, targetIndex)) {
          unscheduledPairs.push({ supplierId, buyerId });
        }
      }
    }
  }

  // Post-process: equalize gaps across suppliers
  equalizeGaps(meetings, timeSlots, suppliers);

  return { meetings, unscheduledPairs };
}

/**
 * Post-processing: equalizes gaps across suppliers using two strategies:
 * 1. Within-supplier: moves meetings from zero-gap clusters into large gaps
 * 2. Cross-supplier: swaps meetings between a "gappy" supplier and a "packed" supplier
 *    so both end up with more uniform gap profiles
 * Skips suppliers with availableTo set (they intentionally end early).
 */
function equalizeGaps(
  meetings: Meeting[],
  timeSlots: TimeSlot[],
  suppliers: Supplier[],
): void {
  const MAX_PASSES = 20;

  // Build slot index lookup
  const daySlotMap = new Map<string, TimeSlot[]>();
  for (const s of timeSlots) {
    if (s.isBreak) continue;
    if (!daySlotMap.has(s.date)) daySlotMap.set(s.date, []);
    daySlotMap.get(s.date)!.push(s);
  }
  for (const slots of daySlotMap.values()) {
    slots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  const slotToIndex = new Map<string, number>();
  const slotToDate = new Map<string, string>();
  for (const [date, slots] of daySlotMap) {
    slots.forEach((s, i) => { slotToIndex.set(s.id, i); slotToDate.set(s.id, date); });
  }

  const eligibleSuppliers = suppliers.filter(s => !s.availableTo);

  // Helper: get a supplier's gap profile for a day
  function getGapProfile(supplierId: string, date: string) {
    const daySlots = daySlotMap.get(date);
    if (!daySlots) return null;
    const dayMeetings = meetings
      .filter(m => m.supplierId === supplierId && m.status !== 'cancelled' && slotToDate.get(m.timeSlotId) === date)
      .sort((a, b) => (slotToIndex.get(a.timeSlotId) ?? 0) - (slotToIndex.get(b.timeSlotId) ?? 0));
    if (dayMeetings.length < 2) return null;

    const indices = dayMeetings.map(m => slotToIndex.get(m.timeSlotId) ?? 0);
    const gaps: number[] = [];
    for (let i = 1; i < indices.length; i++) gaps.push(indices[i] - indices[i - 1] - 1);

    return { dayMeetings, indices, gaps, maxGap: Math.max(...gaps), minGap: Math.min(...gaps) };
  }

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let improved = false;

    // Rebuild occupancy maps each pass
    const buyerOccupancy = new Map<string, Set<string>>();
    const supplierOccupancy = new Map<string, Set<string>>();
    for (const m of meetings) {
      if (m.status === 'cancelled') continue;
      if (!buyerOccupancy.has(m.buyerId)) buyerOccupancy.set(m.buyerId, new Set());
      buyerOccupancy.get(m.buyerId)!.add(m.timeSlotId);
      if (!supplierOccupancy.has(m.supplierId)) supplierOccupancy.set(m.supplierId, new Set());
      supplierOccupancy.get(m.supplierId)!.add(m.timeSlotId);
    }

    for (const date of daySlotMap.keys()) {
      const daySlots = daySlotMap.get(date)!;

      // Score all eligible suppliers on this day
      const profiles: Array<{ supplier: typeof suppliers[0]; profile: NonNullable<ReturnType<typeof getGapProfile>> }> = [];
      for (const sup of eligibleSuppliers) {
        const p = getGapProfile(sup.id, date);
        if (p && p.gaps.length > 0) profiles.push({ supplier: sup, profile: p });
      }
      if (profiles.length < 2) continue;

      // Sort by maxGap descending — worst first
      profiles.sort((a, b) => b.profile.maxGap - a.profile.maxGap);

      const worst = profiles[0];
      if (worst.profile.maxGap <= 1) continue; // Already good

      // Strategy 1: Within-supplier move (from cluster to gap)
      if (worst.profile.minGap <= 0 && worst.profile.maxGap - worst.profile.minGap > 1) {
        const { dayMeetings, indices, gaps } = worst.profile;
        const largestGapIdx = gaps.indexOf(worst.profile.maxGap);
        const gapStart = indices[largestGapIdx];
        const gapEnd = indices[largestGapIdx + 1];
        const targetIdx = Math.floor((gapStart + gapEnd) / 2);
        const targetSlot = daySlots[targetIdx];

        if (targetSlot && !supplierOccupancy.get(worst.supplier.id)?.has(targetSlot.id)) {
          // Find a meeting in the tightest cluster to move
          const zeroGapIndices = gaps.map((g, i) => ({ g, i })).filter(x => x.g <= 0).map(x => x.i);
          for (const ci of zeroGapIndices) {
            const mtg = dayMeetings[ci + 1];
            const buyerSlots = buyerOccupancy.get(mtg.buyerId);
            if (buyerSlots?.has(targetSlot.id)) continue;

            // Move it
            const oldSlotId = mtg.timeSlotId;
            buyerSlots?.delete(oldSlotId);
            supplierOccupancy.get(worst.supplier.id)?.delete(oldSlotId);
            mtg.timeSlotId = targetSlot.id;
            if (buyerSlots) buyerSlots.add(targetSlot.id);
            supplierOccupancy.get(worst.supplier.id)?.add(targetSlot.id);
            improved = true;
            break;
          }
          if (improved) continue;
        }
      }

      // Strategy 2: Cross-supplier swap
      // Find a "packed" supplier (low maxGap) that has a meeting inside the worst supplier's gap
      const { indices: worstIndices, gaps: worstGaps } = worst.profile;
      const largestGapIdx = worstGaps.indexOf(worst.profile.maxGap);
      const gapStart = worstIndices[largestGapIdx];
      const gapEnd = worstIndices[largestGapIdx + 1];

      // Find the best supplier (most packed) to trade with
      for (let pi = profiles.length - 1; pi >= 1; pi--) {
        const packed = profiles[pi];
        if (packed.profile.maxGap >= worst.profile.maxGap - 1) continue; // Not meaningfully more packed

        // Does the packed supplier have a meeting inside the worst supplier's gap zone?
        for (const packedMtg of packed.profile.dayMeetings) {
          const packedIdx = slotToIndex.get(packedMtg.timeSlotId) ?? -1;
          if (packedIdx <= gapStart || packedIdx >= gapEnd) continue;

          // Found a packed supplier's meeting inside the gap zone
          // Now find a meeting from the worst supplier's cluster to swap with
          for (const worstMtg of worst.profile.dayMeetings) {
            const worstIdx = slotToIndex.get(worstMtg.timeSlotId) ?? -1;
            // This meeting should be in a cluster (adjacent to another meeting)
            const worstMtgPos = worst.profile.indices.indexOf(worstIdx);
            if (worstMtgPos < 0) continue;
            const gapBefore = worstMtgPos > 0 ? worstIdx - worst.profile.indices[worstMtgPos - 1] - 1 : 999;
            const gapAfter = worstMtgPos < worst.profile.indices.length - 1 ? worst.profile.indices[worstMtgPos + 1] - worstIdx - 1 : 999;
            if (gapBefore > 0 && gapAfter > 0) continue; // Not in a cluster

            // Can we swap? Check buyer constraints
            const worstSlot = daySlots[worstIdx];
            const packedSlot = daySlots[packedIdx];
            if (!worstSlot || !packedSlot) continue;

            // Check: worst's buyer available at packed's slot?
            const worstBuyerSlots = buyerOccupancy.get(worstMtg.buyerId);
            if (worstBuyerSlots?.has(packedSlot.id)) continue;

            // Check: packed's buyer available at worst's slot?
            const packedBuyerSlots = buyerOccupancy.get(packedMtg.buyerId);
            if (packedBuyerSlots?.has(worstSlot.id)) continue;

            // Check: suppliers don't already occupy the target slots
            if (supplierOccupancy.get(worst.supplier.id)?.has(packedSlot.id)) continue;
            if (supplierOccupancy.get(packed.supplier.id)?.has(worstSlot.id)) continue;

            // Swap the time slots
            worstBuyerSlots?.delete(worstSlot.id);
            worstBuyerSlots?.add(packedSlot.id);
            packedBuyerSlots?.delete(packedSlot.id);
            packedBuyerSlots?.add(worstSlot.id);

            supplierOccupancy.get(worst.supplier.id)?.delete(worstSlot.id);
            supplierOccupancy.get(worst.supplier.id)?.add(packedSlot.id);
            supplierOccupancy.get(packed.supplier.id)?.delete(packedSlot.id);
            supplierOccupancy.get(packed.supplier.id)?.add(worstSlot.id);

            worstMtg.timeSlotId = packedSlot.id;
            packedMtg.timeSlotId = worstSlot.id;

            improved = true;
            break;
          }
          if (improved) break;
        }
        if (improved) break;
      }
    }

    if (!improved) break;
  }
}

export function generateSchedule(
  config: EventConfig,
  suppliers: Supplier[],
  buyers: Buyer[],
  onProgress?: (current: number, total: number) => void
): ScheduleResult {
  // Use optimized path unless explicitly disabled
  if (config.optimizationEnabled !== false) {
    const result = generateOptimizedSchedule(config, suppliers, buyers, {
      candidateCount: config.candidateCount ?? 10,
      onProgress,
    });
    return {
      meetings: result.meetings,
      timeSlots: result.timeSlots,
      unscheduledPairs: result.unscheduledPairs,
      score: result.score,
    };
  }

  // Legacy unoptimized path
  const timeSlots = generateTimeSlots(config);

  const { meetings, unscheduledPairs } = config.schedulingStrategy === 'equitable'
    ? generateEquitableSchedule(config, timeSlots, suppliers, buyers)
    : config.schedulingStrategy === 'spaced'
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
