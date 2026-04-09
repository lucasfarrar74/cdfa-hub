import type { Meeting, TimeSlot, Supplier, Buyer } from '../types';
import { isSlotInSupplierWindow } from './scheduler';

/**
 * Post-assignment compaction: rearrange meetings to minimize consecutive gaps
 * per supplier without violating any constraints.
 *
 * Never drops or adds meetings — same count in, same count out.
 */
export function compactSchedule(
  meetings: Meeting[],
  timeSlots: TimeSlot[],
  suppliers: Supplier[],
  buyers: Buyer[]
): Meeting[] {
  const result = meetings.map(m => ({ ...m }));
  const nonBreakSlots = timeSlots.filter(s => !s.isBreak);

  // Build slot lookup by ID
  const slotById = new Map<string, TimeSlot>();
  for (const slot of nonBreakSlots) {
    slotById.set(slot.id, slot);
  }

  // Group slots by date, sorted by time
  const slotsByDate = new Map<string, TimeSlot[]>();
  for (const slot of nonBreakSlots) {
    const existing = slotsByDate.get(slot.date) || [];
    existing.push(slot);
    slotsByDate.set(slot.date, existing);
  }
  for (const [, slots] of slotsByDate) {
    slots.sort((a, b) => {
      const aTime = a.startTime instanceof Date ? a.startTime.getTime() : new Date(a.startTime).getTime();
      const bTime = b.startTime instanceof Date ? b.startTime.getTime() : new Date(b.startTime).getTime();
      return aTime - bTime;
    });
  }

  // Build ordered slot index per date for quick neighbor lookups
  const slotPositionInDay = new Map<string, number>(); // slotId → index within day
  for (const [, daySlots] of slotsByDate) {
    daySlots.forEach((slot, idx) => slotPositionInDay.set(slot.id, idx));
  }

  // Index: supplier → set of occupied slot IDs
  const supplierOccupied = new Map<string, Set<string>>();
  // Index: buyer → set of occupied slot IDs
  const buyerOccupied = new Map<string, Set<string>>();
  // Index: supplierId:slotId → index in result array
  const meetingIndex = new Map<string, number>();

  for (const s of suppliers) supplierOccupied.set(s.id, new Set());
  for (const b of buyers) buyerOccupied.set(b.id, new Set());

  const activeStatuses = new Set(['scheduled', 'in_progress', 'completed', 'running_late', 'delayed']);

  for (let i = 0; i < result.length; i++) {
    const m = result[i];
    if (!activeStatuses.has(m.status)) continue;
    supplierOccupied.get(m.supplierId)?.add(m.timeSlotId);
    buyerOccupied.get(m.buyerId)?.add(m.timeSlotId);
    meetingIndex.set(`${m.supplierId}:${m.timeSlotId}`, i);
  }

  const supplierMap = new Map<string, Supplier>();
  for (const s of suppliers) supplierMap.set(s.id, s);

  // Get available slots for a supplier on a specific day
  function getSupplierDaySlots(supplierId: string, date: string): TimeSlot[] {
    const supplier = supplierMap.get(supplierId);
    if (!supplier) return [];
    const supplierDays = supplier.selectedDays;
    if (supplierDays && supplierDays.length > 0 && !supplierDays.includes(date)) return [];
    const daySlots = slotsByDate.get(date) || [];
    return daySlots.filter(s => isSlotInSupplierWindow(s, supplier));
  }

  // Check if removing a meeting from sourceSlot would create a bad gap
  // Returns the max consecutive gap that would form around sourceSlot if vacated
  function gapIfVacated(supplierId: string, sourceSlotId: string): number {
    const slot = slotById.get(sourceSlotId);
    if (!slot) return 0;
    const occupied = supplierOccupied.get(supplierId)!;

    const daySlots = getSupplierDaySlots(supplierId, slot.date);
    const idx = daySlots.findIndex(s => s.id === sourceSlotId);
    if (idx === -1) return 0;

    // Simulate removing: count consecutive empties around this position
    let runLen = 1; // This slot becomes empty
    for (let i = idx - 1; i >= 0; i--) {
      if (!occupied.has(daySlots[i].id)) runLen++;
      else break;
    }
    for (let i = idx + 1; i < daySlots.length; i++) {
      if (!occupied.has(daySlots[i].id)) runLen++;
      else break;
    }
    return runLen;
  }

  function executeMove(meetingIdx: number, targetSlotId: string): void {
    const m = result[meetingIdx];
    const oldSlotId = m.timeSlotId;

    supplierOccupied.get(m.supplierId)!.delete(oldSlotId);
    supplierOccupied.get(m.supplierId)!.add(targetSlotId);
    buyerOccupied.get(m.buyerId)!.delete(oldSlotId);
    buyerOccupied.get(m.buyerId)!.add(targetSlotId);
    meetingIndex.delete(`${m.supplierId}:${oldSlotId}`);
    meetingIndex.set(`${m.supplierId}:${targetSlotId}`, meetingIdx);

    m.timeSlotId = targetSlotId;
  }

  // Find gap runs of length >= 2 for a supplier on a day
  function findGapRuns(supplierId: string, date: string): Array<{ slots: TimeSlot[]; length: number }> {
    const daySlots = getSupplierDaySlots(supplierId, date);
    if (daySlots.length === 0) return [];

    const occupied = supplierOccupied.get(supplierId)!;
    const runs: Array<{ slots: TimeSlot[]; length: number }> = [];
    let currentRun: TimeSlot[] = [];

    for (const slot of daySlots) {
      if (!occupied.has(slot.id)) {
        currentRun.push(slot);
      } else {
        if (currentRun.length >= 2) {
          runs.push({ slots: [...currentRun], length: currentRun.length });
        }
        currentRun = [];
      }
    }
    if (currentRun.length >= 2) {
      runs.push({ slots: [...currentRun], length: currentRun.length });
    }

    return runs;
  }

  // Phase 1: Move meetings into gap slots
  const MAX_PASSES = 50;
  let pass = 0;
  let madeProgress = true;

  while (madeProgress && pass < MAX_PASSES) {
    madeProgress = false;
    pass++;

    for (const supplier of suppliers) {
      for (const [date] of slotsByDate) {
        const gapRuns = findGapRuns(supplier.id, date);

        for (const run of gapRuns) {
          // Try to fill one slot in this gap run
          for (const gapSlot of run.slots) {
            const currentGapLen = run.length;
            let bestMove: { meetingIdx: number; sourceSlotId: string; netImprovement: number } | null = null;

            // Look through this supplier's meetings for one we can move here
            const occupied = supplierOccupied.get(supplier.id)!;
            for (const occupiedSlotId of occupied) {
              const mIdx = meetingIndex.get(`${supplier.id}:${occupiedSlotId}`);
              if (mIdx === undefined) continue;
              if (result[mIdx].status !== 'scheduled') continue;

              // Can this meeting's buyer attend at the gap slot?
              const buyerId = result[mIdx].buyerId;
              if (buyerOccupied.get(buyerId)!.has(gapSlot.id)) continue;

              // Is the gap slot valid for this supplier?
              const supplierObj = supplierMap.get(supplier.id)!;
              if (!isSlotInSupplierWindow(gapSlot, supplierObj)) continue;
              const supplierDays = supplierObj.selectedDays;
              if (supplierDays && supplierDays.length > 0 && !supplierDays.includes(gapSlot.date)) continue;

              // How bad would the gap be at the source if we vacate it?
              const sourceGapAfterMove = gapIfVacated(supplier.id, occupiedSlotId);

              // Net improvement: we reduce the target gap run but may create a source gap
              // Current gap penalty at target: (currentGapLen - 1)^2
              // After filling one slot, target splits into at most two runs
              // Source: currently 0 gap (occupied), after move: sourceGapAfterMove
              // Only move if it's a net improvement
              const targetPenaltyBefore = currentGapLen > 1 ? (currentGapLen - 1) ** 2 : 0;

              // After filling gapSlot: the gap run splits. Calculate new penalties.
              // We need the position of gapSlot within the run to determine split
              const gapIdx = run.slots.findIndex(s => s.id === gapSlot.id);
              const leftLen = gapIdx; // slots before gapSlot in the run
              const rightLen = run.length - gapIdx - 1; // slots after gapSlot
              const targetPenaltyAfter =
                (leftLen > 1 ? (leftLen - 1) ** 2 : 0) +
                (rightLen > 1 ? (rightLen - 1) ** 2 : 0);

              const sourcePenaltyAfter = sourceGapAfterMove > 1 ? (sourceGapAfterMove - 1) ** 2 : 0;

              const netImprovement = targetPenaltyBefore - targetPenaltyAfter - sourcePenaltyAfter;

              if (netImprovement > 0 && (!bestMove || netImprovement > bestMove.netImprovement)) {
                bestMove = { meetingIdx: mIdx, sourceSlotId: occupiedSlotId, netImprovement };
              }
            }

            if (bestMove) {
              executeMove(bestMove.meetingIdx, gapSlot.id);
              madeProgress = true;
              break; // Gap runs changed, re-evaluate
            }
          }
          if (madeProgress) break;
        }
        if (madeProgress) break;
      }
      if (madeProgress) break;
    }
  }

  // Phase 2: Try cross-supplier swaps to fill remaining gaps
  pass = 0;
  madeProgress = true;

  while (madeProgress && pass < MAX_PASSES) {
    madeProgress = false;
    pass++;

    for (const supplier of suppliers) {
      for (const [date] of slotsByDate) {
        const gapRuns = findGapRuns(supplier.id, date);
        if (gapRuns.length === 0) continue;

        for (const run of gapRuns) {
          for (const gapSlot of run.slots) {
            // Find meetings at this slot from other suppliers
            for (const otherSupplier of suppliers) {
              if (otherSupplier.id === supplier.id) continue;

              const otherMIdx = meetingIndex.get(`${otherSupplier.id}:${gapSlot.id}`);
              if (otherMIdx === undefined) continue;
              if (result[otherMIdx].status !== 'scheduled') continue;

              const otherMeeting = result[otherMIdx];

              // Find a meeting from our supplier we can swap
              const ourOccupied = supplierOccupied.get(supplier.id)!;
              for (const ourSlotId of ourOccupied) {
                const ourMIdx = meetingIndex.get(`${supplier.id}:${ourSlotId}`);
                if (ourMIdx === undefined) continue;
                if (result[ourMIdx].status !== 'scheduled') continue;

                const ourMeeting = result[ourMIdx];

                // Skip swaps where both meetings involve the same buyer —
                // sequential executeMove calls would corrupt buyer occupancy index
                if (otherMeeting.buyerId === ourMeeting.buyerId) continue;

                // Check swap feasibility
                // otherMeeting → ourSlotId: buyer must be free (our meeting is leaving)
                const otherBuyerOccupied = buyerOccupied.get(otherMeeting.buyerId)!;
                if (otherBuyerOccupied.has(ourSlotId)) continue;

                // ourMeeting → gapSlot: buyer must be free (other meeting is leaving)
                const ourBuyerOccupied = buyerOccupied.get(ourMeeting.buyerId)!;
                if (ourBuyerOccupied.has(gapSlot.id)) continue;

                // Check supplier windows and day constraints
                const ourSlot = slotById.get(ourSlotId)!;
                if (!isSlotInSupplierWindow(ourSlot, otherSupplier)) continue;
                if (!isSlotInSupplierWindow(gapSlot, supplier)) continue;

                const otherDays = otherSupplier.selectedDays;
                if (otherDays && otherDays.length > 0 && !otherDays.includes(ourSlot.date)) continue;

                const ourDays = supplier.selectedDays;
                if (ourDays && ourDays.length > 0 && !ourDays.includes(gapSlot.date)) continue;

                // Calculate net improvement
                // Our supplier: gains a meeting at gapSlot (reduces gap), loses one at ourSlotId
                const ourGapBefore = run.length > 1 ? (run.length - 1) ** 2 : 0;
                const ourGapAfterVacate = gapIfVacated(supplier.id, ourSlotId);
                const ourVacatePenalty = ourGapAfterVacate > 1 ? (ourGapAfterVacate - 1) ** 2 : 0;

                // Other supplier: loses meeting at gapSlot, gains at ourSlotId
                const otherGapAtGap = gapIfVacated(otherSupplier.id, gapSlot.id);
                const otherGapPenalty = otherGapAtGap > 1 ? (otherGapAtGap - 1) ** 2 : 0;

                // Rough net: we fix our gap but may hurt other supplier and ourselves
                const gapIdx = run.slots.findIndex(s => s.id === gapSlot.id);
                const leftLen = gapIdx;
                const rightLen = run.length - gapIdx - 1;
                const ourGapAfterFill =
                  (leftLen > 1 ? (leftLen - 1) ** 2 : 0) +
                  (rightLen > 1 ? (rightLen - 1) ** 2 : 0);

                const netImprovement = ourGapBefore - ourGapAfterFill - ourVacatePenalty - otherGapPenalty;

                if (netImprovement > 0) {
                  // Execute swap
                  executeMove(otherMIdx, ourSlotId);
                  executeMove(ourMIdx, gapSlot.id);
                  madeProgress = true;
                  break;
                }
              }
              if (madeProgress) break;
            }
            if (madeProgress) break;
          }
          if (madeProgress) break;
        }
        if (madeProgress) break;
      }
      if (madeProgress) break;
    }
  }

  return result;
}
