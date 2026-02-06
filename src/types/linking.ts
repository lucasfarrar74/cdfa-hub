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
 * Get the internal Budget Tracker route
 */
export function getBudgetTrackerUrl(): string {
  return '/budget-tracker';
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
