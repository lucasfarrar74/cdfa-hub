import type { Meeting, TimeSlot, Supplier } from '../types';
import { isSlotInSupplierWindow } from './scheduler';

export interface SupplierGapInfo {
  supplierId: string;
  meetingCount: number;
  maxConsecutiveGap: number;
  totalGapSlots: number; // Slots inside consecutive gap runs of length > 1
  gapRuns: number[];     // Lengths of each consecutive gap run
}

export interface ScheduleScore {
  totalScore: number;              // Lower is better (0 = perfect)
  totalMeetings: number;           // Higher is better
  maxConsecutiveGap: number;       // Worst single run across all suppliers
  totalConsecutiveGapSlots: number;
  candidatesEvaluated: number;
  perSupplier: Map<string, SupplierGapInfo>;
}

/**
 * Score a schedule based on consecutive gap quality.
 * Lower totalScore = better. A perfect schedule (no consecutive gaps) scores 0.
 *
 * Penalty per gap run: (runLength - 1)^2
 *   - Single gap (1 empty slot): 0 penalty (acceptable)
 *   - 2 consecutive gaps: 1 penalty
 *   - 3 consecutive gaps: 4 penalty
 *   - 4 consecutive gaps: 9 penalty
 */
export function scoreSchedule(
  meetings: Meeting[],
  timeSlots: TimeSlot[],
  suppliers: Supplier[],
  candidatesEvaluated: number = 1
): ScheduleScore {
  const nonBreakSlots = timeSlots.filter(s => !s.isBreak);

  // Group slots by date
  const slotsByDate = new Map<string, TimeSlot[]>();
  for (const slot of nonBreakSlots) {
    const existing = slotsByDate.get(slot.date) || [];
    existing.push(slot);
    slotsByDate.set(slot.date, existing);
  }

  // Sort each day's slots by start time
  for (const [, slots] of slotsByDate) {
    slots.sort((a, b) => {
      const aTime = a.startTime instanceof Date ? a.startTime.getTime() : new Date(a.startTime).getTime();
      const bTime = b.startTime instanceof Date ? b.startTime.getTime() : new Date(b.startTime).getTime();
      return aTime - bTime;
    });
  }

  // Build a quick lookup: supplierId:slotId → true
  const meetingLookup = new Set<string>();
  const scheduledMeetings = meetings.filter(m => m.status !== 'cancelled' && m.status !== 'bumped');
  for (const m of scheduledMeetings) {
    meetingLookup.add(`${m.supplierId}:${m.timeSlotId}`);
  }

  let totalScore = 0;
  let maxConsecutiveGap = 0;
  let totalConsecutiveGapSlots = 0;
  const perSupplier = new Map<string, SupplierGapInfo>();

  for (const supplier of suppliers) {
    let supplierMeetingCount = 0;
    let supplierMaxGap = 0;
    let supplierTotalGapSlots = 0;
    const supplierGapRuns: number[] = [];

    for (const [date, daySlots] of slotsByDate) {
      // Only consider slots the supplier could use
      const supplierDays = supplier.selectedDays;
      if (supplierDays && supplierDays.length > 0 && !supplierDays.includes(date)) {
        continue;
      }

      const availableSlots = daySlots.filter(s => isSlotInSupplierWindow(s, supplier));
      if (availableSlots.length === 0) continue;

      // Walk available slots and count consecutive gaps
      let currentGapRun = 0;

      for (const slot of availableSlots) {
        const hasMeeting = meetingLookup.has(`${supplier.id}:${slot.id}`);

        if (hasMeeting) {
          supplierMeetingCount++;
          // End any gap run
          if (currentGapRun > 0) {
            supplierGapRuns.push(currentGapRun);
            if (currentGapRun > 1) {
              const penalty = (currentGapRun - 1) ** 2;
              totalScore += penalty;
              supplierTotalGapSlots += currentGapRun;
            }
            if (currentGapRun > supplierMaxGap) supplierMaxGap = currentGapRun;
            currentGapRun = 0;
          }
        } else {
          currentGapRun++;
        }
      }

      // Handle trailing gap run (gaps at the end of the day)
      if (currentGapRun > 0) {
        supplierGapRuns.push(currentGapRun);
        if (currentGapRun > 1) {
          const penalty = (currentGapRun - 1) ** 2;
          totalScore += penalty;
          supplierTotalGapSlots += currentGapRun;
        }
        if (currentGapRun > supplierMaxGap) supplierMaxGap = currentGapRun;
      }
    }

    if (supplierMaxGap > maxConsecutiveGap) maxConsecutiveGap = supplierMaxGap;
    totalConsecutiveGapSlots += supplierTotalGapSlots;

    perSupplier.set(supplier.id, {
      supplierId: supplier.id,
      meetingCount: supplierMeetingCount,
      maxConsecutiveGap: supplierMaxGap,
      totalGapSlots: supplierTotalGapSlots,
      gapRuns: supplierGapRuns,
    });
  }

  return {
    totalScore,
    totalMeetings: scheduledMeetings.length,
    maxConsecutiveGap,
    totalConsecutiveGapSlots,
    candidatesEvaluated,
    perSupplier,
  };
}

/**
 * Composite score for comparing candidates. Lower = better.
 * Gap quality dominates; meeting count breaks ties.
 */
export function compositeScore(score: ScheduleScore): number {
  return score.totalScore * 1000 - score.totalMeetings;
}

/**
 * Human-readable quality label based on the worst consecutive gap.
 */
export function getQualityLabel(score: ScheduleScore): string {
  if (score.maxConsecutiveGap <= 1) return 'Excellent';
  if (score.maxConsecutiveGap <= 2) return 'Good';
  if (score.maxConsecutiveGap <= 3) return 'Fair';
  return 'Gaps remain';
}
