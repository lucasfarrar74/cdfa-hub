import { useState, useEffect, useMemo } from 'react';
import { ACTIVITY_LINKS_STORAGE_KEY, type ActivityLink } from '../../../types/linking';

interface BudgetSummary {
  budgetAmount: number;
  committed: number;
  actual: number;
  available: number;
  utilizationPercent: number;
  activityName: string;
}

interface SchedulerSummary {
  meetingCount: number;
  supplierCount: number;
  buyerCount: number;
  projectName: string;
}

export interface CrossToolDataEntry {
  budget: BudgetSummary | null;
  scheduler: SchedulerSummary | null;
  activityLink: ActivityLink;
}

const BUDGET_STORAGE_KEY = 'cdfa-budget-tracker-data';
const SCHEDULER_STORAGE_KEY = 'meeting-scheduler-projects';

/**
 * Batch hook that reads all cross-tool data once and returns a Map
 * keyed by projectManagerActivityId for O(1) lookups per table row.
 */
export function useAllCrossToolData(): { dataByActivityId: Map<string, CrossToolDataEntry> } {
  const [version, setVersion] = useState(0);

  // Bump version on cross-tab storage changes
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === ACTIVITY_LINKS_STORAGE_KEY ||
        e.key === BUDGET_STORAGE_KEY ||
        e.key === SCHEDULER_STORAGE_KEY
      ) {
        setVersion(v => v + 1);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const dataByActivityId = useMemo(() => {
    const map = new Map<string, CrossToolDataEntry>();

    // 1. Read all activity links
    let links: ActivityLink[] = [];
    try {
      const linksRaw = localStorage.getItem(ACTIVITY_LINKS_STORAGE_KEY);
      if (linksRaw) links = JSON.parse(linksRaw);
    } catch {
      // ignore parse errors
    }

    // Filter to links that have a project manager activity
    const pmLinks = links.filter(l => l.projectManagerActivityId);
    if (pmLinks.length === 0) return map;

    // 2. Read budget data once
    let budgetActivities: Array<{
      id: number | string;
      name: string;
      budget: number;
      total_actual: number;
      total_committed: number;
      available_budget: number;
    }> = [];
    try {
      const budgetRaw = localStorage.getItem(BUDGET_STORAGE_KEY);
      if (budgetRaw) {
        const budgetData = JSON.parse(budgetRaw);
        budgetActivities = budgetData.activities || [];
      }
    } catch {
      // ignore
    }

    // Index budget activities by id for O(1) lookup
    const budgetById = new Map<string, (typeof budgetActivities)[number]>();
    for (const a of budgetActivities) {
      budgetById.set(String(a.id), a);
    }

    // 3. Read scheduler data once
    let schedulerProjects: Array<{
      id: string;
      name: string;
      meetings?: unknown[];
      suppliers?: unknown[];
      buyers?: unknown[];
    }> = [];
    try {
      const schedulerRaw = localStorage.getItem(SCHEDULER_STORAGE_KEY);
      if (schedulerRaw) {
        const parsed = JSON.parse(schedulerRaw);
        if (Array.isArray(parsed)) schedulerProjects = parsed;
      }
    } catch {
      // ignore
    }

    // Index scheduler projects by id
    const schedulerById = new Map<string, (typeof schedulerProjects)[number]>();
    for (const p of schedulerProjects) {
      schedulerById.set(p.id, p);
    }

    // 4. Build map
    for (const link of pmLinks) {
      let budget: BudgetSummary | null = null;
      let scheduler: SchedulerSummary | null = null;

      if (link.budgetTrackerActivityId) {
        const ba = budgetById.get(String(link.budgetTrackerActivityId));
        if (ba) {
          const budgetAmount = Number(ba.budget) || 0;
          const totalCommitted = Number(ba.total_committed) || 0;
          const utilizationPercent = budgetAmount > 0
            ? Math.round((totalCommitted / budgetAmount) * 100)
            : 0;

          budget = {
            budgetAmount,
            committed: totalCommitted,
            actual: Number(ba.total_actual) || 0,
            available: Number(ba.available_budget) || 0,
            utilizationPercent,
            activityName: ba.name || '',
          };
        }
      }

      if (link.meetingSchedulerProjectId) {
        const sp = schedulerById.get(link.meetingSchedulerProjectId);
        if (sp) {
          scheduler = {
            meetingCount: (sp.meetings || []).length,
            supplierCount: (sp.suppliers || []).length,
            buyerCount: (sp.buyers || []).length,
            projectName: sp.name || '',
          };
        }
      }

      map.set(link.projectManagerActivityId!, {
        budget,
        scheduler,
        activityLink: link,
      });
    }

    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  return { dataByActivityId };
}
