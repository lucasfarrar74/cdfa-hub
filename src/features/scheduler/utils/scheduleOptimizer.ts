import type { Supplier, Buyer, Meeting, TimeSlot, EventConfig } from '../types';
import type { ScheduleScore } from './scheduleScoring';
import { generateTimeSlots } from './timeUtils';
import { buildDesiredMeetings, generateEquitableSchedule } from './scheduler';
import { scoreSchedule, compositeScore } from './scheduleScoring';
import { compactSchedule } from './scheduleCompaction';
import { generateId } from './timeUtils';
import { isSlotInSupplierWindow } from './scheduler';
import { getEnabledDates } from './timeUtils';

interface OptimizedScheduleResult {
  meetings: Meeting[];
  timeSlots: TimeSlot[];
  unscheduledPairs: Array<{ supplierId: string; buyerId: string }>;
  score: ScheduleScore;
}

/**
 * Defense-in-depth check: no supplier or buyer should appear twice in the same slot.
 * Throws so that a regression in any strategy or post-processor surfaces loudly
 * instead of silently stacking meetings in the grid.
 */
function assertNoDoubleBookings(meetings: Meeting[]): void {
  const supplierSlot = new Set<string>();
  const buyerSlot = new Set<string>();
  for (const m of meetings) {
    if (m.status === 'cancelled' || m.status === 'bumped') continue;
    const sKey = `${m.supplierId}:${m.timeSlotId}`;
    const bKey = `${m.buyerId}:${m.timeSlotId}`;
    if (supplierSlot.has(sKey)) {
      console.error('[scheduler] Double-booked supplier detected', { meeting: m });
      throw new Error(`Supplier ${m.supplierId} double-booked at slot ${m.timeSlotId}`);
    }
    if (buyerSlot.has(bKey)) {
      console.error('[scheduler] Double-booked buyer detected', { meeting: m });
      throw new Error(`Buyer ${m.buyerId} double-booked at slot ${m.timeSlotId}`);
    }
    supplierSlot.add(sKey);
    buyerSlot.add(bKey);
  }
}

/**
 * Simple seeded PRNG (mulberry32) for reproducible shuffles across candidates.
 */
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle using a seeded PRNG.
 */
function shuffleWithSeed<T>(array: T[], seed: number): T[] {
  const result = [...array];
  const rng = mulberry32(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Run the efficient scheduling algorithm with a specific desired meetings list.
 */
function runEfficientSchedule(
  timeSlots: TimeSlot[],
  suppliers: Supplier[],
  buyers: Buyer[],
  desiredMeetings: Array<{ supplierId: string; buyerId: string; priority: number }>
): { meetings: Meeting[]; unscheduledPairs: Array<{ supplierId: string; buyerId: string }> } {
  const meetings: Meeting[] = [];
  const unscheduledPairs: Array<{ supplierId: string; buyerId: string }> = [];

  const meetingSlots = timeSlots.filter(slot => !slot.isBreak);
  const supplierSlots = new Map<string, Set<string>>();
  const buyerSlots = new Map<string, Set<string>>();

  suppliers.forEach(s => supplierSlots.set(s.id, new Set()));
  buyers.forEach(b => buyerSlots.set(b.id, new Set()));

  for (const desired of desiredMeetings) {
    const supplierUsed = supplierSlots.get(desired.supplierId)!;
    const buyerUsed = buyerSlots.get(desired.buyerId)!;
    const supplier = suppliers.find(s => s.id === desired.supplierId);
    const supplierDays = supplier?.selectedDays;

    const availableSlot = meetingSlots.find(slot => {
      if (supplierUsed.has(slot.id) || buyerUsed.has(slot.id)) return false;
      if (supplierDays && supplierDays.length > 0 && !supplierDays.includes(slot.date)) return false;
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
 * Run the spaced scheduling algorithm with a specific desired meetings list.
 */
function runSpacedSchedule(
  config: EventConfig,
  timeSlots: TimeSlot[],
  suppliers: Supplier[],
  buyers: Buyer[],
  desiredMeetings: Array<{ supplierId: string; buyerId: string; priority: number }>
): { meetings: Meeting[]; unscheduledPairs: Array<{ supplierId: string; buyerId: string }> } {
  const meetings: Meeting[] = [];
  const unscheduledPairs: Array<{ supplierId: string; buyerId: string }> = [];

  const dates = getEnabledDates(config);
  const slotsByDate = new Map<string, TimeSlot[]>();
  for (const date of dates) {
    slotsByDate.set(date, timeSlots.filter(s => s.date === date && !s.isBreak));
  }

  const supplierSlots = new Map<string, Set<string>>();
  const buyerSlots = new Map<string, Set<string>>();
  suppliers.forEach(s => supplierSlots.set(s.id, new Set()));
  buyers.forEach(b => buyerSlots.set(b.id, new Set()));

  const supplierMeetingsPerDay = new Map<string, Map<string, number>>();
  suppliers.forEach(s => {
    const dayMap = new Map<string, number>();
    dates.forEach(d => dayMap.set(d, 0));
    supplierMeetingsPerDay.set(s.id, dayMap);
  });

  const supplierTotalMeetings = new Map<string, number>();
  for (const supplier of suppliers) {
    const total = desiredMeetings.filter(d => d.supplierId === supplier.id).length;
    supplierTotalMeetings.set(supplier.id, total);
  }

  for (const desired of desiredMeetings) {
    const supplierUsed = supplierSlots.get(desired.supplierId)!;
    const buyerUsed = buyerSlots.get(desired.buyerId)!;
    const supplierDayCount = supplierMeetingsPerDay.get(desired.supplierId)!;
    const supplier = suppliers.find(s => s.id === desired.supplierId);
    const supplierDays = supplier?.selectedDays;
    const allowedDates = (supplierDays && supplierDays.length > 0)
      ? dates.filter(d => supplierDays.includes(d))
      : dates;

    let bestSlot: TimeSlot | null = null;
    let bestDayCount = Infinity;
    const effectiveNumDays = allowedDates.length || 1;
    const totalForSupplier = supplierTotalMeetings.get(desired.supplierId)!;
    const effectiveTargetPerDay = Math.ceil(totalForSupplier / effectiveNumDays);

    for (const date of allowedDates) {
      const currentDayCount = supplierDayCount.get(date)!;
      if (currentDayCount >= effectiveTargetPerDay && bestSlot !== null) continue;

      const daySlots = slotsByDate.get(date)!;
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
 * Generate an optimized schedule by evaluating multiple candidates with different
 * random orderings, compacting each, and returning the best one.
 */
export function generateOptimizedSchedule(
  config: EventConfig,
  suppliers: Supplier[],
  buyers: Buyer[],
  options?: {
    candidateCount?: number;
    onProgress?: (current: number, total: number) => void;
  }
): OptimizedScheduleResult {
  const candidateCount = options?.candidateCount ?? 10;
  const timeSlots = generateTimeSlots(config);

  // Build the base desired meetings list (unsorted for re-shuffling)
  const baseDesired = buildDesiredMeetings(suppliers, buyers);

  // Group by priority for within-group shuffling
  const priorityGroups = new Map<number, Array<{ supplierId: string; buyerId: string; priority: number }>>();
  for (const d of baseDesired) {
    const group = priorityGroups.get(d.priority) || [];
    group.push(d);
    priorityGroups.set(d.priority, group);
  }
  const priorities = [...priorityGroups.keys()].sort((a, b) => b - a); // Highest first

  let bestResult: OptimizedScheduleResult | null = null;
  let bestComposite = Infinity;

  for (let i = 0; i < candidateCount; i++) {
    options?.onProgress?.(i + 1, candidateCount);

    // Build shuffled desired meetings for this candidate
    let desiredMeetings: Array<{ supplierId: string; buyerId: string; priority: number }>;
    if (i === 0) {
      // First candidate: use the standard ordering
      desiredMeetings = baseDesired;
    } else {
      // Candidates 1+: shuffle within each priority group
      const seed = Date.now() + i * 7919; // Different seed per candidate
      desiredMeetings = [];
      for (const priority of priorities) {
        const group = priorityGroups.get(priority)!;
        desiredMeetings.push(...shuffleWithSeed(group, seed + priority));
      }
    }

    // Run the appropriate strategy
    const { meetings, unscheduledPairs } = config.schedulingStrategy === 'equitable'
      ? generateEquitableSchedule(config, timeSlots, suppliers, buyers, desiredMeetings)
      : config.schedulingStrategy === 'spaced'
      ? runSpacedSchedule(config, timeSlots, suppliers, buyers, desiredMeetings)
      : runEfficientSchedule(timeSlots, suppliers, buyers, desiredMeetings);

    // Compact to minimize gaps (skip for equitable — compaction defeats the spread)
    const compactedMeetings = config.schedulingStrategy === 'equitable'
      ? meetings
      : compactSchedule(meetings, timeSlots, suppliers, buyers);

    // Score
    const score = scoreSchedule(compactedMeetings, timeSlots, suppliers, candidateCount);
    const composite = compositeScore(score);

    if (composite < bestComposite) {
      bestComposite = composite;
      bestResult = {
        meetings: compactedMeetings,
        timeSlots,
        unscheduledPairs,
        score,
      };
    }

    // Early exit: perfect score (no consecutive gaps)
    if (score.maxConsecutiveGap <= 1) break;
  }

  // Fallback (shouldn't happen, but TypeScript safety)
  if (!bestResult) {
    const { meetings, unscheduledPairs } = config.schedulingStrategy === 'equitable'
      ? generateEquitableSchedule(config, timeSlots, suppliers, buyers, baseDesired)
      : config.schedulingStrategy === 'spaced'
      ? runSpacedSchedule(config, timeSlots, suppliers, buyers, baseDesired)
      : runEfficientSchedule(timeSlots, suppliers, buyers, baseDesired);
    assertNoDoubleBookings(meetings);
    return {
      meetings,
      timeSlots,
      unscheduledPairs,
      score: scoreSchedule(meetings, timeSlots, suppliers, 1),
    };
  }

  assertNoDoubleBookings(bestResult.meetings);
  return bestResult;
}
