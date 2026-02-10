import { useState, useEffect } from 'react';
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

interface CrossToolData {
  budget: BudgetSummary | null;
  scheduler: SchedulerSummary | null;
  activityLink: ActivityLink | null;
}

export function useCrossToolData(activityId: string | null): CrossToolData {
  const [data, setData] = useState<CrossToolData>({
    budget: null,
    scheduler: null,
    activityLink: null,
  });

  useEffect(() => {
    if (!activityId) {
      setData({ budget: null, scheduler: null, activityLink: null });
      return;
    }

    function loadData() {
      // Find activity link
      let activityLink: ActivityLink | null = null;
      try {
        const linksRaw = localStorage.getItem(ACTIVITY_LINKS_STORAGE_KEY);
        if (linksRaw) {
          const links: ActivityLink[] = JSON.parse(linksRaw);
          activityLink = links.find(l => l.projectManagerActivityId === activityId) || null;
        }
      } catch {
        // ignore parse errors
      }

      // Budget data
      let budget: BudgetSummary | null = null;
      if (activityLink?.budgetTrackerActivityId) {
        try {
          const budgetRaw = localStorage.getItem('cdfa-budget-tracker-data');
          if (budgetRaw) {
            const budgetData = JSON.parse(budgetRaw);
            const activities = budgetData.activities || [];
            const budgetActivity = activities.find(
              (a: { id: number | string }) => String(a.id) === String(activityLink!.budgetTrackerActivityId)
            );
            if (budgetActivity) {
              const allExpenses = budgetData.expenses || {};
              const expenses: Array<{ amount: number; status: string }> = allExpenses[budgetActivity.id] || [];
              const budgetAmount = Number(budgetActivity.budget) || 0;
              const committed = expenses
                .filter((e: { status: string }) => e.status === 'projected')
                .reduce((sum: number, e: { amount: number }) => sum + (Number(e.amount) || 0), 0);
              const actual = expenses
                .filter((e: { status: string }) => e.status === 'actual')
                .reduce((sum: number, e: { amount: number }) => sum + (Number(e.amount) || 0), 0);
              const totalSpent = committed + actual;
              const available = budgetAmount - totalSpent;
              const utilizationPercent = budgetAmount > 0 ? Math.round((totalSpent / budgetAmount) * 100) : 0;

              budget = {
                budgetAmount,
                committed,
                actual,
                available,
                utilizationPercent,
                activityName: budgetActivity.name || '',
              };
            }
          }
        } catch {
          // ignore
        }
      }

      // Scheduler data
      let scheduler: SchedulerSummary | null = null;
      if (activityLink?.meetingSchedulerProjectId) {
        try {
          const schedulerRaw = localStorage.getItem('meeting-scheduler-projects');
          if (schedulerRaw) {
            const projects = JSON.parse(schedulerRaw);
            const project = Array.isArray(projects)
              ? projects.find((p: { id: string }) => p.id === activityLink!.meetingSchedulerProjectId)
              : null;
            if (project) {
              const meetings = project.meetings || [];
              const suppliers = project.suppliers || [];
              const buyers = project.buyers || [];
              scheduler = {
                meetingCount: meetings.length,
                supplierCount: suppliers.length,
                buyerCount: buyers.length,
                projectName: project.name || '',
              };
            }
          }
        } catch {
          // ignore
        }
      }

      setData({ budget, scheduler, activityLink });
    }

    loadData();

    // Listen for cross-tab storage changes
    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === ACTIVITY_LINKS_STORAGE_KEY ||
        e.key === 'cdfa-budget-tracker-data' ||
        e.key === 'meeting-scheduler-projects'
      ) {
        loadData();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [activityId]);

  return data;
}
