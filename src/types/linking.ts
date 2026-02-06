// Activity linking types for cross-tool integration

/**
 * An activity link stored in localStorage that connects
 * Project Manager activities with Meeting Scheduler and Budget Tracker
 */
export interface ActivityLink {
  id: string;
  name: string;
  fiscalYear: string;
  startDate: string;
  endDate: string;
  location?: string;
  // Project Manager links
  projectManagerActivityId?: string;
  // Meeting Scheduler links
  meetingSchedulerProjectId?: string;
  meetingSchedulerShareId?: string;
  // Budget Tracker links
  budgetTrackerActivityId?: string;
  // Metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * Form data for creating a new activity link
 */
export interface ActivityLinkFormData {
  name: string;
  fiscalYear: string;
  startDate: string;
  endDate: string;
  location?: string;
}

// PostMessage protocol types

/**
 * Message sent from Hub to Meeting Scheduler to create a project
 */
export interface CreateProjectMessage {
  type: 'CDFA_PROJECT';
  action: 'CREATE_PROJECT';
  payload: {
    name: string;
    cdfaActivityId: string;
    fiscalYear?: string;
    startDate?: string;
    endDate?: string;
    location?: string;
  };
}

/**
 * Response from Meeting Scheduler after project creation
 */
export interface ProjectResultMessage {
  type: 'CDFA_PROJECT_RESULT';
  success: boolean;
  projectId?: string;
  shareId?: string;
  error?: string;
}

/**
 * Storage key for activity links in localStorage
 */
export const ACTIVITY_LINKS_STORAGE_KEY = 'cdfa-hub-activity-links';

/**
 * Get the Budget Tracker URL with pre-filled parameters
 */
export function getBudgetTrackerCreateUrl(activity: ActivityLink): string {
  const params = new URLSearchParams({
    cdfa_activity_id: activity.id,
    name: activity.name,
  });

  if (activity.startDate) {
    params.set('start_date', activity.startDate);
  }
  if (activity.endDate) {
    params.set('end_date', activity.endDate);
  }

  // Use localhost for development
  const baseUrl = import.meta.env.DEV
    ? 'http://localhost:5000'
    : 'https://budget-tracker-three-kappa.vercel.app'; // TODO: Update with production URL

  return `${baseUrl}/activities/create?${params.toString()}`;
}

/**
 * Get the Budget Tracker URL to view an existing activity
 */
export function getBudgetTrackerViewUrl(budgetActivityId: string): string {
  const baseUrl = import.meta.env.DEV
    ? 'http://localhost:5000'
    : 'https://budget-tracker-three-kappa.vercel.app';

  return `${baseUrl}/activities/${budgetActivityId}`;
}

/**
 * Get the Meeting Scheduler URL for a project (internal route)
 */
export function getMeetingSchedulerUrl(shareId?: string): string {
  if (shareId) {
    return `/meeting-scheduler?share=${shareId}`;
  }

  return '/meeting-scheduler';
}
