import { v4 as uuidv4 } from 'uuid';
import { format, parseISO, addDays, isBefore, isAfter, isSameDay, startOfDay, differenceInDays } from 'date-fns';
import type {
  Activity,
  ProcedureTemplate,
  ChecklistInstance,
  ChecklistItem,
  Reminder,
  ProcedureTask,
} from '../types';

// Generate a checklist instance from a procedure template and activity dates
export function generateChecklistFromTemplate(
  activity: Activity,
  template: ProcedureTemplate
): ChecklistInstance {
  const items: ChecklistItem[] = [];
  const activityStart = parseISO(activity.startDate);

  for (const phase of template.phases) {
    for (const task of phase.tasks) {
      const dueDate = addDays(activityStart, task.dueOffset);
      const reminderDates = task.reminderOffsets.map((offset) =>
        format(addDays(dueDate, -offset), 'yyyy-MM-dd')
      );

      items.push({
        id: uuidv4(),
        taskId: task.id,
        phaseId: phase.id,
        title: task.title,
        description: task.description,
        category: task.category,
        status: 'not_started',
        dueDate: format(dueDate, 'yyyy-MM-dd'),
        reminderDates,
        isRequired: task.isRequired,
        requiresApproval: task.requiresApproval,
        notes: [],
        attachments: [],
      });
    }
  }

  return {
    id: uuidv4(),
    activityId: activity.id,
    procedureTemplateId: template.id,
    items,
    completedCount: 0,
    totalCount: items.length,
    overdueCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Recalculate checklist dates when activity dates change
export function recalculateChecklistDates(
  checklist: ChecklistInstance,
  activity: Activity,
  template: ProcedureTemplate
): ChecklistInstance {
  const activityStart = parseISO(activity.startDate);
  const taskMap = new Map<string, ProcedureTask>();

  // Build map of tasks from template
  for (const phase of template.phases) {
    for (const task of phase.tasks) {
      taskMap.set(task.id, task);
    }
  }

  const updatedItems = checklist.items.map((item) => {
    const task = taskMap.get(item.taskId);
    if (!task) return item;

    const dueDate = addDays(activityStart, task.dueOffset);
    const reminderDates = task.reminderOffsets.map((offset) =>
      format(addDays(dueDate, -offset), 'yyyy-MM-dd')
    );

    return {
      ...item,
      dueDate: format(dueDate, 'yyyy-MM-dd'),
      reminderDates,
    };
  });

  return {
    ...checklist,
    items: updatedItems,
    updatedAt: new Date().toISOString(),
  };
}

// Update checklist counts
export function updateChecklistCounts(checklist: ChecklistInstance): ChecklistInstance {
  const today = startOfDay(new Date());
  let completedCount = 0;
  let overdueCount = 0;

  for (const item of checklist.items) {
    if (item.status === 'completed' || item.status === 'skipped') {
      completedCount++;
    } else if (isBefore(parseISO(item.dueDate), today)) {
      overdueCount++;
    }
  }

  return {
    ...checklist,
    completedCount,
    overdueCount,
    updatedAt: new Date().toISOString(),
  };
}

// Generate reminders for a checklist
export function generateReminders(
  checklist: ChecklistInstance,
  activity: Activity
): Reminder[] {
  const reminders: Reminder[] = [];
  const today = startOfDay(new Date());

  for (const item of checklist.items) {
    // Skip completed or skipped items
    if (item.status === 'completed' || item.status === 'skipped') {
      continue;
    }

    const dueDate = parseISO(item.dueDate);

    // Check if overdue
    if (isBefore(dueDate, today)) {
      const daysSince = differenceInDays(today, dueDate);
      reminders.push({
        id: `overdue-${item.id}`,
        type: 'task_overdue',
        activityId: activity.id,
        checklistItemId: item.id,
        title: 'Task Overdue',
        message: `"${item.title}" for ${activity.name} was due ${daysSince} day${daysSince !== 1 ? 's' : ''} ago`,
        scheduledFor: format(today, 'yyyy-MM-dd'),
        isRead: false,
        isDismissed: false,
        recipientIds: item.assigneeId ? [item.assigneeId] : [],
        createdAt: new Date().toISOString(),
      });
    }

    // Check for upcoming due date reminders
    for (const reminderDateStr of item.reminderDates) {
      const reminderDate = parseISO(reminderDateStr);
      if (isSameDay(reminderDate, today) || (isAfter(reminderDate, today) && isBefore(reminderDate, addDays(today, 1)))) {
        const daysUntil = differenceInDays(dueDate, today);
        reminders.push({
          id: `upcoming-${item.id}-${reminderDateStr}`,
          type: 'task_due',
          activityId: activity.id,
          checklistItemId: item.id,
          title: 'Task Due Soon',
          message: `"${item.title}" for ${activity.name} is due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
          scheduledFor: reminderDateStr,
          isRead: false,
          isDismissed: false,
          recipientIds: item.assigneeId ? [item.assigneeId] : [],
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  return reminders;
}

// Get upcoming tasks for an activity (next N days)
export function getUpcomingTasks(
  checklist: ChecklistInstance,
  daysAhead: number = 14
): ChecklistItem[] {
  const today = startOfDay(new Date());
  const cutoff = addDays(today, daysAhead);

  return checklist.items
    .filter((item) => {
      if (item.status === 'completed' || item.status === 'skipped') {
        return false;
      }
      const dueDate = parseISO(item.dueDate);
      return !isBefore(dueDate, today) && !isAfter(dueDate, cutoff);
    })
    .sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime());
}

// Get overdue tasks for an activity
export function getOverdueTasks(checklist: ChecklistInstance): ChecklistItem[] {
  const today = startOfDay(new Date());

  return checklist.items
    .filter((item) => {
      if (item.status === 'completed' || item.status === 'skipped') {
        return false;
      }
      return isBefore(parseISO(item.dueDate), today);
    })
    .sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime());
}

// Get tasks by phase
export function getTasksByPhase(
  checklist: ChecklistInstance,
  template: ProcedureTemplate
): Map<string, { phase: typeof template.phases[0]; items: ChecklistItem[] }> {
  const phaseMap = new Map<string, { phase: typeof template.phases[0]; items: ChecklistItem[] }>();

  for (const phase of template.phases) {
    phaseMap.set(phase.id, { phase, items: [] });
  }

  for (const item of checklist.items) {
    const phaseData = phaseMap.get(item.phaseId);
    if (phaseData) {
      phaseData.items.push(item);
    }
  }

  // Sort items within each phase by due date
  for (const [, data] of phaseMap) {
    data.items.sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime());
  }

  return phaseMap;
}

// Calculate phase completion status
export function getPhaseStatus(
  items: ChecklistItem[]
): 'not_started' | 'in_progress' | 'completed' {
  if (items.length === 0) return 'completed';

  const completedCount = items.filter(
    (i) => i.status === 'completed' || i.status === 'skipped'
  ).length;

  if (completedCount === 0) return 'not_started';
  if (completedCount === items.length) return 'completed';
  return 'in_progress';
}

// Format due date for display with status indicator
export function formatDueDateWithStatus(dueDateStr: string): {
  text: string;
  status: 'overdue' | 'today' | 'upcoming' | 'future';
} {
  const dueDate = parseISO(dueDateStr);
  const today = startOfDay(new Date());
  const diff = differenceInDays(dueDate, today);

  if (diff < 0) {
    return {
      text: `${Math.abs(diff)} day${Math.abs(diff) !== 1 ? 's' : ''} overdue`,
      status: 'overdue',
    };
  } else if (diff === 0) {
    return { text: 'Due today', status: 'today' };
  } else if (diff <= 7) {
    return {
      text: `Due in ${diff} day${diff !== 1 ? 's' : ''}`,
      status: 'upcoming',
    };
  } else {
    return { text: format(dueDate, 'MMM d, yyyy'), status: 'future' };
  }
}
